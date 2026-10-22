<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TrayekController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = DB::select("
            SELECT
                id,
                kode_trayek,
                nama_trayek,
                warna,
                asal,
                tujuan,
                ST_AsGeoJSON(geom)::json AS geometry
            FROM public.trayek_angkot
            WHERE geom IS NOT NULL
            ORDER BY id
        ");

        $features = array_map(function ($row) {
            return [
                'type' => 'Feature',
                'geometry' => $row->geometry,
                'properties' => [
                    'id' => $row->id,
                    'kode_trayek' => $row->kode_trayek,
                    'nama_trayek' => $row->nama_trayek,
                    'warna' => $row->warna,
                    'asal' => $row->asal,
                    'tujuan' => $row->tujuan,
                ],
            ];
        }, $rows);

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }

    public function kepadatan(): JsonResponse
    {
        $rows = DB::select("
            SELECT
                gid,
                osm_id,
                nama_jalan,
                highway,
                jumlah_trayek,
                trayek,
                kepadatan,
                panjang_m,
                ST_AsGeoJSON(geom)::json AS geometry
            FROM public.kepadatan_trayek
            WHERE geom IS NOT NULL
            ORDER BY gid
        ");

        $features = array_map(function ($row) {
            return [
                'type' => 'Feature',
                'geometry' => $row->geometry,
                'properties' => [
                    'gid' => $row->gid,
                    'osm_id' => $row->osm_id,
                    'nama_jalan' => $row->nama_jalan,
                    'highway' => $row->highway,
                    'jumlah_trayek' => $row->jumlah_trayek,
                    'trayek' => $row->trayek,
                    'kepadatan' => $row->kepadatan,
                    'panjang_m' => $row->panjang_m,
                ],
            ];
        }, $rows);

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }
}
