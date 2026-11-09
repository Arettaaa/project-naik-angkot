<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GeminiAiService;
use App\Services\RekomendasiRoutingService;
use App\Services\RekomendasiSpasialService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AiRekomendasiController extends Controller
{
    private const ALIASES = [
        'btm' => 'Bogor Trade Mall (BTM)',
        'bogor trade mall' => 'Bogor Trade Mall (BTM)',
        'sekolah bisnis ipb' => 'IPB Pasca Sarjana Manajemen dan Bisnis',
        'sb ipb' => 'IPB Pasca Sarjana Manajemen dan Bisnis',
        'sb-ipb' => 'IPB Pasca Sarjana Manajemen dan Bisnis',
        'ipb mm' => 'IPB Pasca Sarjana Manajemen dan Bisnis',
        'vokasi ipb' => 'Sekolah Vokasi IPB University',
        'sv ipb' => 'Sekolah Vokasi IPB University',
        'sv-ipb' => 'Sekolah Vokasi IPB University',
        'ipb cilibende' => 'Sekolah Vokasi IPB University',
        'ipb baranangsiang' => 'IPB Kampus Baranangsiang',
        'ipb' => 'IPB Kampus Baranangsiang',
        'krb' => 'Kebun Raya Bogor',
        'kebun raya' => 'Kebun Raya Bogor',
        'kebun raya bogor' => 'Kebun Raya Bogor',
        'surken' => 'Pasar Bogor',
        'suryakencana' => 'Pasar Bogor',
        'stasiun' => 'Stasiun Bogor',
        'stasiun bogor' => 'Stasiun Bogor',
        'botani' => 'Mall Botani Square',
        'botani square' => 'Mall Botani Square',
        'jambu dua' => 'Plaza Jambu Dua',
        'plaza jambu dua' => 'Plaza Jambu Dua',
        'warung jambu' => 'Plaza Jambu Dua',
        'pasar anyar' => 'Pasar Anyar Bogor',
        'terminal baranangsiang' => 'Terminal Baranangsiang',
        'baranangsiang' => 'Terminal Baranangsiang',
        'terminal bubulak' => 'Terminal Bubulak',
        'bubulak' => 'Terminal Bubulak',
        'terminal merdeka' => 'Terminal Merdeka',
    ];

    public function __construct(
        protected GeminiAiService $aiService,
        protected RekomendasiSpasialService $spasialService,
        protected RekomendasiRoutingService $routingService
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
            'lat' => 'nullable|numeric|between:-180,180',
            'lon' => 'nullable|numeric|between:-180,180',
            'lng' => 'nullable|numeric|between:-180,180',
            'konteks_cari' => 'nullable|array',
            'konteks_cari.asal' => 'nullable|array',
            'konteks_cari.tujuan' => 'nullable|array',
            'konteks_cari.opsi_terpilih' => 'nullable|array',
            'konteks_cari.daftar_opsi' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Parameter permintaan tidak valid',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        // 1. Ekstraksi koordinat seragam & sanitasi swap (jika latitude positif dan longitude negatif tertukar)
        $lat = $validated['lat'] ?? null;
        $lon = $validated['lon'] ?? $validated['lng'] ?? null;
        if ($lat !== null && $lon !== null) {
            $lat = (float) $lat;
            $lon = (float) $lon;
            if ($lat > 0 && $lon < 0) {
                $tmp = $lat;
                $lat = $lon;
                $lon = $tmp;
            }
            $validated['lat'] = $lat;
            $validated['lon'] = $lon;
        }

        // 2. Ambil konteks rute terlebih dahulu (baik dari CariPanel maupun hasil hitung Dijkstra + Yen)
        $routeContext = $this->buildRouteContext($validated);

        // 3. Ambil konteks master trayek dan tempat dari PostGIS dengan isolasi konteks cerdas
        $context = $this->buildSpatialContext($validated, $routeContext);

        if (!empty($routeContext)) {
            $context = array_merge($context, $routeContext);
        }

        // 4. Hasilkan respons terstruktur menggunakan Gemini AI
        $result = $this->aiService->generateRecommendation(
            $validated['pesan'],
            $context
        );

        // 5. Jika ada data rute hasil mesin routing terpadu, sertakan agar frontend bisa menampilkan di peta
        if (!empty($routeContext['data_rute_peta'])) {
            $result['data_rute'] = $routeContext['data_rute_peta'];
        }

        return response()->json($result);
    }

    /**
     * Bangun konteks spasial berbasis data PostGIS untuk grounding AI.
     * Menggunakan isolasi konteks agar pertanyaan rute tidak dicemari POI acak.
     *
     * @param array<string, mixed> $input
     * @param array<string, mixed>|null $routeContext
     * @return array<string, mixed>
     */
    private function buildSpatialContext(array $input, ?array $routeContext = null): array
    {
        $context = [];

        // 1. Katalog trayek resmi aktif beserta tarif flat Rp5.000
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

        // 2. Jika intent adalah rute perjalanan (berhasil, sudah_sampai, luar_kota_bogor):
        // ISOLASI KONTEKS: Jangan jalankan query naive POI acak yang mengotori prompt AI
        $statusRute = $routeContext['status_pencarian_rute'] ?? null;
        if (in_array($statusRute, ['berhasil', 'sudah_sampai', 'luar_kota_bogor'], true)) {
            $context['poi_rekomendasi'] = [];
            return $context;
        }

        // 3. Jika intent adalah eksplorasi tempat (kuliner, wisata, belanja):
        if ($statusRute === 'eksplorasi_tempat') {
            $kategori = $routeContext['kategori_eksplorasi'] ?? null;
            $landmark = null;
            foreach (array_keys(self::ALIASES) as $alias) {
                if (stripos($input['pesan'], $alias) !== false) {
                    $landmark = $this->findPoiLocation($alias);
                    break;
                }
            }

            if ($landmark) {
                $context['poi_rekomendasi'] = $this->spasialService->getNearestPoi($landmark['lat'], $landmark['lon'], 800, 10, $kategori);
            } else {
                $sql = 'SELECT poi_id, nama_tempat AS nama, kategori, sub_kategori, alamat, ST_Y(geom) as lat, ST_X(geom) as lon
                        FROM naik.poi
                        WHERE (?::text IS NULL OR kategori = ?)
                        ORDER BY RANDOM()
                        LIMIT 10';
                $context['poi_rekomendasi'] = array_map(fn($p) => (array) $p, DB::select($sql, [$kategori, $kategori]));
            }
            return $context;
        }

        // Deteksi apakah pesan menyebut nomor trayek secara langsung (mis. "angkot 03", "trayek 08")
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
            // 3. Jika lokasi koordinat pengguna diberikan via GPS
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

            if (!empty($matchedPoi[0]['poi_id'])) {
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

    private function cleanNoiseWords(string $str): string
    {
        $str = trim($str);
        while (preg_match('/^(?:mau|pengen|ingin|tolong|coba|bisa|arah)\s+/iu', $str)) {
            $str = (string) preg_replace('/^(?:mau|pengen|ingin|tolong|coba|bisa|arah)\s+/iu', '', $str);
        }
        $noisePattern = '/\s+(?:dong|sih|ya|nih|kak|min|kang|atuh|tolong|plis|kah|deh|sekarang|aja|dulu|ada|ga|gak|nggak|tidak|ada\s+ga|ada\s+gak|bisa\s+ga|bisa\s+gak)$/iu';
        while (preg_match($noisePattern, $str)) {
            $str = (string) preg_replace($noisePattern, '', $str);
        }
        return trim($str);
    }

    private function isDeixis(string $str): bool
    {
        $norm = mb_strtolower(trim($str));
        return in_array($norm, ['sini', 'posisi saya', 'lokasi saya', 'titik saya', 'tempat saya', 'posisiku', 'lokasiku', 'tempatku', 'saat ini'], true);
    }

    /**
     * Hitung jarak geodetik (lingkaran besar / Haversine) antara dua pasang koordinat dalam satuan meter.
     */
    private function hitungJarakMeter(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    /**
     * Deteksi apakah nama tempat merujuk ke luar wilayah operasional angkot Kota Bogor.
     */
    private function isOutsideBogorKeywords(?string $name): bool
    {
        if (empty($name)) return false;
        $norm = mb_strtolower($name);
        return (bool) preg_match('/\b(jungleland|sentul|puncak|cisarua|megamendung|gadog|ciawi\s+luar|parung|cibinong|depok|jakarta|sukabumi|bandung|kabupaten\s+bogor)\b/iu', $norm);
    }

    /**
     * Deteksi apakah koordinat berada jauh di luar batas operasional angkot Kota Bogor.
     */
    private function isOutsideBogorCoords(float $lat, float $lon): bool
    {
        return ($lat < -6.72 || $lat > -6.48 || $lon < 106.70 || $lon > 106.88);
    }

    /**
     * Membaca lokasi asal dan tujuan dari pertanyaan pengguna dengan dukungan multi-pattern.
     */
    private function extractLocations(string $pesan): array
    {
        $asal = null;
        $tujuan = null;
        $pesan = trim($pesan);

        $suffix = '(?=\s+(?:naik|pakai|menggunakan|berapa|gimana|bagaimana|tarif|ongkos|ada|bisa|lewat)\b|[?.!,]|$)';

        // Pola 1: dari A ke B (mis. "dari sekolah bisnis ipb ke btm")
        if (preg_match('/\bdari\s+(.+?)\s+(?:ke|menuju|sampe|sampai)\s+(.+?)' . $suffix . '/iu', $pesan, $m)) {
            $asal = $this->cleanNoiseWords($m[1]);
            $tujuan = $this->cleanNoiseWords($m[2]);
        }
        // Pola 2: ke B dari A (terbalik, mis. "mau ke btm dari sekolah bisnis ipb")
        elseif (preg_match('/\b(?:ke|menuju|sampe|sampai)\s+(.+?)\s+dari\s+(.+?)' . $suffix . '/iu', $pesan, $m)) {
            $tujuan = $this->cleanNoiseWords($m[1]);
            $asal = $this->cleanNoiseWords($m[2]);
        }
        // Pola 3: A - B atau A -> B (mis. "stasiun bogor - btm")
        elseif (preg_match('/^(.+?)\s*(?:-|–|—|->|-->|to)\s*(.+?)' . $suffix . '/iu', $pesan, $m)) {
            $asal = $this->cleanNoiseWords($m[1]);
            $tujuan = $this->cleanNoiseWords($m[2]);
        }
        // Pola 4: hanya tujuan (mis. "ke btm", "mau ke stasiun")
        elseif (preg_match('/\b(?:ke|menuju|sampe|sampai)\s+(.+?)' . $suffix . '/iu', $pesan, $m)) {
            $tujuan = $this->cleanNoiseWords($m[1]);
        }

        return [
            'asal' => $asal,
            'tujuan' => $tujuan,
        ];
    }

    /**
     * Mencari koordinat nama tempat dari database PostGIS (Canonical POI & Alias Resolver).
     */
    private function findPoiLocation(string $nama, ?float $userLat = null, ?float $userLon = null): ?array
    {
        $nama = trim($nama);

        if (mb_strlen($nama) < 2) {
            return null;
        }

        // Resolusi deiksis ("sini", "posisi saya") menggunakan koordinat GPS user
        if ($this->isDeixis($nama)) {
            if ($userLat !== null && $userLon !== null) {
                return [
                    'nama' => 'Lokasi Anda (GPS)',
                    'alamat' => 'Posisi saat ini',
                    'lat' => $userLat,
                    'lon' => $userLon,
                ];
            }
            return null;
        }

        $namaNorm = mb_strtolower($nama);
        $canonical = self::ALIASES[$namaNorm] ?? null;
        $searchTarget = $canonical ?? $nama;

        // 1. Exact / Substring ILIKE terhadap nama_tempat atau alamat
        $row = DB::selectOne("
            SELECT
                nama_tempat AS nama,
                alamat,
                ST_Y(geom) AS lat,
                ST_X(geom) AS lon
            FROM naik.poi
            WHERE nama_tempat ILIKE ? OR alamat ILIKE ?
            ORDER BY
                CASE
                    WHEN LOWER(nama_tempat) = LOWER(?) THEN 0
                    WHEN LOWER(nama_tempat) LIKE LOWER(?) THEN 1
                    WHEN LOWER(nama_tempat) LIKE LOWER(?) THEN 2
                    WHEN LOWER(alamat) LIKE LOWER(?) THEN 3
                    ELSE 4
                END,
                -- Prioritas lokasi di dalam batas operasional angkot Kota Bogor
                CASE WHEN ST_X(geom) BETWEEN 106.74 AND 106.85 AND ST_Y(geom) BETWEEN -6.68 AND -6.52 THEN 0 ELSE 1 END,
                LENGTH(nama_tempat)
            LIMIT 1
        ", [
            '%' . $searchTarget . '%',
            '%' . $searchTarget . '%',
            $searchTarget,
            $searchTarget . '%',
            '%' . $searchTarget . '%',
            '%' . $searchTarget . '%'
        ]);

        if ($row) {
            return [
                'nama' => $row->nama,
                'alamat' => $row->alamat,
                'lat' => (float) $row->lat,
                'lon' => (float) $row->lon,
            ];
        }

        // 2. Token Matching (di nama_tempat ATAU alamat, dengan normalisasi singkatan populer)
        $normalizedTokens = str_replace(
            ['lapangan', 'rumah sakit', 'jalan '],
            ['lap', 'rs', 'jl '],
            $namaNorm
        );
        $words = preg_split('/\s+/u', $normalizedTokens, -1, PREG_SPLIT_NO_EMPTY);
        $stop = ['di', 'ke', 'dari', 'yang', 'dekat', 'sekitar', 'jalan', 'jl', 'kota', 'bogor', 'ada', 'ga', 'gak'];
        $sig = array_values(array_filter($words, fn($w) => mb_strlen($w) >= 3 && !in_array($w, $stop, true)));

        if (!empty($sig)) {
            $conditions = [];
            $bindings = [];
            foreach ($sig as $w) {
                $conditions[] = '(nama_tempat ILIKE ? OR alamat ILIKE ?)';
                $bindings[] = '%' . $w . '%';
                $bindings[] = '%' . $w . '%';
            }
            $sql = "SELECT nama_tempat AS nama, alamat, ST_Y(geom) AS lat, ST_X(geom) AS lon
                    FROM naik.poi
                    WHERE " . implode(' AND ', $conditions) . "
                    ORDER BY
                        CASE WHEN ST_X(geom) BETWEEN 106.74 AND 106.85 AND ST_Y(geom) BETWEEN -6.68 AND -6.52 THEN 0 ELSE 1 END,
                        LENGTH(nama_tempat)
                    LIMIT 1";
            $rowToken = DB::selectOne($sql, $bindings);
            if ($rowToken) {
                return [
                    'nama' => $rowToken->nama,
                    'alamat' => $rowToken->alamat,
                    'lat' => (float) $rowToken->lat,
                    'lon' => (float) $rowToken->lon,
                ];
            }
        }

        return null;
    }

    /**
     * Menghubungkan pertanyaan dengan mesin routing terpadu (RekomendasiRoutingService).
     * Memprioritaskan opsi rute yang sedang aktif di CariPanel jika tersedia.
     */
    private function buildRouteContext(array $input): array
    {
        // PRIORITAS 1: Sinkronisasi dari CariPanel (Context-Passing)
        if (!empty($input['konteks_cari']['opsi_terpilih'])) {
            $opsi = $input['konteks_cari']['opsi_terpilih'];
            $asal = $input['konteks_cari']['asal'] ?? ['nama' => 'Titik Asal'];
            $tujuan = $input['konteks_cari']['tujuan'] ?? ['nama' => 'Titik Tujuan'];

            $legs = [];
            $segmenList = [];

            if (!empty($opsi['legs'])) {
                $legs = $opsi['legs'];
                foreach ($legs as $l) {
                    if (!empty($l['segmen'])) {
                        $segmenList[] = $l['segmen'];
                    }
                }
            } elseif (!empty($opsi['kode_trayek'])) {
                // Format langsung CariPanel
                $legs[] = [
                    'kode_trayek' => $opsi['kode_trayek'],
                    'rute_id' => $opsi['rute_id'] ?? null,
                    'arah' => $opsi['arah'] ?? null,
                    'nama_trayek' => $opsi['nama_trayek'] ?? null,
                    'jarak_m' => $opsi['jarak_angkot_m'] ?? null,
                ];
                if (!empty($opsi['segmen'])) {
                    $segmenList[] = $opsi['segmen'];
                }
            } elseif (!empty($opsi['kode_1']) && !empty($opsi['kode_2'])) {
                // Format transfer CariPanel
                $legs[] = [
                    'kode_trayek' => $opsi['kode_1'],
                    'arah' => $opsi['arah_1'] ?? null,
                    'nama_trayek' => null,
                    'jarak_m' => $opsi['jarak_angkot_1_m'] ?? null,
                ];
                $legs[] = [
                    'kode_trayek' => $opsi['kode_2'],
                    'arah' => $opsi['arah_2'] ?? null,
                    'nama_trayek' => null,
                    'jarak_m' => $opsi['jarak_angkot_2_m'] ?? null,
                ];
                if (!empty($opsi['segmen_1'])) $segmenList[] = $opsi['segmen_1'];
                if (!empty($opsi['segmen_2'])) $segmenList[] = $opsi['segmen_2'];
            }

            // Ambil POI di sepanjang koridor segmen riil perjalanan
            $poiKoridorSegmen = [];
            foreach ($segmenList as $seg) {
                $pois = $this->spasialService->getKoridorPoiDariSegmen($seg, 300, null, 6);
                foreach ($pois as $p) {
                    if (!isset($poiKoridorSegmen[$p['poi_id']])) {
                        $poiKoridorSegmen[$p['poi_id']] = $p;
                    }
                }
            }

            $opsiTerpilih = [
                'menit' => $opsi['menit'] ?? null,
                'tarif' => $opsi['tarif'] ?? (count($legs) * 5000),
                'jalan_ke_naik_m' => $opsi['jalan_ke_naik_m'] ?? null,
                'jalan_dari_turun_m' => $opsi['jalan_dari_turun_m'] ?? null,
                'legs' => $legs,
                'pindah' => $opsi['pindah'] ?? [],
            ];

            return [
                'status_pencarian_rute' => 'berhasil',
                'sumber_rute' => 'caripanel_terpilih',
                'lokasi_asal' => $asal,
                'lokasi_tujuan' => $tujuan,
                'hasil_pencarian_rute' => [$opsiTerpilih],
                'poi_di_sepanjang_rute' => array_values($poiKoridorSegmen),
                'data_rute_peta' => [
                    'asal' => $asal,
                    'tujuan' => $tujuan,
                    'opsi' => $opsi,
                ],
            ];
        }

        // PRIORITAS 2: Pencarian Mandiri via RekomendasiRoutingService
        $userLat = isset($input['lat']) ? (float) $input['lat'] : null;
        $userLon = isset($input['lon']) ? (float) $input['lon'] : (isset($input['lng']) ? (float) $input['lng'] : null);

        $lokasi = $this->extractLocations($input['pesan']);

        $asal = $lokasi['asal']
            ? $this->findPoiLocation($lokasi['asal'], $userLat, $userLon)
            : null;

        if (!$asal && $userLat !== null && $userLon !== null) {
            $asal = [
                'nama' => 'Lokasi Anda (GPS)',
                'lat' => $userLat,
                'lon' => $userLon,
            ];
        }

        $tujuan = $lokasi['tujuan']
            ? $this->findPoiLocation($lokasi['tujuan'], $userLat, $userLon)
            : null;

        // Deteksi kategori intent dari pertanyaan pengguna (kuliner, wisata, belanja)
        $kategoriPoi = null;
        if (preg_match('/\b(kuliner|makan|jajan|kopi|cafe|resto|restoran|toge goreng)\b/iu', $input['pesan'])) {
            $kategoriPoi = 'kuliner';
        } elseif (preg_match('/\b(wisata|taman|museum|kebun|sejarah)\b/iu', $input['pesan'])) {
            $kategoriPoi = 'wisata';
        } elseif (preg_match('/\b(belanja|mall|pasar|plaza|toko)\b/iu', $input['pesan'])) {
            $kategoriPoi = 'belanja';
        }

        // Deteksi eksplorasi tempat (kuliner / wisata / belanja) tanpa asal-tujuan rute
        if (!$asal && !$tujuan) {
            $pesanLower = mb_strtolower($input['pesan']);
            if (preg_match('/\b(kuliner|makan|wisata|taman|museum|belanja|pasar|kopi|cafe|rekomendasi)\b/u', $pesanLower)) {
                return [
                    'status_pencarian_rute' => 'eksplorasi_tempat',
                    'pesan_eksplorasi' => $input['pesan'],
                    'kategori_eksplorasi' => $kategoriPoi,
                ];
            }
        }

        // Bounding Box Guard: Deteksi apakah asal atau tujuan berada di luar batas operasional angkot Kota Bogor
        $targetLuar = null;
        if ($this->isOutsideBogorKeywords($lokasi['tujuan'] ?? '')) {
            $targetLuar = $lokasi['tujuan'];
        } elseif ($this->isOutsideBogorKeywords($lokasi['asal'] ?? '')) {
            $targetLuar = $lokasi['asal'];
        } elseif ($asal && $this->isOutsideBogorCoords($asal['lat'], $asal['lon'])) {
            $targetLuar = $asal['nama'];
        } elseif ($tujuan && $this->isOutsideBogorCoords($tujuan['lat'], $tujuan['lon'])) {
            $targetLuar = $tujuan['nama'];
        }

        if ($targetLuar !== null) {
            return [
                'status_pencarian_rute' => 'luar_kota_bogor',
                'lokasi_luar' => $targetLuar,
                'lokasi_asal' => $asal,
                'lokasi_tujuan' => $tujuan ?? ['nama' => $targetLuar],
                'hasil_pencarian_rute' => [],
                'poi_di_sepanjang_rute' => [],
                'narasi_saran' => "Lokasi {$targetLuar} berada di luar batas wilayah operasional angkot resmi Kota Bogor. Angkot kota hanya beroperasi di wilayah Kota Bogor. Untuk menuju ke sana, kamu disarankan menggunakan transportasi antarkota, KRL, bus feeder, atau transportasi daring.",
            ];
        }

        if (!$asal || !$tujuan) {
            return [
                'status_pencarian_rute' => 'lokasi_belum_lengkap',
                'lokasi_asal_dicari' => $lokasi['asal'],
                'lokasi_tujuan_dicari' => $lokasi['tujuan'],
            ];
        }

        // Ultra-Short Distance Guard: Jika jarak asal ke tujuan <= 200m, sarankan cukup jalan kaki santai
        $jarakLurusM = $this->hitungJarakMeter($asal['lat'], $asal['lon'], $tujuan['lat'], $tujuan['lon']);
        if ($jarakLurusM <= 200) {
            $jarakBulat = (int) round($jarakLurusM);
            return [
                'status_pencarian_rute' => 'sudah_sampai',
                'jarak_m' => $jarakBulat,
                'lokasi_asal' => $asal,
                'lokasi_tujuan' => $tujuan,
                'hasil_pencarian_rute' => [],
                'poi_di_sepanjang_rute' => [],
                'narasi_saran' => "Jarak dari {$asal['nama']} ke {$tujuan['nama']} sangat dekat (hanya sekitar {$jarakBulat} meter). Cukup berjalan kaki santai sekitar 1-3 menit tanpa perlu naik angkot.",
            ];
        }

        // Hitung rute menggunakan mesin tunggal Dijkstra + Yen
        $data = $this->routingService->cariRute(
            [$asal['lat'], $asal['lon']],
            [$tujuan['lat'], $tujuan['lon']],
            800
        );

        // Urutan prioritas identik dengan CariPanel: Langsung -> 1x Transfer -> 2x Transfer
        $semuaRute = array_merge(
            $data['langsung'] ?? [],
            $data['transfer'] ?? [],
            $data['transfer2'] ?? []
        );

        if (empty($semuaRute)) {
            return [
                'status_pencarian_rute' => 'tidak_ditemukan',
                'lokasi_asal' => $asal,
                'lokasi_tujuan' => $tujuan,
                'hasil_pencarian_rute' => [],
            ];
        }

        $kandidatTerpilih = array_slice($semuaRute, 0, 3);
        $hasilRute = [];
        $poiTerkait = [];

        foreach ($kandidatTerpilih as $opsi) {
            $legs = [];
            $segmenList = [];
            $totalLegs = count($opsi['legs'] ?? []);
            foreach ($opsi['legs'] ?? [] as $legIdx => $leg) {
                $titikNaik = $legIdx === 0
                    ? "Dekat {$asal['nama']}" . (isset($opsi['jalan_ke_naik_m']) && $opsi['jalan_ke_naik_m'] > 0 ? " (jalan kaki {$opsi['jalan_ke_naik_m']} m)" : "")
                    : "Titik transfer angkot";
                $titikTurun = $legIdx === $totalLegs - 1
                    ? "Dekat {$tujuan['nama']}" . (isset($opsi['jalan_dari_turun_m']) && $opsi['jalan_dari_turun_m'] > 0 ? " (jalan kaki {$opsi['jalan_dari_turun_m']} m)" : "")
                    : "Titik transfer angkot";

                $legs[] = [
                    'kode_trayek' => $leg['kode_trayek'],
                    'rute_id' => $leg['rute_id'],
                    'arah' => $leg['arah'],
                    'nama_trayek' => $leg['nama_trayek'],
                    'jarak_m' => $leg['jarak_m'],
                    'titik_naik' => $titikNaik,
                    'titik_turun' => $titikTurun,
                ];
                if (!empty($leg['segmen'])) {
                    $segmenList[] = $leg['segmen'];
                }
            }

            // Cari POI di sepanjang koridor segmen riil (dengan filter kategori jika relevan)
            foreach ($segmenList as $seg) {
                $pois = $this->spasialService->getKoridorPoiDariSegmen($seg, 300, $kategoriPoi, 5);
                foreach ($pois as $tempat) {
                    $id = $tempat['poi_id'];
                    if (!isset($poiTerkait[$id])) {
                        $poiTerkait[$id] = $tempat;
                    }
                }
            }

            $hasilRute[] = [
                'menit' => $opsi['menit'] ?? null,
                'tarif' => $opsi['tarif'] ?? (count($legs) * 5000),
                'jalan_ke_naik_m' => $opsi['jalan_ke_naik_m'] ?? null,
                'jalan_dari_turun_m' => $opsi['jalan_dari_turun_m'] ?? null,
                'legs' => $legs,
                'pindah' => $opsi['pindah'] ?? [],
            ];
        }

        return [
            'status_pencarian_rute' => 'berhasil',
            'sumber_rute' => 'engine_routing_terpadu',
            'lokasi_asal' => $asal,
            'lokasi_tujuan' => $tujuan,
            'hasil_pencarian_rute' => $hasilRute,
            'poi_di_sepanjang_rute' => array_values(array_slice($poiTerkait, 0, 10, true)),
            'data_rute_peta' => [
                'asal' => $asal,
                'tujuan' => $tujuan,
                'opsi' => $kandidatTerpilih[0] ?? null,
            ],
        ];
    }
}
