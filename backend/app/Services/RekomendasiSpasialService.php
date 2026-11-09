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
    public function getKoridorPoi(string $kodeTrayek, int $radiusM = 300, ?string $kategori = null, int $limit = 30, ?int $ruteId = null): array
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
                  AND (?::int IS NULL OR r.rute_id = ?)
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

        $rows = DB::select($sql, [$radiusM, $kode, $ruteId, $ruteId, $kategori, $kategori, $limit]);

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
    public function getNearestPoi(float $lat, float $lon, int $radiusM = 500, int $limit = 10, ?string $kategori = null): array
    {
        $radiusM = min(max($radiusM, 50), 2000);
        $limit = min(max($limit, 1), 50);

        $sql = "
            SELECT p.poi_id,
                   p.nama_tempat,
                   p.kategori,
                   p.sub_kategori,
                   p.alamat,
                   ROUND(ST_Distance(p.geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)) AS jarak_m,
                   ST_Y(p.geom) AS lat,
                   ST_X(p.geom) AS lon
            FROM naik.poi p
            WHERE ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)
              AND (?::text IS NULL OR p.kategori = ?)
            ORDER BY jarak_m ASC
            LIMIT ?
        ";

        $rows = DB::select($sql, [$lon, $lat, $lon, $lat, $radiusM, $kategori, $kategori, $limit]);

        return array_map(function ($row) {
            return [
                'poi_id' => (int) $row->poi_id,
                'nama' => $row->nama_tempat,
                'kategori' => $row->kategori,
                'sub_kategori' => $row->sub_kategori,
                'alamat' => $row->alamat ?? null,
                'jarak_m' => (int) $row->jarak_m,
                'koordinat' => [
                    'lat' => (float) $row->lat,
                    'lon' => (float) $row->lon,
                ],
            ];
        }, $rows);
    }

    /**
     * Ambil POI di sepanjang koridor segmen geometri riil (GeoJSON LineString).
     *
     * @param array|string|object $segmenGeoJson
     * @param int $radiusM
     * @param string|null $kategori
     * @param int $limit
     * @return array<int, array<string, mixed>>
     */
    public function getKoridorPoiDariSegmen(array|string|object $segmenGeoJson, int $radiusM = 300, ?string $kategori = null, int $limit = 10): array
    {
        $jsonStr = is_string($segmenGeoJson) ? $segmenGeoJson : json_encode($segmenGeoJson);
        if (empty($jsonStr) || $jsonStr === '{}' || $jsonStr === 'null') {
            return [];
        }

        $radiusM = min(max($radiusM, 50), 1000);
        $limit = min(max($limit, 1), 50);

        try {
            $sql = "
                WITH segmen AS (
                    SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326), 32748) AS g
                ),
                raw_pois AS (
                    SELECT p.poi_id, p.osm_id, p.nama_tempat, p.kategori, p.sub_kategori, p.alamat,
                           ST_Distance(s.g, ST_Transform(p.geom, 32748)) as dist_m,
                           ST_LineLocatePoint(s.g, ST_Transform(p.geom, 32748)) as progress,
                           ST_Y(p.geom) as lat, ST_X(p.geom) as lon
                    FROM naik.poi p, segmen s
                    WHERE ST_DWithin(s.g, ST_Transform(p.geom, 32748), ?)
                      AND (?::text IS NULL OR p.kategori = ?)
                      AND (?::text IS NOT NULL OR p.kategori IN ('wisata', 'kuliner', 'belanja', 'pendidikan'))
                ),
                dedup AS (
                    SELECT DISTINCT ON (LOWER(nama_tempat))
                           poi_id, osm_id, nama_tempat, kategori, sub_kategori, alamat,
                           ROUND(dist_m) as jarak_ke_jalur_m, progress, lat, lon
                    FROM raw_pois
                    ORDER BY LOWER(nama_tempat), dist_m ASC
                ),
                bucketed AS (
                    SELECT *,
                           ROW_NUMBER() OVER (
                               PARTITION BY LEAST(4, FLOOR(progress * 5)::int)
                               ORDER BY jarak_ke_jalur_m ASC
                           ) as rk
                    FROM dedup
                )
                SELECT poi_id, osm_id, nama_tempat, kategori, sub_kategori, alamat, jarak_ke_jalur_m, progress, lat, lon
                FROM bucketed
                ORDER BY progress ASC
                LIMIT ?;
            ";

            $rows = DB::select($sql, [$jsonStr, $radiusM, $kategori, $kategori, $kategori, $limit]);

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
        } catch (\Throwable $e) {
            return [];
        }
    }
}
