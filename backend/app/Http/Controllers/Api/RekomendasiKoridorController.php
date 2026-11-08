<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RekomendasiSpasialService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RekomendasiKoridorController extends Controller
{
    private const ALLOWED_KATEGORI = [
        'kuliner',
        'wisata',
        'belanja',
        'pendidikan',
        'kesehatan',
        'transportasi',
    ];

    public function __construct(
        protected RekomendasiSpasialService $spasialService
    ) {}

    /**
     * GET /api/rekomendasi/koridor/{kode}?radius=300&kategori=kuliner&limit=30
     * Rekomendasi POI di sepanjang koridor trayek angkot.
     */
    public function index(Request $request, string $kode): JsonResponse
    {
        $trayek = $this->spasialService->findTrayek($kode);

        if (!$trayek) {
            $formatted = $this->spasialService->formatKodeTrayek($kode);

            return response()->json([
                'message' => "Trayek {$formatted} tidak ditemukan",
            ], 404);
        }

        $validator = Validator::make($request->query(), [
            'radius' => 'nullable|integer|min:50|max:1000',
            'limit' => 'nullable|integer|min:1|max:100',
            'kategori' => 'nullable|string|in:' . implode(',', self::ALLOWED_KATEGORI),
            'rute_id' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Parameter permintaan tidak valid',
                'errors' => $validator->errors(),
            ], 422);
        }

        $radius = (int) $request->query('radius', 300);
        $limit = (int) $request->query('limit', 30);
        $kategori = $request->query('kategori');
        $ruteId = $request->query('rute_id') !== null ? (int) $request->query('rute_id') : null;

        $poi = $this->spasialService->getKoridorPoi(
            $trayek->kode_trayek,
            $radius,
            $kategori,
            $limit,
            $ruteId
        );

        return response()->json([
            'kode_trayek' => $trayek->kode_trayek,
            'nama_trayek' => $trayek->nama_trayek,
            'radius_buffer_m' => $radius,
            'filter_kategori' => $kategori,
            'total_poi' => count($poi),
            'poi' => $poi,
        ]);
    }
}
