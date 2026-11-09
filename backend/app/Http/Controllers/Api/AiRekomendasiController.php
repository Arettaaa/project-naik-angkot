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

        // 1. Ambil konteks trayek dan tempat dari PostGIS
        $context = $this->buildSpatialContext($validated);

        // 2. Cari pasangan lokasi asal dan tujuan
        // 3. Ambil hasil rekomendasi dari mesin pencarian rute
        $routeContext = $this->buildRouteContext($validated);

        // Gabungkan hasil pencarian rute ke konteks AI
        if (!empty($routeContext)) {
            $context = array_merge($context, $routeContext);
        }

        // 4. Kirim data yang sudah diverifikasi ke Gemini
        $result = $this->aiService->generateRecommendation(
            $validated['pesan'],
            $context
        );

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

        // Deteksi apakah pesan menyebut nomor trayek secara langsung (mis. "angkot 03", "trayek 08", "rute 21")
        $kodeTrayekInput = $input['kode_trayek'] ?? null;
        if (empty($kodeTrayekInput) && preg_match('/\b(?:angkot|trayek|rute|nomor|no\.?)\s*(\d{1,2}[a-zA-Z]*)\b/i', $input['pesan'], $m)) {
            $kodeTrayekInput = $m[1];
        }

        // 2. Jika ada rute trayek spesifik yang sedang aktif ditinjau atau disebut pengguna
        if (!empty($kodeTrayekInput)) {
            $kode = $this->spasialService->formatKodeTrayek($kodeTrayekInput);
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
            $lat = (float) $input['lat'];
            $lon = (float) $input['lon'];
            $context['poi_rekomendasi'] = $this->spasialService->getNearestPoi($lat, $lon, 600, 12);

            $nearestRoutes = array_map(function ($r) {
                return (array) $r;
            }, DB::select('
                SELECT r.kode_trayek, r.arah, r.nama_trayek, r.asal, r.tujuan, r.lintasan
                FROM naik.rute r
                JOIN naik.rute_geometri g ON g.rute_id = r.rute_id
                WHERE ST_DWithin(g.geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 500)
                ORDER BY ST_Distance(g.geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) ASC
                LIMIT 3
            ', [$lon, $lat, $lon, $lat]));

            if (!empty($nearestRoutes)) {
                $context['trayek_terkait'] = $nearestRoutes;
            }
        } else {
            // 4. Pencarian kata kunci POI & Rute dari isi pesan pertanyaan pengguna
            $stopWords = ['dari', 'mau', 'yang', 'untuk', 'bisa', 'naik', 'angkot', 'trayek', 'rute', 'arah', 'kota', 'bogor', 'jalan', 'tempat', 'rekomendasi', 'dekat', 'sekitar', 'dong', 'berapa', 'tarif', 'lewat', 'mana'];
            $keywords = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($input['pesan']), -1, PREG_SPLIT_NO_EMPTY);
            $significantWords = array_values(array_filter($keywords, fn($w) => mb_strlen($w) >= 3 && !in_array($w, $stopWords, true)));

            $matchedPoi = [];
            if (!empty($significantWords)) {
                $conditions = [];
                $bindings = [];
                foreach (array_slice($significantWords, 0, 4) as $word) {
                    $conditions[] = 'LOWER(nama_tempat) LIKE ? OR LOWER(alamat) LIKE ? OR LOWER(kategori) LIKE ? OR LOWER(COALESCE(sub_kategori, \'\')) LIKE ?';
                    $bindings[] = '%' . $word . '%';
                    $bindings[] = '%' . $word . '%';
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

                $ruteConds = [];
                $ruteBinds = [];
                foreach (array_slice($significantWords, 0, 4) as $word) {
                    $ruteConds[] = 'LOWER(COALESCE(lintasan, \'\')) LIKE ? OR LOWER(nama_trayek) LIKE ? OR LOWER(asal) LIKE ? OR LOWER(tujuan) LIKE ?';
                    $ruteBinds[] = '%' . $word . '%';
                    $ruteBinds[] = '%' . $word . '%';
                    $ruteBinds[] = '%' . $word . '%';
                    $ruteBinds[] = '%' . $word . '%';
                }

                $matchedRoutes = array_map(function ($r) {
                    return (array) $r;
                }, DB::select('
                    SELECT kode_trayek, arah, nama_trayek, asal, tujuan, lintasan
                    FROM naik.rute
                    WHERE ' . implode(' OR ', $ruteConds) . '
                    LIMIT 3
                ', $ruteBinds));

                if (!empty($matchedRoutes)) {
                    $context['trayek_terkait'] = $matchedRoutes;
                }
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

            if (empty($context['trayek_terkait']) && !empty($matchedPoi[0]['poi_id'])) {
                $nearPoiRoutes = array_map(function ($r) {
                    return (array) $r;
                }, DB::select('
                    SELECT r.kode_trayek, r.arah, r.nama_trayek, r.asal, r.tujuan, r.lintasan
                    FROM naik.rute r
                    JOIN naik.rute_geometri g ON g.rute_id = r.rute_id
                    JOIN naik.poi p ON p.poi_id = ?
                    WHERE ST_DWithin(g.geom::geography, p.geom::geography, 600)
                    ORDER BY ST_Distance(g.geom::geography, p.geom::geography) ASC
                    LIMIT 2
                ', [$matchedPoi[0]['poi_id']]));

                if (!empty($nearPoiRoutes)) {
                    $context['trayek_terkait'] = $nearPoiRoutes;
                }
            }

            $context['poi_rekomendasi'] = $matchedPoi;
        }

        return $context;
    }

    
/**
 * Membaca lokasi asal dan tujuan dari pertanyaan pengguna.
 */
private function extractLocations(string $pesan): array
{
    $asal = null;
    $tujuan = null;

    $pesan = trim($pesan);

    if (preg_match(
        '/\bdari\s+(.+?)\s+(?:ke|menuju)\s+(.+?)(?=\s+(?:naik|pakai|menggunakan|berapa|gimana|bagaimana)\b|[?.!,]|$)/iu',
        $pesan,
        $m
    )) {
        $asal = trim($m[1]);
        $tujuan = trim($m[2]);
    } elseif (preg_match(
        '/\b(?:ke|menuju)\s+(.+?)(?=\s+(?:naik|pakai|menggunakan|berapa|gimana|bagaimana)\b|[?.!,]|$)/iu',
        $pesan,
        $m
    )) {
        $tujuan = trim($m[1]);
    }

    return [
        'asal' => $asal,
        'tujuan' => $tujuan,
    ];
}
/**
 * Mencari koordinat nama tempat dari database PostGIS.
 */
private function findPoiLocation(string $nama): ?array
{
    $nama = trim($nama);

    if (mb_strlen($nama) < 3) {
        return null;
    }

    $row = DB::selectOne("
        SELECT
            nama_tempat AS nama,
            alamat,
            ST_Y(geom) AS lat,
            ST_X(geom) AS lon
        FROM naik.poi
        WHERE nama_tempat ILIKE ?
        ORDER BY
            CASE
                WHEN LOWER(nama_tempat) = LOWER(?) THEN 0
                WHEN LOWER(nama_tempat) LIKE LOWER(?) THEN 1
                ELSE 2
            END,
            LENGTH(nama_tempat)
        LIMIT 1
    ", [
        '%' . $nama . '%',
        $nama,
        $nama . '%'
    ]);

    if (!$row) {
        return null;
    }

    return [
        'nama' => $row->nama,
        'alamat' => $row->alamat,
        'lat' => (float) $row->lat,
        'lon' => (float) $row->lon,
    ];
}

/**
 * Menghubungkan pertanyaan dengan mesin pencarian rekomendasi rute.
 */
private function buildRouteContext(array $input): array
{
    $lokasi = $this->extractLocations($input['pesan']);

    // Cari koordinat asal berdasarkan nama lokasi
    $asal = $lokasi['asal']
        ? $this->findPoiLocation($lokasi['asal'])
        : null;

    // Jika asal tidak disebutkan, gunakan GPS pengguna
    if (!$lokasi['asal'] && isset($input['lat'], $input['lon'])) {
        $asal = [
            'nama' => 'Lokasi pengguna',
            'lat' => (float) $input['lat'],
            'lon' => (float) $input['lon'],
        ];
    }

    // Cari koordinat tujuan dari database POI
    $tujuan = $lokasi['tujuan']
        ? $this->findPoiLocation($lokasi['tujuan'])
        : null;

    // Jangan membuat rute jika lokasi belum lengkap
    if (!$asal || !$tujuan) {
        return [
            'status_pencarian_rute' => 'lokasi_belum_lengkap',
            'lokasi_asal_dicari' => $lokasi['asal'],
            'lokasi_tujuan_dicari' => $lokasi['tujuan'],
        ];
    }

    // Gunakan mesin rekomendasi rute yang sudah ada di TrayekController
    $routeRequest = Request::create(
        '/api/rekomendasi',
        'GET',
        [
            'asal' => $asal['lat'] . ',' . $asal['lon'],
            'tujuan' => $tujuan['lat'] . ',' . $tujuan['lon'],
            'radius' => 800,
        ]
    );

    $routeResponse = app(TrayekController::class)
        ->rekomendasi($routeRequest);

    if ($routeResponse->getStatusCode() !== 200) {
        return [
            'status_pencarian_rute' => 'gagal',
            'hasil_pencarian_rute' => [],
        ];
    }

    $data = $routeResponse->getData(true);

    // Gabungkan alternatif rute langsung dan rute transit
    $semuaRute = array_merge(
        $data['langsung'] ?? [],
        $data['transfer'] ?? [],
        $data['transfer2'] ?? []
    );

    // Urutkan berdasarkan waktu perjalanan
    usort($semuaRute, fn ($a, $b) =>
        ($a['menit'] ?? PHP_INT_MAX)
        <=>
        ($b['menit'] ?? PHP_INT_MAX)
    );

    $semuaRute = array_slice($semuaRute, 0, 5);

    if (empty($semuaRute)) {
        return [
            'status_pencarian_rute' => 'tidak_ditemukan',
            'lokasi_asal' => $asal,
            'lokasi_tujuan' => $tujuan,
            'hasil_pencarian_rute' => [],
        ];
    }

    // Ambil hanya informasi penting untuk konteks AI
    $hasilRute = [];
    $poiTerkait = [];

    foreach ($semuaRute as $opsi) {
        $legs = [];

        foreach ($opsi['legs'] ?? [] as $leg) {
            $legs[] = [
                'kode_trayek' => $leg['kode_trayek'],
                'rute_id' => $leg['rute_id'],
                'arah' => $leg['arah'],
                'nama_trayek' => $leg['nama_trayek'],
                'jarak_m' => $leg['jarak_m'],
            ];

            // Cari tempat menarik pada ruas trayek yang benar
            $poi = $this->spasialService->getKoridorPoi(
                $leg['kode_trayek'],
                300,
                null,
                5,
                (int) $leg['rute_id']
            );

            foreach ($poi as $tempat) {
                $id = $tempat['poi_id'];

                if (!isset($poiTerkait[$id])) {
                    $tempat['trayek'] = $leg['kode_trayek'];
                    $poiTerkait[$id] = $tempat;
                }
            }
        }

        $hasilRute[] = [
            'menit' => $opsi['menit'] ?? null,
            'tarif' => $opsi['tarif'] ?? null,
            'jalan_ke_naik_m' => $opsi['jalan_ke_naik_m'] ?? null,
            'jalan_dari_turun_m' => $opsi['jalan_dari_turun_m'] ?? null,
            'legs' => $legs,
            'pindah' => $opsi['pindah'] ?? [],
        ];
    }

    return [
        'status_pencarian_rute' => 'berhasil',
        'lokasi_asal' => $asal,
        'lokasi_tujuan' => $tujuan,
        'hasil_pencarian_rute' => $hasilRute,
        'poi_di_sepanjang_rute' => array_values(
            array_slice($poiTerkait, 0, 12, true)
        ),
    ];
}



}
