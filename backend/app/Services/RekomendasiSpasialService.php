<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class RekomendasiSpasialService
{
    /**
     * Normalisasi format kode trayek (contoh: "08" -> "Trayek 08").
     */
    public function formatKodeTrayek(string $kode): string
    {
        $kode = trim(urldecode($kode));

        if (stripos($kode, 'trayek') === 0) {
            return 'Trayek ' . trim(substr($kode, 6));
        }

        if (preg_match('/^(\d+)([A-Za-z]*)$/', $kode, $m)) {
            return 'Trayek ' . str_pad($m[1], 2, '0', STR_PAD_LEFT) . strtoupper($m[2]);
        }

        return $kode;
    }

    /**
     * Cari entitas trayek dari database berdasarkan kode.
     */
    public function findTrayek(string $kode): ?object
    {
        $normalized = $this->formatKodeTrayek($kode);

        return DB::selectOne("
            SELECT r.kode_trayek, MIN(r.nama_trayek) AS nama_trayek
            FROM naik.rute r
            WHERE r.kode_trayek = ?
            GROUP BY r.kode_trayek
        ", [$normalized]);
    }

    /**
     * Ambil POI di sepanjang koridor spasial rute trayek berdasarkan buffer radius.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getKoridorPoi(string $kodeTrayek, int $radiusM = 300, ?string $kategori = null, int $limit = 30): array
    {
        $kode = $this->formatKodeTrayek($kodeTrayek);
        $radiusM = min(max($radiusM, 50), 1000);
        $limit = min(max($limit, 1), 100);

        $sql = "
            WITH hits AS (
                SELECT p.nama_tempat,
                       MIN(p.poi_id) AS poi_id,
                       MIN(p.osm_id) AS osm_id,
                       p.kategori,
                       MIN(p.sub_kategori) AS sub_kategori,
                       MIN(p.alamat) AS alamat,
                       MIN(ST_Distance(g.geom::geography, p.geom::geography)) AS dist_m,
                       ST_Y(p.geom) AS lat,
                       ST_X(p.geom) AS lon
                FROM naik.rute r
                JOIN naik.rute_geometri g ON g.rute_id = r.rute_id
                JOIN naik.poi p ON ST_DWithin(g.geom::geography, p.geom::geography, ?)
                WHERE r.kode_trayek = ?
                  AND (?::text IS NULL OR p.kategori = ?)
                GROUP BY p.nama_tempat, p.kategori, p.geom
            )
            SELECT poi_id, osm_id, nama_tempat, kategori, sub_kategori, alamat,
                   ROUND(MIN(dist_m)) AS jarak_ke_jalur_m, lat, lon
            FROM hits
            GROUP BY poi_id, osm_id, nama_tempat, kategori, sub_kategori, alamat, lat, lon
            ORDER BY jarak_ke_jalur_m ASC
            LIMIT ?
        ";

        $rows = DB::select($sql, [$radiusM, $kode, $kategori, $kategori, $limit]);

        return array_map(function ($row) {
            return [
                'poi_id' => (int) $row->poi_id,
                'osm_id' => $row->osm_id ? (int) $row->osm_id : null,
                'nama' => $row->nama_tempat,
                'kategori' => $row->kategori,
                'sub_kategori' => $row->sub_kategori,
                'alamat' => $row->alamat,
                'jarak_ke_jalur_m' => (int) $row->jarak_ke_jalur_m,
                'koordinat' => [
                    'lat' => (float) $row->lat,
                    'lon' => (float) $row->lon,
                ],
            ];
        }, $rows);
    }

    /**
     * Ambil POI terdekat dari titik koordinat tertentu.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getNearestPoi(float $lat, float $lon, int $radiusM = 500, int $limit = 10): array
    {
        $radiusM = min(max($radiusM, 50), 2000);
        $limit = min(max($limit, 1), 50);

        $sql = "
            SELECT p.poi_id,
                   p.nama_tempat,
                   p.kategori,
                   p.sub_kategori,
                   ROUND(ST_Distance(p.geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)) AS jarak_m,
                   ST_Y(p.geom) AS lat,
                   ST_X(p.geom) AS lon
            FROM naik.poi p
            WHERE ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)
            ORDER BY jarak_m ASC
            LIMIT ?
        ";

        $rows = DB::select($sql, [$lon, $lat, $lon, $lat, $radiusM, $limit]);

        return array_map(function ($row) {
            return [
                'poi_id' => (int) $row->poi_id,
                'nama' => $row->nama_tempat,
                'kategori' => $row->kategori,
                'sub_kategori' => $row->sub_kategori,
                'jarak_m' => (int) $row->jarak_m,
                'koordinat' => [
                    'lat' => (float) $row->lat,
                    'lon' => (float) $row->lon,
                ],
            ];
        }, $rows);
    }
}
