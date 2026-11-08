<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PoiController extends Controller
{
    /** Kota Bogor + pinggiran: minLon, minLat, maxLon, maxLat */
    private const BBOX = [106.70, -6.70, 106.90, -6.48];

    private const UA = 'NAIK-Angkot/1.0 (WebGIS tugas SIG IPB)';

    /**
     * GET /api/poi?q=sekolah vokasi&lat=-6.59&lng=106.80
     * Cari tempat, jalan, kelurahan & perumahan. Urutan: paling cocok dulu, lalu paling dekat (lat/lng opsional).
     * Sumber: naik.poi + naik.gazetir (OSM yang sudah diimpor); kalau hasilnya sedikit, tambah dari Photon / Nominatim.
     * Hasil: [{nama, ket, jenis, lat, lng, jarak_m, sumber}]
     */
    public function cari(Request $req): JsonResponse
    {
        $q = trim((string) $req->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([]);
        }
        $limit = min(max((int) $req->query('limit', 8), 1), 20);
        $dekat = $this->titik($req);

        $hasil = $this->dariDatabase($q, $limit, $dekat);
        if (count($hasil) < 5) {
            $hasil = array_merge($hasil, $this->urutJarak($this->dariPhoton($q, $dekat), $dekat));
        }
        if (count($hasil) < 3) {
            $hasil = array_merge($hasil, $this->urutJarak($this->dariNominatim($q), $dekat));
        }

        $lihat = [];
        $unik = [];
        foreach ($hasil as $h) {
            $k = mb_strtolower(trim($h['nama']));
            if (isset($lihat[$k])) {
                continue;
            }
            $lihat[$k] = true;
            $unik[] = $h;
        }

        return response()->json(array_slice($unik, 0, $limit + 2));
    }

    /**
     * GET /api/alamat?lat=-6.5885&lng=106.8063 — alamat untuk titik di peta (pin geser ala ojol).
     * Hasil: {nama, ket, lat, lng}. nama = tempat terdekat (≤ 35 m) atau "Jalan X No. Y".
     */
    public function alamat(Request $req): JsonResponse
    {
        $p = $this->titik($req);
        if (!$p) {
            return response()->json(['message' => 'lat & lng wajib'], 422);
        }
        [$lat, $lng] = $p;

        $poi = $this->coba(fn () => DB::selectOne("
            SELECT nama_tempat AS nama, alamat FROM naik.poi
            WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 25)
            ORDER BY geom <-> ST_SetSRID(ST_MakePoint(?, ?), 4326) LIMIT 1", [$lng, $lat, $lng, $lat]));  // tempat paling dekat dengan pin

        $a = $this->reverseNominatim($lat, $lng) ?? $this->reverseDatabase($lat, $lng);
        $jalan = trim(($a['jalan'] ?? '') . (!empty($a['nomor']) ? ' No. ' . $a['nomor'] : ''));
        $wilayah = array_values(array_unique(array_filter([$a['kel'] ?? null, $a['kec'] ?? null])));

        if ($poi) {
            $nama = $poi->nama;
            $ket = implode(', ', array_filter([$jalan ?: null, ...$wilayah])) ?: $poi->alamat;
        } else {
            $nama = $jalan ?: ($a['nama'] ?? null) ?: ($wilayah[0] ?? 'Titik di peta');
            $ket = implode(', ', array_filter([...$wilayah, $a['kota'] ?? null], fn ($x) => $x && $x !== $nama));
        }

        return response()->json(['nama' => $nama, 'ket' => $ket ?: null, 'lat' => $lat, 'lng' => $lng]);
    }

    // ------------------------------------------------------------------ pencarian

    private function dariDatabase(string $q, int $limit, ?array $dekat): array
    {
        // singkatan umum: "jl kumbang" = "jalan kumbang", "gg" = "gang"
        $singkat = ['jl' => 'jalan', 'jln' => 'jalan', 'gg' => 'gang', 'kel' => 'kelurahan', 'kec' => 'kecamatan'];
        $token = array_map(fn ($w) => $singkat[$w] ?? $w, preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($q), -1, PREG_SPLIT_NO_EMPTY));
        $teks = implode(' ', $token);
        $kata = array_slice(array_values(array_unique(array_filter(
            $token,
            fn ($w) => mb_strlen($w) >= 2 || ctype_digit($w)
        ))), 0, 5);
        if (!$kata) {
            return [];
        }
        $esc = fn ($s) => str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $s);

        $syarat = implode(' AND ', array_fill(0, count($kata), 'kata_kunci LIKE ?'));
        $diNama = implode(' AND ', array_fill(0, count($kata), 'lower(nama) LIKE ?'));
        $pola = array_map(fn ($w) => '%' . $esc($w) . '%', $kata);

        $jarak = $dekat ? 'ST_Distance(titik::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)' : 'NULL::float';
        $urut = $dekat ? 'jarak_m / (1 + bobot)' : 'bobot DESC, length(nama)';

        $sql = "
            WITH kandidat AS (
                SELECT nama_tempat AS nama, alamat AS ket, kategori AS jenis, bobot, geom AS titik FROM naik.poi WHERE $syarat
                UNION ALL
                SELECT nama, ket, jenis, bobot, titik FROM naik.gazetir WHERE $syarat
            )
            SELECT * FROM (
                SELECT nama, ket, jenis, bobot, ROUND(ST_Y(titik)::numeric, 6)::float AS lat, ROUND(ST_X(titik)::numeric, 6)::float AS lng,
                       ROUND($jarak) AS jarak_m,
                       CASE WHEN lower(nama) = ? THEN 0 WHEN lower(nama) LIKE ? THEN 1 WHEN $diNama THEN 2 ELSE 3 END AS tingkat
                FROM kandidat
            ) x
            ORDER BY tingkat, $urut
            LIMIT ?";

        $ikat = array_merge($pola, $pola, $dekat ? [$dekat[1], $dekat[0]] : [], [$teks, $esc($teks) . '%'], $pola, [$limit * 2]);

        $rows = $this->coba(fn () => DB::select($sql, $ikat), []);
        if (!$rows && $this->gazetirBelumAda()) {
            // database lama (belum migrasi gazetir/kata_kunci): cari nama saja di naik.poi
            $rows = $this->coba(fn () => DB::select("
                SELECT nama_tempat AS nama, alamat AS ket, kategori AS jenis,
                       ROUND(ST_Y(geom)::numeric, 6)::float AS lat, ROUND(ST_X(geom)::numeric, 6)::float AS lng, NULL AS jarak_m
                FROM naik.poi WHERE nama_tempat ILIKE ? LIMIT ?", ['%' . $esc($q) . '%', $limit]), []);
        }

        return array_map(fn ($r) => [
            'nama' => $r->nama,
            'ket' => $this->ketJenis($r->jenis, $r->ket),
            'jenis' => $r->jenis,
            'lat' => (float) $r->lat,
            'lng' => (float) $r->lng,
            'jarak_m' => $r->jarak_m !== null ? (int) $r->jarak_m : null,
            'sumber' => 'naik',
        ], $rows);
    }

    /** Teks kecil di bawah nama: alamat untuk tempat; "Jalan · Babakan" untuk jalan; dst. */
    private function ketJenis(string $jenis, ?string $ket): ?string
    {
        $label = ['jalan' => 'Jalan', 'kelurahan' => 'Kelurahan', 'kecamatan' => 'Kecamatan', 'perumahan' => 'Perumahan', 'wilayah' => 'Daerah'][$jenis] ?? null;
        if (!$label) {
            return $ket;
        }
        return $ket ? "$label · $ket" : $label;
    }

    private function gazetirBelumAda(): bool
    {
        return !$this->coba(fn () => DB::selectOne("SELECT to_regclass('naik.gazetir') IS NOT NULL AS ada")->ada, false);
    }

    private function dariPhoton(string $q, ?array $dekat): array
    {
        try {
            [$x1, $y1, $x2, $y2] = self::BBOX;
            $param = ['q' => $q, 'limit' => 8, 'bbox' => "$x1,$y1,$x2,$y2"];
            if ($dekat) {
                $param += ['lat' => $dekat[0], 'lon' => $dekat[1]];
            }
            $res = Http::timeout(5)->withHeaders(['User-Agent' => self::UA])->get('https://photon.komoot.io/api/', $param);
            if (!$res->successful()) {
                return [];
            }
            $out = [];
            foreach ($res->json('features') ?? [] as $f) {
                $p = $f['properties'] ?? [];
                if (empty($p['name'])) {
                    continue;
                }
                $ket = array_values(array_unique(array_filter([$p['street'] ?? null, $p['district'] ?? ($p['locality'] ?? null), $p['city'] ?? null])));
                $out[] = [
                    'nama' => $p['name'],
                    'ket' => implode(', ', $ket),
                    'jenis' => 'osm',
                    'lat' => round($f['geometry']['coordinates'][1], 6),
                    'lng' => round($f['geometry']['coordinates'][0], 6),
                    'sumber' => 'osm',
                ];
            }
            return $out;
        } catch (\Throwable $e) {
            Log::warning('Photon: ' . $e->getMessage());
            return [];
        }
    }

    private function dariNominatim(string $q): array
    {
        try {
            [$x1, $y1, $x2, $y2] = self::BBOX;
            $res = Http::timeout(6)->withHeaders(['User-Agent' => self::UA, 'Accept-Language' => 'id'])->get('https://nominatim.openstreetmap.org/search', [
                'q' => $q, 'format' => 'jsonv2', 'limit' => 6, 'countrycodes' => 'id',
                'viewbox' => "$x1,$y2,$x2,$y1", 'bounded' => 1,
            ]);
            if (!$res->successful()) {
                return [];
            }
            return array_map(function ($r) {
                $bagian = explode(', ', $r['display_name'] ?? '');
                return [
                    'nama' => $r['name'] ?: ($bagian[0] ?? 'Tempat'),
                    'ket' => implode(', ', array_slice($bagian, 1, 3)),
                    'jenis' => 'osm',
                    'lat' => round((float) $r['lat'], 6),
                    'lng' => round((float) $r['lon'], 6),
                    'sumber' => 'osm',
                ];
            }, $res->json() ?? []);
        } catch (\Throwable $e) {
            Log::warning('Nominatim: ' . $e->getMessage());
            return [];
        }
    }

    // ------------------------------------------------------------------ alamat (reverse geocoding)

    private function reverseNominatim(float $lat, float $lng): ?array
    {
        try {
            $res = Http::timeout(5)->withHeaders(['User-Agent' => self::UA, 'Accept-Language' => 'id'])
                ->get('https://nominatim.openstreetmap.org/reverse', ['lat' => $lat, 'lon' => $lng, 'format' => 'jsonv2', 'zoom' => 18, 'addressdetails' => 1]);
            if (!$res->successful() || !$res->json('address')) {
                return null;
            }
            $a = $res->json('address');
            return [
                'nama' => $res->json('name') ?: null,
                'jalan' => $a['road'] ?? ($a['pedestrian'] ?? ($a['footway'] ?? null)),
                'nomor' => $a['house_number'] ?? null,
                'kel' => $a['village'] ?? ($a['suburb'] ?? ($a['quarter'] ?? ($a['neighbourhood'] ?? ($a['hamlet'] ?? null)))),
                'kec' => $a['city_district'] ?? ($a['district'] ?? null),
                'kota' => $a['city'] ?? ($a['town'] ?? ($a['county'] ?? null)),
            ];
        } catch (\Throwable $e) {
            Log::warning('Nominatim reverse: ' . $e->getMessage());
            return null;
        }
    }

    /** Cadangan tanpa internet: jalan terdekat (≤ 150 m) + kelurahan/kecamatan dari naik.gazetir. */
    private function reverseDatabase(float $lat, float $lng): array
    {
        $pt = 'ST_SetSRID(ST_MakePoint(?, ?), 4326)';
        $jalan = $this->coba(fn () => DB::selectOne("
            SELECT nama FROM naik.gazetir WHERE jenis = 'jalan' AND ST_DWithin(geom::geography, $pt::geography, 150)
            ORDER BY geom <-> $pt LIMIT 1", [$lng, $lat, $lng, $lat])?->nama);
        $kel = $this->coba(fn () => DB::selectOne("
            SELECT nama FROM naik.gazetir WHERE jenis = 'kelurahan' AND ST_Contains(geom, $pt) LIMIT 1", [$lng, $lat])?->nama)
            ?? $this->coba(fn () => DB::selectOne("
            SELECT nama FROM naik.gazetir WHERE jenis IN ('kelurahan', 'wilayah') AND ST_DWithin(titik, $pt, 0.02)
            ORDER BY titik <-> $pt LIMIT 1", [$lng, $lat, $lng, $lat])?->nama);
        $kec = $this->coba(fn () => DB::selectOne("
            SELECT nama FROM naik.gazetir WHERE jenis = 'kecamatan' AND ST_Contains(geom, $pt) LIMIT 1", [$lng, $lat])?->nama);

        return ['jalan' => $jalan, 'kel' => $kel, 'kec' => $kec, 'kota' => 'Bogor'];
    }

    // ------------------------------------------------------------------ bantuan

    /** [lat, lng] dari query string, atau null kalau tidak ada / tidak valid. */
    private function titik(Request $req): ?array
    {
        $lat = $req->query('lat');
        $lng = $req->query('lng');
        if (!is_numeric($lat) || !is_numeric($lng)) {
            return null;
        }
        $lat = (float) $lat;
        $lng = (float) $lng;
        return ($lat >= -90 && $lat <= 90 && $lng >= -180 && $lng <= 180) ? [$lat, $lng] : null;
    }

    private function urutJarak(array $list, ?array $dekat): array
    {
        if (!$dekat) {
            return $list;
        }
        foreach ($list as &$h) {
            $h['jarak_m'] = (int) round($this->haversine($dekat[0], $dekat[1], $h['lat'], $h['lng']));
        }
        unset($h);
        usort($list, fn ($a, $b) => $a['jarak_m'] <=> $b['jarak_m']);
        return $list;
    }

    private function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return 2 * $r * asin(min(1, sqrt($a)));
    }

    /** Jalankan query; kalau gagal (mis. tabel belum dimigrasi) kembalikan $default dan catat di log. */
    private function coba(callable $f, $default = null)
    {
        try {
            return $f();
        } catch (\Throwable $e) {
            Log::warning('PoiController: ' . $e->getMessage());
            return $default;
        }
    }
}
