<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TrayekController extends Controller
{
    /** Ekspresi garis tunggal dari MultiLineString (dipakai ST_LineLocatePoint). */
    private const LINE = "CASE WHEN GeometryType(ST_LineMerge(g.geom)) = 'LINESTRING'
                               THEN ST_LineMerge(g.geom) ELSE ST_GeometryN(ST_LineMerge(g.geom), 1) END";

    /** "08" / "8" / "Trayek 08" / "07A" -> "Trayek 08" / "Trayek 07A" */
    private function kode(string $k): string
    {
        $k = trim(urldecode($k));
        if (stripos($k, 'trayek') === 0) {
            return 'Trayek ' . trim(substr($k, 6));
        }
        if (preg_match('/^(\d+)([A-Za-z]*)$/', $k, $m)) {
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

    /** GET /api/trayek — daftar trayek (buat dropdown filter & legenda). */
    public function trayek(): JsonResponse
    {
        $rows = DB::select("
            SELECT r.kode_trayek, MIN(r.nama_trayek) AS nama_trayek,
                   '#' || substr(md5(r.kode_trayek), 1, 6) AS warna,
                   json_agg(json_build_object('rute_id', r.rute_id, 'arah', r.arah,
                            'asal', r.asal, 'tujuan', r.tujuan) ORDER BY r.rute_id) AS arah,
                   MAX(t.tarif) AS tarif, MIN(s.nama_sumber) AS sumber
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
                        'warna', v.warna, 'panjang_m', v.panjang_m, 'tarif', t.tarif)
                   ) ORDER BY v.rute_id), '[]'::json))::text AS fc
            FROM naik.v_rute_peta v
            LEFT JOIN naik.tarif_rute t ON t.kode_trayek = v.kode_trayek
            WHERE (?::text IS NULL OR v.kode_trayek = ?)", [$kode, $kode]);
        return $this->geojson($row->fc);
    }

    /** GET /api/trayek/{kode} — detail satu trayek: arah, lintasan, urutan jalan, tarif. */
    public function detail(string $kode): JsonResponse
    {
        $kode = $this->kode($kode);
        $rute = DB::select("
            SELECT r.rute_id, r.arah, r.nama_trayek, r.asal, r.tujuan, r.lintasan,
                   g.panjang_m, s.nama_sumber AS sumber
            FROM naik.rute r
            JOIN naik.rute_geometri g ON g.rute_id = r.rute_id
            LEFT JOIN naik.sumber_data s ON s.sumber_id = r.sumber_id
            WHERE r.kode_trayek = ? ORDER BY r.rute_id", [$kode]);
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
            $r->panjang_m = (float) $r->panjang_m;
            $r->halte = explode(' > ', $r->lintasan);
            unset($r->lintasan);
        }
        $tarif = DB::selectOne("SELECT tarif, keterangan FROM naik.tarif_rute WHERE kode_trayek = ?", [$kode]);
        return response()->json([
            'kode_trayek' => $kode,
            'warna' => '#' . substr(md5($kode), 0, 6),
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
     * GET /api/rekomendasi?asal=-6.59,106.79&tujuan=-6.57,106.81&radius=400
     * Rute langsung (1 angkot) dan rute 1x transfer (2 angkot), urut dari yang paling enak.
     */
    public function rekomendasi(Request $req): JsonResponse
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
        $rad = min(max((float) $req->query('radius', 400), 100), 1500);   // jarak jalan kaki maks ke jalur (m)
        $params = [$a[1], $a[0], $b[1], $b[0], $rad];
        $line = self::LINE;

        $base = "
            p AS (SELECT ST_SetSRID(ST_MakePoint(?, ?), 4326) AS a,
                         ST_SetSRID(ST_MakePoint(?, ?), 4326) AS b, ?::float8 AS rad),
            r AS (SELECT ru.rute_id, ru.kode_trayek, ru.arah, ru.nama_trayek, $line AS line
                  FROM naik.rute ru JOIN naik.rute_geometri g ON g.rute_id = ru.rute_id),
            ra AS (SELECT r.*, ST_LineLocatePoint(r.line, p.a) AS pa,
                          ST_Distance(r.line::geography, p.a::geography) AS da
                   FROM r, p WHERE ST_DWithin(r.line::geography, p.a::geography, p.rad)),
            rb AS (SELECT r.*, ST_LineLocatePoint(r.line, p.b) AS pb,
                          ST_Distance(r.line::geography, p.b::geography) AS db
                   FROM r, p WHERE ST_DWithin(r.line::geography, p.b::geography, p.rad))";

        // ---- 1 angkot ----
        $langsung = DB::select("
            WITH $base
            SELECT ra.rute_id, ra.kode_trayek, ra.arah, ra.nama_trayek,
                   ROUND(ra.da) AS jalan_ke_naik_m, ROUND(rb.db) AS jalan_dari_turun_m,
                   ROUND(ST_Length(ST_LineSubstring(ra.line, ra.pa, rb.pb)::geography)) AS jarak_angkot_m,
                   ST_AsGeoJSON(ST_LineSubstring(ra.line, ra.pa, rb.pb), 6) AS segmen,
                   t.tarif
            FROM ra JOIN rb ON rb.rute_id = ra.rute_id AND ra.pa < rb.pb
            LEFT JOIN naik.tarif_rute t ON t.kode_trayek = ra.kode_trayek
            ORDER BY ra.da + rb.db + 0.2 * ST_Length(ST_LineSubstring(ra.line, ra.pa, rb.pb)::geography)
            LIMIT 5", $params);

        // ---- 2 angkot (1x transfer di titik_transfer) ----
        $transfer = DB::select("
            WITH $base,
            c AS (
              SELECT ra.rute_id AS ra_id, ra.kode_trayek AS ka, ra.arah AS arah_a, ra.line AS la, ra.pa, ra.da,
                     rb.rute_id AS rb_id, rb.kode_trayek AS kb, rb.arah AS arah_b, rb.line AS lb, rb.pb, rb.db,
                     tt.transfer_id, tt.geom AS tg,
                     ST_LineLocatePoint(ra.line, tt.geom) AS ta, ST_LineLocatePoint(rb.line, tt.geom) AS tb
              FROM ra JOIN rb ON rb.kode_trayek <> ra.kode_trayek
              JOIN naik.titik_transfer tt
                ON (tt.trayek_a = ra.kode_trayek AND tt.trayek_b = rb.kode_trayek)
                OR (tt.trayek_a = rb.kode_trayek AND tt.trayek_b = ra.kode_trayek)
              WHERE NOT EXISTS (SELECT 1 FROM rb x WHERE x.rute_id = ra.rute_id)   -- kalau 1 angkot cukup, skip
            ), s AS (
              SELECT c.*, ST_Length(ST_LineSubstring(la, pa, ta)::geography) AS len_a,
                          ST_Length(ST_LineSubstring(lb, tb, pb)::geography) AS len_b
              FROM c WHERE pa < ta AND tb < pb
            ), s2 AS (
              SELECT * FROM s WHERE len_a >= 300 AND len_b >= 300   -- naik angkot < 300 m mending jalan kaki
            ), best AS (
              SELECT DISTINCT ON (ka, kb) * FROM s2 ORDER BY ka, kb, da + db + 0.2 * (len_a + len_b)
            )
            SELECT ka AS kode_1, arah_a AS arah_1, kb AS kode_2, arah_b AS arah_2,
                   ROUND(da) AS jalan_ke_naik_m, ROUND(db) AS jalan_dari_turun_m,
                   ROUND(len_a) AS jarak_angkot_1_m, ROUND(len_b) AS jarak_angkot_2_m,
                   ST_AsGeoJSON(tg, 6) AS titik_transfer,
                   ST_AsGeoJSON(ST_LineSubstring(la, pa, ta), 6) AS segmen_1,
                   ST_AsGeoJSON(ST_LineSubstring(lb, tb, pb), 6) AS segmen_2,
                   COALESCE(t1.tarif, 0) + COALESCE(t2.tarif, 0) AS tarif
            FROM best
            LEFT JOIN naik.tarif_rute t1 ON t1.kode_trayek = ka
            LEFT JOIN naik.tarif_rute t2 ON t2.kode_trayek = kb
            ORDER BY da + db + 0.2 * (len_a + len_b) + 300   -- penalti 300 m per transfer
            LIMIT 5", $params);

        foreach (array_merge($langsung, $transfer) as $o) {
            foreach (['segmen', 'segmen_1', 'segmen_2', 'titik_transfer'] as $f) {
                if (isset($o->$f)) {
                    $o->$f = json_decode($o->$f);
                }
            }
            $o->tarif = $o->tarif !== null ? (int) $o->tarif : null;
            foreach (['jalan_ke_naik_m', 'jalan_dari_turun_m', 'jarak_angkot_m', 'jarak_angkot_1_m', 'jarak_angkot_2_m'] as $f) {
                if (isset($o->$f)) {
                    $o->$f = (int) $o->$f;
                }
            }
        }

        return response()->json([
            'asal' => ['lat' => $a[0], 'lon' => $a[1]],
            'tujuan' => ['lat' => $b[0], 'lon' => $b[1]],
            'radius_jalan_kaki_m' => $rad,
            'langsung' => $langsung,
            'transfer' => $transfer,
            'catatan' => 'Tarif asumsi flat per angkot; jarak jalan kaki = jarak garis lurus ke jalur.',
        ]);
    }
}