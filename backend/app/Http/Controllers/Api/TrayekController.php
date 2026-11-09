<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PencariRuteDijkstra;
use App\Services\RekomendasiRoutingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * API data NAIK (Navigasi Angkot) — baca langsung dari schema PostGIS "naik".
 * Semua koordinat EPSG:4326 (lon, lat). GeoJSON dibangun di PostgreSQL biar cepat.
 */
class TrayekController extends Controller
{
    /** Ekspresi garis tunggal dari MultiLineString (dipakai ST_LineLocatePoint). */
    /** Tarif flat yang paling banyak dipakai di naik.tarif_rute (default Rp5.000) untuk trayek yang belum diisi. */
    private const TARIF_UMUM = "SELECT COALESCE((SELECT tarif FROM naik.tarif_rute WHERE tarif IS NOT NULL
                                 GROUP BY tarif ORDER BY COUNT(*) DESC, tarif LIMIT 1), 5000) AS tarif";

    private const LINE = "CASE WHEN GeometryType(ST_LineMerge(g.geom)) = 'LINESTRING'
                               THEN ST_LineMerge(g.geom) ELSE ST_GeometryN(ST_LineMerge(g.geom), 1) END";

    public function __construct(
        protected ?RekomendasiRoutingService $routingService = null
    ) {
        $this->routingService = $routingService ?? app(RekomendasiRoutingService::class);
    }

    /** "08" / "8" / "Trayek 08" / "07A" -> "Trayek 08" / "Trayek 07A" */
    private function kode(string $k): string
    {
        $k = trim(urldecode($k));
        if (stripos($k, 'trayek') === 0) {
            return 'Trayek ' . trim(substr($k, 6));
        }
        if (preg_match('/^0*(\d+)([A-Za-z]*)$/', $k, $m)) {
            return 'Trayek ' . str_pad($m[1], 2, '0', STR_PAD_LEFT) . strtoupper($m[2]);
        }
        return $k;
    }

    private function geojson(?string $json): JsonResponse
    {
        return response()->json(json_decode($json ?? '{"type":"FeatureCollection","features":[]}'));
    }

    /** Gabung ruas berurutan bernama sama; buang potongan jalan samping yang pendek (< 40 m). */
    private function urutanJalan(array $ruas): array
    {
        $grup = [];
        foreach ($ruas as $j) {
            $n = count($grup);
            if ($n && $grup[$n - 1]['nama'] === $j->nama) {
                $grup[$n - 1]['m'] += (float) $j->panjang_m;
            } else {
                $grup[] = ['nama' => $j->nama, 'm' => (float) $j->panjang_m];
            }
        }
        $out = [];
        foreach ($grup as $g) {
            if ($g['m'] < 40) {
                continue;
            }
            if (!$out || end($out) !== $g['nama']) {
                $out[] = $g['nama'];
            }
        }
        return $out;
    }

    /**
     * Titik tiap jalan yang dilewati rute (urut): nama jalan + koordinat tengah jalan itu.
     * Ruas berurutan bernama sama digabung; potongan < 40 m dibuang (sama seperti urutanJalan).
     */
    private function titikJalan(int $ruteId): array
    {
        try {
            $rows = DB::select("
                SELECT j.nama_tampil AS nama, j.panjang_m,
                       ST_Y(ST_ClosestPoint(k.geom, ST_Centroid(k.geom))) AS lat,
                       ST_X(ST_ClosestPoint(k.geom, ST_Centroid(k.geom))) AS lng
                FROM naik.rute_ruas_jalan rr
                JOIN naik.ruas_jalan j ON j.ruas_id = rr.ruas_id
                JOIN naik.v_ruas_kepadatan k ON k.ruas_id = rr.ruas_id
                WHERE rr.rute_id = ? ORDER BY rr.urutan", [$ruteId]);

            $grup = [];
            foreach ($rows as $j) {
                $n = count($grup);
                if ($n && $grup[$n - 1]['nama'] === $j->nama) {
                    $grup[$n - 1]['m'] += (float) $j->panjang_m;
                } else {
                    $grup[] = ['nama' => $j->nama, 'm' => (float) $j->panjang_m, 'lat' => (float) $j->lat, 'lng' => (float) $j->lng];
                }
            }
            $out = [];
            foreach ($grup as $g) {
                if ($g['m'] < 40) {
                    continue;
                }
                if ($out && end($out)['nama'] === $g['nama']) {
                    continue;
                }
                $out[] = ['nama' => $g['nama'], 'lat' => $g['lat'], 'lng' => $g['lng']];
            }
            return $out;
        } catch (\Throwable $e) {
            return [];
        }
    }

    /** GET /api/trayek — daftar trayek (buat dropdown filter & legenda). */
    public function trayek(): JsonResponse
    {
        $rows = DB::select("
            SELECT r.kode_trayek, MIN(r.nama_trayek) AS nama_trayek,
                   '#' || substr(md5(r.kode_trayek), 1, 6) AS warna,
                   json_agg(json_build_object('rute_id', r.rute_id, 'arah', r.arah,
                            'asal', r.asal, 'tujuan', r.tujuan) ORDER BY r.rute_id) AS arah,
                   COALESCE(MAX(t.tarif), (" . self::TARIF_UMUM . ")) AS tarif, MIN(s.nama_sumber) AS sumber
            FROM naik.rute r
            LEFT JOIN naik.tarif_rute t ON t.kode_trayek = r.kode_trayek
            LEFT JOIN naik.sumber_data s ON s.sumber_id = r.sumber_id
            GROUP BY r.kode_trayek
            ORDER BY r.kode_trayek");
        foreach ($rows as $r) {
            $r->arah = json_decode($r->arah);
            $r->tarif = $r->tarif !== null ? (int) $r->tarif : null;
        }
        return response()->json($rows);
    }

    /** GET /api/rute?kode=08 — semua rute (GeoJSON), opsional filter kode trayek. */
    public function rute(Request $req): JsonResponse
    {
        $kode = $req->filled('kode') ? $this->kode($req->query('kode')) : null;
        $row = DB::selectOne("
            SELECT json_build_object('type', 'FeatureCollection', 'features', COALESCE(json_agg(json_build_object(
                     'type', 'Feature',
                     'geometry', ST_AsGeoJSON(v.geom, 6)::json,
                     'properties', json_build_object(
                        'rute_id', v.rute_id, 'kode_trayek', v.kode_trayek, 'arah', v.arah,
                        'nama_trayek', v.nama_trayek, 'asal', v.asal, 'tujuan', v.tujuan,
                        'warna', v.warna, 'panjang_m', v.panjang_m, 'tarif', COALESCE(t.tarif, d.tarif))
                   ) ORDER BY v.rute_id), '[]'::json))::text AS fc
            FROM naik.v_rute_peta v
            LEFT JOIN naik.tarif_rute t ON t.kode_trayek = v.kode_trayek
            CROSS JOIN (" . self::TARIF_UMUM . ") d
            WHERE (?::text IS NULL OR v.kode_trayek = ?)", [$kode, $kode]);
        return $this->geojson($row->fc);
    }

    /** GET /api/trayek/{kode} — detail satu trayek: arah, lintasan, urutan jalan, tarif. */
    public function detail(string $kode): JsonResponse
    {
        $input = trim(urldecode($kode));
        $kodeTrayek = $this->kode($input);

        // Cari dengan beberapa variasi kode: persis input, hasil format kode(), atau tanpa prefix
        $rute = DB::select("
            SELECT r.rute_id, r.arah, r.nama_trayek, r.asal, r.tujuan, r.lintasan,
                   g.panjang_m, s.nama_sumber AS sumber
            FROM naik.rute r
            JOIN naik.rute_geometri g ON g.rute_id = r.rute_id
            LEFT JOIN naik.sumber_data s ON s.sumber_id = r.sumber_id
            WHERE r.kode_trayek = ? 
               OR r.kode_trayek = ?
               OR LOWER(r.kode_trayek) = LOWER(?)
               OR regexp_replace(r.kode_trayek, '^Trayek\s*', '', 'i') = regexp_replace(?, '^Trayek\s*', '', 'i')
            ORDER BY r.rute_id", [$input, $kodeTrayek, $input, $input]);

        if (!$rute) {
            return response()->json(['message' => "Trayek $kode tidak ditemukan"], 404);
        }
        foreach ($rute as $r) {
            // urutan nama jalan (ruas berurutan dengan nama sama digabung)
            $jalan = DB::select("
                SELECT j.nama_tampil AS nama, j.panjang_m
                FROM naik.rute_ruas_jalan rr JOIN naik.ruas_jalan j ON j.ruas_id = rr.ruas_id
                WHERE rr.rute_id = ? ORDER BY rr.urutan", [$r->rute_id]);
            $r->urutan_jalan = $this->urutanJalan($jalan);
            $r->titik_jalan = $this->titikJalan($r->rute_id);
            $r->panjang_m = (float) $r->panjang_m;
            $r->halte = explode(' > ', $r->lintasan);
            unset($r->lintasan);
        }
        $kodeDb = $rute[0]->kode_trayek ?? $kodeTrayek;
        $tarif = DB::selectOne("SELECT tarif, keterangan FROM naik.tarif_rute WHERE kode_trayek = ? OR kode_trayek = ?", [$kodeDb, $input]);
        if (!$tarif || $tarif->tarif === null) {
            $tarif = (object) ['tarif' => DB::selectOne(self::TARIF_UMUM)->tarif,
                               'keterangan' => $tarif->keterangan ?? 'Tarif umum angkot Kota Bogor'];
        }
        return response()->json([
            'kode_trayek' => $kodeDb,
            'warna' => '#' . substr(md5($kodeDb), 0, 6),
            'tarif' => $tarif ? (int) $tarif->tarif : null,
            'keterangan_tarif' => $tarif->keterangan ?? null,
            'rute' => $rute,
        ]);
    }

    /** GET /api/kepadatan?tingkat=Tinggi&bbox=minLon,minLat,maxLon,maxLat — ruas + kelas kepadatan (GeoJSON). */
    public function kepadatan(Request $req): JsonResponse
    {
        $tingkat = $req->filled('tingkat') ? ucfirst(strtolower($req->query('tingkat'))) : null;
        $bbox = null;
        if ($req->filled('bbox')) {
            $b = array_map('floatval', explode(',', $req->query('bbox')));
            if (count($b) !== 4) {
                return response()->json(['message' => 'bbox harus minLon,minLat,maxLon,maxLat'], 422);
            }
            $bbox = $b;
        }
        $row = DB::selectOne("
            SELECT json_build_object('type', 'FeatureCollection', 'features', COALESCE(json_agg(json_build_object(
                     'type', 'Feature',
                     'geometry', ST_AsGeoJSON(k.geom, 6)::json,
                     'properties', json_build_object(
                        'ruas_id', k.ruas_id, 'nama_jalan', k.nama_jalan, 'nama_osm', k.nama_osm,
                        'kelas_jalan', k.kelas_jalan, 'panjang_m', k.panjang_m,
                        'jumlah_trayek', k.jumlah_rute, 'tingkat', k.tingkat_kepadatan, 'trayek', k.trayek)
                   )), '[]'::json))::text AS fc
            FROM naik.v_ruas_kepadatan k
            WHERE (?::text IS NULL OR k.tingkat_kepadatan = ?)
              AND (?::float8 IS NULL OR k.geom && ST_MakeEnvelope(?, ?, ?, ?, 4326))",
            [$tingkat, $tingkat, $bbox[0] ?? null, $bbox[0] ?? null, $bbox[1] ?? null, $bbox[2] ?? null, $bbox[3] ?? null]);
        return $this->geojson($row->fc);
    }

    /** GET /api/kepadatan/ringkasan — total km per kelas + jalan paling padat. */
    public function ringkasan(): JsonResponse
    {
        $kelas = DB::select("
            SELECT tingkat_kepadatan AS tingkat, COUNT(*) AS ruas, ROUND(SUM(panjang_m) / 1000.0, 2) AS km
            FROM naik.v_ruas_kepadatan GROUP BY 1
            ORDER BY CASE tingkat_kepadatan WHEN 'Tinggi' THEN 1 WHEN 'Sedang' THEN 2 ELSE 3 END");
        $top = DB::select("
            SELECT nama_jalan, MAX(jumlah_rute) AS maks_trayek,
                   ROUND(SUM(panjang_m) FILTER (WHERE jumlah_rute >= 2) / 1000.0, 2) AS km_overlap
            FROM naik.v_ruas_kepadatan
            WHERE nama_jalan NOT LIKE 'Jalan lingkungan%' AND nama_jalan NOT LIKE 'Jalan akses%'
              AND nama_jalan NOT LIKE 'Jalan lokal%' AND nama_jalan NOT LIKE 'Jalan penghubung%'
            GROUP BY nama_jalan
            HAVING MAX(jumlah_rute) >= 2 AND COALESCE(SUM(panjang_m) FILTER (WHERE jumlah_rute >= 2), 0) >= 100
            ORDER BY maks_trayek DESC, km_overlap DESC LIMIT 10");
        return response()->json(['kelas' => $kelas, 'jalan_terpadat' => $top]);
    }

    /**
     * Garis rute siap hitung (UTM 48S, meter) + posisi titik transfer di tiap rute.
     */
    private function siapkanGarisRute(): void
    {
        $this->routingService->siapkanGarisRute();
    }

    /**
     * GET /api/rekomendasi?asal=-6.59,106.79&tujuan=-6.57,106.81[&radius=800]
     * Rute langsung (1 angkot) dan 1x pindah (2 angkot), diurutkan dari perkiraan waktu tempuh tercepat.
     * Jarak jalan kaki otomatis: semua jalur sampai `radius` (default 800 m) dipertimbangkan, tapi
     * jalan kaki dihitung lambat (75 m/menit) sehingga jalur yang dekat tetap menang.
     */
    /**
     * Rekomendasi rute: Dijkstra + Yen pada graf trayek (lihat App\Services\PencariRuteDijkstra).
     * Maksimal 3 angkot. ?metode=lama memakai pencarian lama (langsung + 1x pindah) sebagai pembanding.
     */
    public function rekomendasi(Request $req): JsonResponse
    {
        if ($req->query('metode') === 'lama') {
            return $this->rekomendasiLama($req);
        }
        $parse = function (?string $s) {
            $p = array_map('trim', explode(',', (string) $s));
            return (count($p) === 2 && is_numeric($p[0]) && is_numeric($p[1])) ? [(float) $p[0], (float) $p[1]] : null;
        };
        $a = $parse($req->query('asal'));
        $b = $parse($req->query('tujuan'));
        if (!$a || !$b) {
            return response()->json(['message' => 'Format: asal=lat,lon&tujuan=lat,lon'], 422);
        }
        $rad = min(max((float) $req->query('radius', 800), 100), 1500);

        $hasil = $this->routingService->cariRute($a, $b, $rad);

        return response()->json($hasil);
    }

    /** Pencarian lama: langsung + 1x pindah dengan SQL (dipakai sebagai pembanding, ?metode=lama). */
    private function rekomendasiLama(Request $req): JsonResponse
    {
        $parse = function (?string $s) {
            $p = array_map('trim', explode(',', (string) $s));
            return (count($p) === 2 && is_numeric($p[0]) && is_numeric($p[1])) ? [(float) $p[0], (float) $p[1]] : null;
        };
        $a = $parse($req->query('asal'));
        $b = $parse($req->query('tujuan'));
        if (!$a || !$b) {
            return response()->json(['message' => 'Format: asal=lat,lon&tujuan=lat,lon'], 422);
        }
        $rad = min(max((float) $req->query('radius', 800), 100), 1500);   // jarak jalan kaki maks ke jalur (m)
        $this->siapkanGarisRute();

        // perkiraan waktu (menit): jalan kaki 75 m/mnt (4,5 km/jam), angkot 250 m/mnt (15 km/jam), tunggu 5 mnt/angkot
        $JALAN = 75.0;
        $ANGKOT = 250.0;
        $TUNGGU = 5.0;
        $PINDAH = 250.0;   // jarak maks titik pindah ke jalur tiap angkot (m), jadi jalan kaki pindah <= ±500 m
        $params = [$a[1], $a[0], $b[1], $b[0], $rad];
        $base = "
            p AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(?, ?), 4326), 32748) AS a,
                         ST_Transform(ST_SetSRID(ST_MakePoint(?, ?), 4326), 32748) AS b, ?::float8 AS rad),
            ra AS (SELECT r.rute_id, r.kode_trayek, ru.arah, ru.nama_trayek, r.g, r.len,
                          ST_LineLocatePoint(r.g, p.a) AS pa, ST_Distance(r.g, p.a) AS da
                   FROM naik.mv_rute_garis r JOIN naik.rute ru ON ru.rute_id = r.rute_id, p
                   WHERE ST_DWithin(r.g, p.a, p.rad)),
            rb AS (SELECT r.rute_id, r.kode_trayek, ru.arah, r.g, r.len,
                          ST_LineLocatePoint(r.g, p.b) AS pb, ST_Distance(r.g, p.b) AS db
                   FROM naik.mv_rute_garis r JOIN naik.rute ru ON ru.rute_id = r.rute_id, p
                   WHERE ST_DWithin(r.g, p.b, p.rad))";

        // ---- 1 angkot: satu pilihan terbaik per trayek ----
        $langsung = DB::select("
            WITH $base,
            c AS (
              SELECT ra.rute_id, ra.kode_trayek, ra.arah, ra.nama_trayek, ra.g, ra.pa, rb.pb, ra.da, rb.db,
                     (rb.pb - ra.pa) * ra.len AS len,
                     (ra.da + rb.db) / $JALAN + (rb.pb - ra.pa) * ra.len / $ANGKOT + $TUNGGU AS menit
              FROM ra JOIN rb ON rb.rute_id = ra.rute_id AND ra.pa < rb.pb
            ), best AS (
              SELECT DISTINCT ON (kode_trayek) * FROM c ORDER BY kode_trayek, menit
            )
            SELECT best.rute_id, best.kode_trayek, best.arah, best.nama_trayek,
                   ROUND(da) AS jalan_ke_naik_m, ROUND(db) AS jalan_dari_turun_m, ROUND(len) AS jarak_angkot_m,
                   ROUND(menit) AS menit,
                   ST_AsGeoJSON(ST_Transform(ST_LineSubstring(g, pa, pb), 4326), 6) AS segmen,
                   COALESCE(t.tarif, d.tarif) AS tarif
            FROM best LEFT JOIN naik.tarif_rute t ON t.kode_trayek = best.kode_trayek
            CROSS JOIN (" . self::TARIF_UMUM . ") d
            ORDER BY best.menit
            LIMIT 5", $params);

        // ---- 2 angkot: pindah di titik_transfer (posisinya di tiap rute sudah dihitung di mv_transfer_rute) ----
        $transfer = DB::select("
            WITH $base,
            ta AS (   -- titik pindah yang dilewati SETELAH naik di rute pertama
              SELECT ra.*, x.transfer_id, x.f AS fa, x.d AS dxa
              FROM ra JOIN naik.mv_transfer_rute x ON x.rute_id = ra.rute_id AND x.f > ra.pa
                                               AND x.d <= $PINDAH   -- titik pindah harus dekat jalur ini
              WHERE NOT EXISTS (SELECT 1 FROM rb WHERE rb.rute_id = ra.rute_id AND rb.pb > ra.pa)  -- 1 angkot cukup
            ), tb AS ( -- titik pindah yang dilewati SEBELUM turun di rute kedua
              SELECT rb.*, y.transfer_id, y.f AS fb, y.d AS dyb
              FROM rb JOIN naik.mv_transfer_rute y ON y.rute_id = rb.rute_id AND y.f < rb.pb AND y.d <= $PINDAH
            ), c AS (
              SELECT ta.kode_trayek AS ka, ta.arah AS arah_1, ta.g AS ga, ta.pa, ta.fa, ta.da,
                     tb.kode_trayek AS kb, tb.arah AS arah_2, tb.g AS gb, tb.fb, tb.pb, tb.db,
                     ta.transfer_id, ta.dxa + tb.dyb AS dt,
                     (ta.fa - ta.pa) * ta.len AS len_a, (tb.pb - tb.fb) * tb.len AS len_b
              FROM ta JOIN tb ON tb.transfer_id = ta.transfer_id AND tb.kode_trayek <> ta.kode_trayek
            ), s AS (
              SELECT *, (da + db + dt) / $JALAN + (len_a + len_b) / $ANGKOT + 2 * $TUNGGU AS menit
              FROM c WHERE len_a >= 300 AND len_b >= 300   -- naik angkot < 300 m mending jalan kaki
            ), best AS (
              SELECT DISTINCT ON (ka, kb) * FROM s ORDER BY ka, kb, menit
            )
            SELECT ka AS kode_1, arah_1, kb AS kode_2, arah_2,
                   ROUND(da) AS jalan_ke_naik_m, ROUND(db) AS jalan_dari_turun_m, ROUND(dt) AS jalan_pindah_m,
                   ROUND(len_a) AS jarak_angkot_1_m, ROUND(len_b) AS jarak_angkot_2_m, ROUND(menit) AS menit,
                   ST_AsGeoJSON(tt.geom, 6) AS titik_transfer,
                   ST_AsGeoJSON(ST_Transform(ST_LineSubstring(ga, pa, fa), 4326), 6) AS segmen_1,
                   ST_AsGeoJSON(ST_Transform(ST_LineSubstring(gb, fb, pb), 4326), 6) AS segmen_2,
                   COALESCE(t1.tarif, d.tarif) + COALESCE(t2.tarif, d.tarif) AS tarif
            FROM best
            JOIN naik.titik_transfer tt ON tt.transfer_id = best.transfer_id
            CROSS JOIN (" . self::TARIF_UMUM . ") d
            LEFT JOIN naik.tarif_rute t1 ON t1.kode_trayek = ka
            LEFT JOIN naik.tarif_rute t2 ON t2.kode_trayek = kb
            ORDER BY menit
            LIMIT 5", $params);

        foreach (array_merge($langsung, $transfer) as $o) {
            foreach (['segmen', 'segmen_1', 'segmen_2', 'titik_transfer'] as $f) {
                if (isset($o->$f)) {
                    $o->$f = json_decode($o->$f);
                }
            }
            $o->tarif = $o->tarif !== null ? (int) $o->tarif : null;
            foreach (['jalan_ke_naik_m', 'jalan_dari_turun_m', 'jalan_pindah_m', 'jarak_angkot_m',
                      'jarak_angkot_1_m', 'jarak_angkot_2_m', 'menit'] as $f) {
                if (isset($o->$f)) {
                    $o->$f = (int) $o->$f;
                }
            }
        }

        // kalau sudah ada angkot langsung, opsi pindah hanya ditampilkan bila waktunya bersaing (selisih <= 5 menit)
        if ($langsung) {
            $tercepat = min(array_map(fn ($o) => $o->menit, $langsung));
            $transfer = array_values(array_filter($transfer, fn ($o) => $o->menit <= $tercepat + 5));
        }

        $lurus = DB::selectOne("SELECT ROUND(ST_Distance(ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
                                                         ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)) AS m",
            [$a[1], $a[0], $b[1], $b[0]]);

        return response()->json([
            'asal' => ['lat' => $a[0], 'lon' => $a[1]],
            'tujuan' => ['lat' => $b[0], 'lon' => $b[1]],
            'radius_jalan_kaki_m' => $rad,
            'jarak_lurus_m' => (int) $lurus->m,
            'langsung' => $langsung,
            'transfer' => $transfer,
            'catatan' => 'Urut dari perkiraan waktu: jalan kaki 4,5 km/jam, angkot 15 km/jam, tunggu 5 menit per angkot. Tarif flat per angkot.',
        ]);
    }
}