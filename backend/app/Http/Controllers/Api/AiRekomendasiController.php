<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GeminiAiService;
use App\Services\RekomendasiSpasialService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AiRekomendasiController extends Controller
{
    public function __construct(
        protected GeminiAiService $aiService,
        protected RekomendasiSpasialService $spasialService
    ) {}

    /**
     * POST /api/ai/rekomendasi
     * Rekomendasi percakapan rute dan tempat singgah berbasis AI.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'pesan' => 'required|string|min:3|max:1000',
            'kode_trayek' => 'nullable|string|max:50',
            'lat' => 'nullable|numeric|between:-90,90',
            'lon' => 'nullable|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Parameter permintaan tidak valid',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();
        $context = $this->buildSpatialContext($validated);
        $result = $this->aiService->generateRecommendation($validated['pesan'], $context);

        return response()->json($result);
    }

    /**
     * Bangun konteks spasial berbasis data PostGIS untuk grounding AI.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function buildSpatialContext(array $input): array
    {
        $context = [];

        // 1. Katalog trayek resmi aktif beserta tarif
        $context['daftar_trayek_resmi'] = array_map(function ($r) {
            return (array) $r;
        }, DB::select("
            SELECT r.kode_trayek, MIN(r.nama_trayek) AS nama_trayek,
                   MIN(r.asal) AS asal, MIN(r.tujuan) AS tujuan,
                   COALESCE(MAX(t.tarif), 5000) AS tarif
            FROM naik.rute r
            LEFT JOIN naik.tarif_rute t ON t.kode_trayek = r.kode_trayek
            GROUP BY r.kode_trayek
            ORDER BY r.kode_trayek
            LIMIT 15
        "));

        // 2. Jika ada rute trayek spesifik yang sedang aktif ditinjau pengguna
        if (!empty($input['kode_trayek'])) {
            $kode = $this->spasialService->formatKodeTrayek($input['kode_trayek']);
            $context['kode_trayek_fokus'] = $kode;
            $context['poi_rekomendasi'] = $this->spasialService->getKoridorPoi($kode, 400, null, 15);

            $ruteInfo = array_map(function ($r) {
                return (array) $r;
            }, DB::select('
                SELECT kode_trayek, arah, nama_trayek, asal, tujuan, lintasan
                FROM naik.rute
                WHERE kode_trayek = ?
                LIMIT 2
            ', [$kode]));

            $context['trayek_terkait'] = $ruteInfo;
        } elseif (!empty($input['lat']) && !empty($input['lon'])) {
            // 3. Jika lokasi koordinat pengguna diberikan
            $context['poi_rekomendasi'] = $this->spasialService->getNearestPoi(
                (float) $input['lat'],
                (float) $input['lon'],
                600,
                12
            );
        } else {
            // 4. Pencarian kata kunci POI dari isi pesan pertanyaan pengguna
            $keywords = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($input['pesan']), -1, PREG_SPLIT_NO_EMPTY);
            $significantWords = array_values(array_filter($keywords, fn($w) => mb_strlen($w) >= 4));

            $matchedPoi = [];
            if (!empty($significantWords)) {
                $conditions = [];
                $bindings = [];
                foreach (array_slice($significantWords, 0, 4) as $word) {
                    $conditions[] = 'LOWER(nama_tempat) LIKE ? OR LOWER(alamat) LIKE ?';
                    $bindings[] = '%' . $word . '%';
                    $bindings[] = '%' . $word . '%';
                }

                $sql = 'SELECT poi_id, nama_tempat AS nama, kategori, sub_kategori, alamat
                        FROM naik.poi
                        WHERE ' . implode(' OR ', $conditions) . '
                        LIMIT 10';

                $matchedPoi = array_map(function ($p) {
                    return (array) $p;
                }, DB::select($sql, $bindings));
            }

            if (empty($matchedPoi)) {
                $matchedPoi = array_map(function ($p) {
                    return (array) $p;
                }, DB::select('
                    SELECT poi_id, nama_tempat AS nama, kategori, sub_kategori, alamat
                    FROM naik.poi
                    ORDER BY poi_id ASC
                    LIMIT 10
                '));
            }

            $context['poi_rekomendasi'] = $matchedPoi;
        }

        return $context;
    }
}
