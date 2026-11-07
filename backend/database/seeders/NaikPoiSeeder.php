<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Data tempat untuk pencarian & alamat NAIK, semuanya dari OpenStreetMap (Overpass API):
 *  1. naik.poi     : SEMUA tempat bernama (sekolah, kampus, toko, masjid, RS, kantor, halte, gedung, dll.)
 *  2. naik.gazetir : nama jalan (digabung per jalan), batas kelurahan/kecamatan, perumahan & nama wilayah
 *  3. alamat tiap POI dilengkapi otomatis: jalan terdekat + kelurahan (titik di dalam poligon kelurahan)
 *
 * Jalankan : php artisan db:seed --class=NaikPoiSeeder
 * Hasil mentah Overpass disimpan di storage/app/osm/*.json (jalan ulang tidak perlu download lagi).
 * Ambil ulang data terbaru dari OSM: hapus folder storage/app/osm lalu jalankan lagi.
 */
class NaikPoiSeeder extends Seeder
{
    /** Kota Bogor + pinggiran (selatan, barat, utara, timur) */
    private const BBOX = '-6.70,106.70,-6.48,106.90';

    /** Server Overpass (dicoba berurutan kalau ada yang sibuk) */
    private const SERVER = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    public function run(): void
    {
        ini_set('memory_limit', '2048M');
        set_time_limit(0);
        $b = self::BBOX;

        $wilayah = $this->ambil('wilayah', "[out:json][timeout:300];
            rel[\"boundary\"=\"administrative\"][\"admin_level\"~\"^(6|7)$\"]($b);
            out tags geom;
            (
              node[\"place\"~\"^(town|suburb|quarter|village|neighbourhood|hamlet)$\"][\"name\"]($b);
              way[\"place\"][\"name\"]($b);
              way[\"landuse\"=\"residential\"][\"name\"]($b);
              rel[\"landuse\"=\"residential\"][\"name\"]($b);
            );
            out tags center;");

        $jalan = $this->ambil('jalan', "[out:json][timeout:300];
            way[\"highway\"][\"name\"][\"highway\"!~\"^(proposed|construction|platform|bus_stop|elevator|corridor)$\"]($b);
            out tags geom;");

        $poi = $this->ambil('poi', "[out:json][timeout:300];
            (
              nwr[\"name\"][\"amenity\"]($b);
              nwr[\"name\"][\"shop\"]($b);
              nwr[\"name\"][\"tourism\"]($b);
              nwr[\"name\"][\"leisure\"]($b);
              nwr[\"name\"][\"office\"]($b);
              nwr[\"name\"][\"healthcare\"]($b);
              nwr[\"name\"][\"craft\"]($b);
              nwr[\"name\"][\"historic\"]($b);
              nwr[\"name\"][\"club\"]($b);
              nwr[\"name\"][\"sport\"]($b);
              nwr[\"name\"][\"public_transport\"]($b);
              nwr[\"name\"][\"railway\"~\"^(station|halt|stop)$\"]($b);
              node[\"name\"][\"highway\"=\"bus_stop\"]($b);
              nwr[\"name\"][\"building\"]($b);
              nwr[\"name\"][\"landuse\"~\"^(commercial|retail|industrial|education|religious|military|cemetery)$\"]($b);
            );
            out tags center;");

        if ($wilayah === null && $jalan === null && $poi === null) {
            $this->info('Overpass tidak bisa dihubungi — hanya mengisi daftar kurasi lokal.');
            $this->simpanKurasi();
            return;
        }

        DB::transaction(function () use ($wilayah, $jalan, $poi) {
            if ($wilayah !== null) {
                $this->simpanWilayah($wilayah);
            }
            if ($jalan !== null) {
                $this->simpanJalan($jalan);
            }
            if ($poi !== null) {
                $this->simpanPoi($poi);
            }
            $this->simpanKurasi();
            $this->info('Melengkapi alamat (jalan + kelurahan)…');
            $this->perkayaAlamat();
        });

        $n = DB::selectOne('SELECT (SELECT count(*) FROM naik.poi) AS poi,
                (SELECT count(*) FROM naik.gazetir WHERE jenis = \'jalan\') AS jalan,
                (SELECT count(*) FROM naik.gazetir WHERE jenis <> \'jalan\') AS wilayah');
        $this->info("Selesai: {$n->poi} tempat, {$n->jalan} jalan, {$n->wilayah} wilayah/perumahan.");
    }

    // ------------------------------------------------------------------ ambil data

    /** Baca dari storage/app/osm/{nama}.json kalau ada; kalau belum, unduh dari Overpass lalu simpan. */
    private function ambil(string $nama, string $query): ?array
    {
        $file = storage_path("app/osm/{$nama}.json");
        if (is_file($file)) {
            $this->info("[{$nama}] pakai file tersimpan {$file}");
            return json_decode(file_get_contents($file), true)['elements'] ?? [];
        }

        foreach (self::SERVER as $server) {
            $this->info("[{$nama}] mengunduh dari {$server} … (bisa 1–3 menit)");
            try {
                $res = Http::timeout(320)->withHeaders(['User-Agent' => 'NAIK-Angkot/1.0 (WebGIS tugas SIG IPB)'])
                    ->asForm()->post($server, ['data' => $query]);
                if ($res->successful() && is_array($res->json('elements'))) {
                    @mkdir(dirname($file), 0775, true);
                    file_put_contents($file, $res->body());
                    $this->info("[{$nama}] " . count($res->json('elements')) . ' elemen');
                    return $res->json('elements');
                }
                $this->info("[{$nama}] gagal (HTTP {$res->status()}), coba server lain");
            } catch (\Throwable $e) {
                $this->info("[{$nama}] gagal: " . $e->getMessage());
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ wilayah

    private function simpanWilayah(array $els): void
    {
        DB::statement("DELETE FROM naik.gazetir WHERE jenis IN ('kelurahan', 'kecamatan', 'perumahan', 'wilayah')");
        $baris = [];

        foreach ($els as $el) {
            $t = $el['tags'] ?? [];
            $nama = trim($t['name'] ?? '');
            if ($nama === '') {
                continue;
            }
            $ref = $el['type'][0] . $el['id'];

            // batas administrasi: poligon dari garis-garis anggota relasi (dirakit oleh ST_BuildArea)
            if (($t['boundary'] ?? null) === 'administrative') {
                $garis = [];
                foreach ($el['members'] ?? [] as $m) {
                    if (($m['type'] ?? '') === 'way' && count($m['geometry'] ?? []) >= 2) {
                        $garis[] = '(' . implode(',', array_map(fn ($p) => "{$p['lon']} {$p['lat']}", $m['geometry'])) . ')';
                    }
                }
                if (!$garis) {
                    continue;
                }
                $jenis = ($t['admin_level'] ?? '') === '6' ? 'kecamatan' : 'kelurahan';
                DB::statement("
                    INSERT INTO naik.gazetir (osm_ref, nama, jenis, bobot, kata_kunci, titik, geom)
                    SELECT ?, ?, ?, ?, ?, ST_PointOnSurface(a), a
                    FROM (SELECT ST_Multi(ST_BuildArea(ST_GeomFromText(?, 4326))) AS a) x
                    WHERE a IS NOT NULL AND NOT ST_IsEmpty(a)
                    ON CONFLICT (osm_ref) DO NOTHING", [
                    $ref, $nama, $jenis, $jenis === 'kecamatan' ? 3 : 2,
                    $this->kunci([$nama, $jenis, $jenis === 'kelurahan' ? 'desa' : 'kec']),
                    'MULTILINESTRING(' . implode(',', $garis) . ')',
                ]);
                continue;
            }

            [$lat, $lon] = $this->koordinat($el);
            if ($lat === null) {
                continue;
            }
            $perumahan = ($t['landuse'] ?? null) === 'residential'
                || preg_match('/^(perum|perumahan|komplek|kompleks|komp\.?|villa|vila|griya|graha|taman|bukit|cluster|residen)/i', $nama);
            $jenis = $perumahan ? 'perumahan' : 'wilayah';
            $bobot = in_array($t['place'] ?? '', ['town', 'suburb', 'village']) ? 2 : 1;
            $baris[] = [$ref, $nama, $jenis, $bobot, $this->kunci([$nama, $perumahan ? 'perumahan perum komplek' : ($t['place'] ?? '')]), $lon, $lat];
        }

        $this->sisipGazetirTitik($baris);
        $this->info('[wilayah] tersimpan');
    }

    private function sisipGazetirTitik(array $baris): void
    {
        foreach (array_chunk($baris, 500) as $chunk) {
            $values = implode(',', array_fill(0, count($chunk), '(?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326))'));
            DB::statement("
                INSERT INTO naik.gazetir (osm_ref, nama, jenis, bobot, kata_kunci, titik)
                VALUES {$values}
                ON CONFLICT (osm_ref) DO UPDATE SET nama = EXCLUDED.nama, jenis = EXCLUDED.jenis, bobot = EXCLUDED.bobot,
                    kata_kunci = EXCLUDED.kata_kunci, titik = EXCLUDED.titik", array_merge(...$chunk));
        }
    }

    // ------------------------------------------------------------------ jalan

    private function simpanJalan(array $els): void
    {
        DB::statement('CREATE TEMP TABLE IF NOT EXISTS _jalan (nama text, kelas smallint, geom geometry(LineString, 4326)) ON COMMIT DROP');
        DB::statement('TRUNCATE _jalan');

        $kelas = ['trunk' => 3, 'primary' => 3, 'secondary' => 2, 'tertiary' => 2, 'trunk_link' => 2, 'primary_link' => 2];
        $baris = [];
        foreach ($els as $el) {
            $nama = trim($el['tags']['name'] ?? '');
            $g = $el['geometry'] ?? [];
            if ($nama === '' || count($g) < 2) {
                continue;
            }
            $wkt = 'LINESTRING(' . implode(',', array_map(fn ($p) => "{$p['lon']} {$p['lat']}", $g)) . ')';
            $baris[] = [$nama, $kelas[$el['tags']['highway'] ?? ''] ?? 1, $wkt];
        }
        foreach (array_chunk($baris, 400) as $chunk) {
            $values = implode(',', array_fill(0, count($chunk), '(?, ?, ST_GeomFromText(?, 4326))'));
            DB::statement("INSERT INTO _jalan (nama, kelas, geom) VALUES {$values}", array_merge(...$chunk));
        }

        // ruas bernama sama yang saling berdekatan (< ±400 m) = satu jalan; jalan senama di perumahan lain tetap terpisah
        DB::statement("DELETE FROM naik.gazetir WHERE jenis = 'jalan'");
        DB::statement("
            INSERT INTO naik.gazetir (osm_ref, nama, jenis, bobot, kata_kunci, titik, geom)
            SELECT 'jalan:' || md5(nama || ':' || ST_AsText(ST_PointN(ST_GeometryN(g, 1), 1))), nama, 'jalan', bobot,
                   lower(nama) || CASE WHEN nama ILIKE 'jalan %' THEN ' jl' WHEN nama ILIKE 'gang %' THEN ' gg' ELSE '' END,
                   ST_ClosestPoint(g, ST_Centroid(g)), g
            FROM (
                SELECT nama, MAX(kelas) AS bobot, ST_Multi(ST_Collect(geom)) AS g
                FROM (SELECT *, ST_ClusterDBSCAN(geom, eps := 0.0035, minpoints := 1) OVER (PARTITION BY nama) AS klaster FROM _jalan) c
                GROUP BY nama, klaster
            ) x
            ON CONFLICT (osm_ref) DO NOTHING");
        $this->info('[jalan] ' . count($baris) . ' ruas digabung per jalan');
    }

    // ------------------------------------------------------------------ POI

    private function simpanPoi(array $els): void
    {
        $baris = [];
        foreach ($els as $el) {
            $t = $el['tags'] ?? [];
            $nama = trim($t['name'] ?? '');
            if ($nama === '') {
                continue;
            }
            [$lat, $lon] = $this->koordinat($el);
            if ($lat === null) {
                continue;
            }
            [$kategori, $sub, $label, $bobot] = $this->klasifikasi($t);
            $alamat = trim(($t['addr:street'] ?? '') . ' ' . ($t['addr:housenumber'] ?? '')) ?: ($t['addr:full'] ?? null);
            $kunci = $this->kunci([$nama, $t['alt_name'] ?? '', $t['official_name'] ?? '', $t['short_name'] ?? '', $t['old_name'] ?? '',
                $t['brand'] ?? '', $t['name:en'] ?? '', $label]);
            $baris[] = [$el['id'], $el['type'][0] . $el['id'], mb_substr($nama, 0, 255), $kategori, mb_substr((string) $sub, 0, 50), $alamat, $kunci, $bobot, $lon, $lat];
        }

        foreach (array_chunk($baris, 500) as $chunk) {
            $values = implode(',', array_fill(0, count($chunk), "(?, ?, ?, ?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), 'OpenStreetMap')"));
            DB::statement("
                INSERT INTO naik.poi (osm_id, osm_ref, nama_tempat, kategori, sub_kategori, alamat, kata_kunci, bobot, geom, sumber_data)
                VALUES {$values}
                ON CONFLICT (osm_ref) DO UPDATE SET nama_tempat = EXCLUDED.nama_tempat, kategori = EXCLUDED.kategori,
                    sub_kategori = EXCLUDED.sub_kategori, alamat = EXCLUDED.alamat, kata_kunci = EXCLUDED.kata_kunci,
                    bobot = EXCLUDED.bobot, geom = EXCLUDED.geom, updated_at = CURRENT_TIMESTAMP", array_merge(...$chunk));
        }

        // tempat yang sama tercatat dua kali (mis. titik "SMAN 1" + gedung "SMAN 1") -> simpan yang paling penting
        DB::statement("
            DELETE FROM naik.poi a USING naik.poi b
            WHERE a.poi_id <> b.poi_id AND a.sumber_data = 'OpenStreetMap'
              AND lower(a.nama_tempat) = lower(b.nama_tempat) AND ST_DWithin(a.geom, b.geom, 0.0008)
              AND (a.bobot < b.bobot OR (a.bobot = b.bobot AND a.poi_id > b.poi_id))");
        $this->info('[poi] ' . count($baris) . ' tempat bernama');
    }

    /** Lengkapi alamat: "Jalan X No", kelurahan — dari jalan terdekat & poligon kelurahan. */
    private function perkayaAlamat(): void
    {
        $kel = "COALESCE(
                    (SELECT k.nama FROM naik.gazetir k WHERE k.jenis = 'kelurahan' AND ST_Contains(k.geom, %1\$s) LIMIT 1),
                    (SELECT w.nama FROM naik.gazetir w WHERE w.jenis IN ('kelurahan', 'wilayah') AND ST_DWithin(w.titik, %1\$s, 0.02)
                     ORDER BY w.titik <-> %1\$s LIMIT 1))";

        DB::statement('UPDATE naik.gazetir j SET ket = ' . sprintf($kel, 'j.titik') . " WHERE j.jenis IN ('jalan', 'perumahan')");

        DB::statement("
            WITH x AS (
                SELECT p.poi_id,
                       COALESCE(NULLIF(p.alamat, ''),
                           (SELECT j.nama FROM naik.gazetir j WHERE j.jenis = 'jalan' AND ST_DWithin(j.geom, p.geom, 0.0015)
                            ORDER BY j.geom <-> p.geom LIMIT 1)) AS jalan,
                       " . sprintf($kel, 'p.geom') . " AS kel
                FROM naik.poi p WHERE p.sumber_data = 'OpenStreetMap'
            )
            UPDATE naik.poi p
            SET alamat = NULLIF(concat_ws(', ', x.jalan, CASE WHEN x.kel IS DISTINCT FROM x.jalan THEN x.kel END), ''),
                kata_kunci = p.kata_kunci || ' ' || lower(COALESCE(concat_ws(' ', x.jalan, x.kel), ''))
            FROM x WHERE x.poi_id = p.poi_id");
    }

    // ------------------------------------------------------------------ kurasi lokal (selalu ada walau Overpass gagal)

    private function simpanKurasi(): void
    {
        $kurasi = [
            ['Stasiun Bogor', 'transportasi', 'station', 'Jl. Nyi Raja Permas, Cibogor', -6.594289, 106.790770, 'stasiun krl kereta'],
            ['Terminal Baranangsiang', 'transportasi', 'bus_station', 'Jl. Pajajaran, Baranangsiang', -6.604086, 106.805958, 'terminal bus'],
            ['Terminal Bubulak', 'transportasi', 'bus_station', 'Jl. KH R. Abdullah Bin Nuh, Bubulak', -6.569292, 106.755167, 'terminal'],
            ['Terminal Merdeka', 'transportasi', 'bus_station', 'Jl. Merdeka, Ciwaringin', -6.592376, 106.786418, 'terminal angkot'],
            ['Terminal Laladon', 'transportasi', 'bus_station', 'Laladon, Ciomas', -6.576539, 106.752946, 'terminal'],
            ['Kebun Raya Bogor', 'wisata', 'park', 'Jl. Ir. H. Juanda No.13, Paledang', -6.597629, 106.799569, 'taman wisata krb'],
            ['Museum Zoologi Bogor', 'wisata', 'museum', 'Jl. Ir. H. Juanda No.9, Paledang', -6.602220, 106.797220, 'museum'],
            ['Taman Sempur', 'wisata', 'park', 'Sempur, Bogor Tengah', -6.590800, 106.800500, 'taman'],
            ['Alun-Alun Kota Bogor', 'wisata', 'park', 'Jl. Kapten Muslihat, Pabaton', -6.595100, 106.791200, 'taman alun alun'],
            ['Bogor Trade Mall (BTM)', 'belanja', 'mall', 'Jl. Ir. H. Juanda No.68, Paledang', -6.605046, 106.796286, 'mall btm'],
            ['Botani Square Mall', 'belanja', 'mall', 'Jl. Pajajaran, Tegallega', -6.601700, 106.806200, 'mall botsq'],
            ['Pasar Anyar', 'belanja', 'market', 'Jl. Pabaton, Bogor Tengah', -6.592200, 106.792550, 'pasar'],
            ['IPB University Kampus Baranangsiang', 'pendidikan', 'university', 'Jl. Pajajaran, Baranangsiang', -6.601100, 106.804900, 'kampus universitas institut pertanian bogor'],
            ['IPB University Kampus Dramaga', 'pendidikan', 'university', 'Jl. Raya Dramaga, Babakan', -6.558961, 106.725946, 'kampus universitas institut pertanian bogor'],
            ['Sekolah Vokasi IPB University', 'pendidikan', 'college', 'Jl. Kumbang No.14, Babakan', -6.588536, 106.806272, 'kampus vokasi sv ipb cilibende'],
            ['Universitas Pakuan', 'pendidikan', 'university', 'Jl. Pakuan, Tegallega', -6.602300, 106.812900, 'kampus unpak'],
            ['RS PMI Bogor', 'kesehatan', 'hospital', 'Jl. Pajajaran No.80, Tegallega', -6.598200, 106.804300, 'rumah sakit rs'],
            ['RSUD Kota Bogor', 'kesehatan', 'hospital', 'Jl. DR. Sumeru No.120, Menteng', -6.583500, 106.772500, 'rumah sakit rs'],
        ];
        foreach ($kurasi as $i => $k) {
            DB::statement("
                INSERT INTO naik.poi (osm_ref, nama_tempat, kategori, sub_kategori, alamat, kata_kunci, bobot, geom, sumber_data)
                VALUES (?, ?, ?, ?, ?, ?, 3, ST_SetSRID(ST_MakePoint(?, ?), 4326), 'Kurasi Lokal')
                ON CONFLICT (osm_ref) DO UPDATE SET nama_tempat = EXCLUDED.nama_tempat, alamat = EXCLUDED.alamat,
                    kata_kunci = EXCLUDED.kata_kunci, geom = EXCLUDED.geom", [
                'kurasi' . ($i + 1), $k[0], $k[1], $k[2], $k[3], $this->kunci([$k[0], $k[6], $k[3]]), $k[5], $k[4],
            ]);
        }
    }

    // ------------------------------------------------------------------ bantuan

    private function koordinat(array $el): array
    {
        if (isset($el['lat'], $el['lon'])) {
            return [(float) $el['lat'], (float) $el['lon']];
        }
        if (isset($el['center'])) {
            return [(float) $el['center']['lat'], (float) $el['center']['lon']];
        }
        return [null, null];
    }

    private function kunci(array $bagian): string
    {
        $teks = mb_strtolower(implode(' ', array_filter(array_map('trim', $bagian))));
        return trim(preg_replace('/\s+/', ' ', $teks));
    }

    /**
     * Tag OSM -> [kategori, sub_kategori, kata kunci Indonesia, bobot penting (0–3)].
     * Kata kunci membuat "sekolah" ketemu "SDN Polisi 1", "rs" ketemu "RS PMI", dst.
     */
    private function klasifikasi(array $t): array
    {
        $a = $t['amenity'] ?? null;
        $amenity = [
            'university' => ['pendidikan', 'universitas kampus perguruan tinggi', 3],
            'college' => ['pendidikan', 'kampus sekolah tinggi politeknik akademi vokasi', 3],
            'school' => ['pendidikan', 'sekolah sd smp sma smk mi mts ma', 2],
            'kindergarten' => ['pendidikan', 'tk paud sekolah taman kanak', 1],
            'hospital' => ['kesehatan', 'rumah sakit rs', 3],
            'clinic' => ['kesehatan', 'klinik puskesmas balai pengobatan', 2],
            'doctors' => ['kesehatan', 'dokter praktik', 1],
            'dentist' => ['kesehatan', 'dokter gigi', 1],
            'pharmacy' => ['kesehatan', 'apotek apotik obat', 1],
            'restaurant' => ['kuliner', 'restoran rumah makan tempat makan', 1],
            'cafe' => ['kuliner', 'kafe cafe kopi coffee', 1],
            'fast_food' => ['kuliner', 'makanan cepat saji tempat makan', 1],
            'food_court' => ['kuliner', 'food court pujasera', 1],
            'marketplace' => ['belanja', 'pasar', 3],
            'bank' => ['keuangan', 'bank', 1],
            'atm' => ['keuangan', 'atm', 0],
            'bus_station' => ['transportasi', 'terminal bus angkot', 3],
            'taxi' => ['transportasi', 'pangkalan', 0],
            'fuel' => ['layanan', 'spbu pom bensin pertamina', 1],
            'police' => ['kantor', 'polisi polsek polres polresta', 2],
            'fire_station' => ['kantor', 'pemadam kebakaran damkar', 1],
            'post_office' => ['kantor', 'kantor pos', 1],
            'townhall' => ['kantor', 'kantor kelurahan kecamatan balai kota pemerintah', 2],
            'courthouse' => ['kantor', 'pengadilan', 1],
            'community_centre' => ['layanan', 'balai warga gedung serbaguna', 1],
            'library' => ['pendidikan', 'perpustakaan', 1],
            'cinema' => ['wisata', 'bioskop', 2],
            'place_of_worship' => ['ibadah', 'tempat ibadah', 1],
            'parking' => ['layanan', 'parkir', 0],
        ];
        if ($a === 'place_of_worship') {
            $agama = ['muslim' => 'masjid musholla mushola surau', 'christian' => 'gereja', 'buddhist' => 'vihara klenteng', 'hindu' => 'pura', 'confucian' => 'klenteng'];
            return ['ibadah', $a, $agama[$t['religion'] ?? ''] ?? 'tempat ibadah', 1];
        }
        if ($a && isset($amenity[$a])) {
            return [$amenity[$a][0], $a, $amenity[$a][1], $amenity[$a][2]];
        }

        if (isset($t['railway']) && in_array($t['railway'], ['station', 'halt', 'stop'])) {
            return ['transportasi', 'station', 'stasiun kereta krl commuter', 3];
        }
        if (($t['highway'] ?? null) === 'bus_stop' || isset($t['public_transport'])) {
            return ['transportasi', 'bus_stop', 'halte shelter pemberhentian', 1];
        }

        if ($s = $t['shop'] ?? null) {
            $shop = [
                'mall' => ['mall pusat perbelanjaan plaza', 3], 'department_store' => ['toserba pusat perbelanjaan', 2],
                'supermarket' => ['supermarket swalayan', 2], 'convenience' => ['minimarket indomaret alfamart warung', 1],
                'bakery' => ['toko roti kue', 1], 'clothes' => ['toko baju pakaian', 1], 'electronics' => ['toko elektronik', 1],
                'mobile_phone' => ['toko hp handphone ponsel', 1], 'hardware' => ['toko bangunan material', 1],
                'books' => ['toko buku', 1], 'stationery' => ['alat tulis atk fotokopi', 1], 'car_repair' => ['bengkel mobil', 1],
                'motorcycle' => ['dealer bengkel motor', 1], 'hairdresser' => ['salon pangkas rambut barbershop', 0],
                'laundry' => ['laundry binatu', 0],
            ];
            return ['belanja', $s, $shop[$s][0] ?? 'toko', $shop[$s][1] ?? 1];
        }

        if ($v = $t['tourism'] ?? null) {
            $tour = ['hotel' => ['akomodasi', 'hotel penginapan', 2], 'guest_house' => ['akomodasi', 'penginapan guest house', 1],
                'hostel' => ['akomodasi', 'penginapan hostel', 1], 'museum' => ['wisata', 'museum', 2], 'zoo' => ['wisata', 'kebun binatang', 2],
                'theme_park' => ['wisata', 'taman bermain wisata', 2], 'attraction' => ['wisata', 'tempat wisata', 2]];
            return [$tour[$v][0] ?? 'wisata', $v, $tour[$v][1] ?? 'wisata', $tour[$v][2] ?? 1];
        }

        if ($v = $t['leisure'] ?? null) {
            $lei = ['park' => ['wisata', 'taman', 2], 'stadium' => ['olahraga', 'stadion', 3], 'sports_centre' => ['olahraga', 'gor gelanggang olahraga', 2],
                'pitch' => ['olahraga', 'lapangan', 1], 'swimming_pool' => ['olahraga', 'kolam renang', 1], 'fitness_centre' => ['olahraga', 'gym fitness', 1],
                'playground' => ['wisata', 'taman bermain', 0]];
            return [$lei[$v][0] ?? 'wisata', $v, $lei[$v][1] ?? 'rekreasi', $lei[$v][2] ?? 1];
        }

        if ($v = $t['office'] ?? null) {
            $label = $v === 'government' ? 'kantor pemerintah dinas instansi' : ($v === 'company' ? 'kantor perusahaan' : 'kantor');
            return ['kantor', $v, $label, $v === 'government' ? 2 : 1];
        }
        if (isset($t['healthcare'])) {
            return ['kesehatan', $t['healthcare'], 'kesehatan klinik', 1];
        }
        if (isset($t['sport'])) {
            return ['olahraga', $t['sport'], 'olahraga lapangan', 1];
        }
        if (isset($t['historic'])) {
            return ['wisata', $t['historic'], 'sejarah cagar budaya', 1];
        }
        if (isset($t['craft'])) {
            return ['layanan', $t['craft'], 'usaha kerajinan', 0];
        }

        if ($v = $t['landuse'] ?? null) {
            $lu = ['commercial' => 'kawasan komersial', 'retail' => 'kawasan pertokoan', 'industrial' => 'kawasan industri pabrik',
                'education' => 'kawasan pendidikan kampus sekolah', 'religious' => 'kompleks ibadah', 'military' => 'kawasan militer',
                'cemetery' => 'makam tpu pemakaman'];
            return ['lainnya', $v, $lu[$v] ?? 'kawasan', 1];
        }

        $bld = ['university' => ['pendidikan', 'kampus gedung', 2], 'school' => ['pendidikan', 'sekolah gedung', 1],
            'hospital' => ['kesehatan', 'rumah sakit gedung', 2], 'mosque' => ['ibadah', 'masjid', 1], 'church' => ['ibadah', 'gereja', 1],
            'apartments' => ['lainnya', 'apartemen', 1], 'hotel' => ['akomodasi', 'hotel', 1], 'retail' => ['belanja', 'toko pertokoan', 1],
            'office' => ['kantor', 'kantor gedung', 1], 'government' => ['kantor', 'kantor pemerintah gedung', 1]];
        $v = $t['building'] ?? 'yes';
        return [$bld[$v][0] ?? 'lainnya', 'building', $bld[$v][1] ?? 'gedung', $bld[$v][2] ?? 0];
    }

    private function info(string $pesan): void
    {
        $this->command?->info($pesan);
    }
}
