<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PoiController extends Controller
{
    /**
     * GET /api/poi?q=sekolah&limit=8 — cari tempat (POI) di tabel naik.poi berdasarkan nama atau kategori.
     * Dipakai kolom "Mau ke mana hari ini?" dan kolom Dari/Ke di menu Cari.
     */
    public function cari(Request $req): JsonResponse
    {
        $q = trim((string) $req->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([]);
        }
        $limit = min(max((int) $req->query('limit', 8), 1), 20);
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%';

        $rows = DB::select("
            SELECT poi_id, nama_tempat AS nama, kategori, sub_kategori, alamat,
                   ROUND(ST_Y(geom)::numeric, 6)::float AS lat, ROUND(ST_X(geom)::numeric, 6)::float AS lng
            FROM naik.poi
            WHERE nama_tempat ILIKE ? OR kategori ILIKE ? OR sub_kategori ILIKE ?
            ORDER BY (nama_tempat ILIKE ?) DESC, length(nama_tempat), nama_tempat
            LIMIT ?", [$like, $like, $like, $q . '%', $limit]);

        return response()->json($rows);
    }
}
