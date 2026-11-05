<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NaikPoiSeeder extends Seeder
{
    /**
     * Seed tabel naik.poi dari OpenStreetMap (Overpass API) dengan fallback kurasi lokal.
     */
    public function run(): void
    {
        $osmCount = $this->seedFromOverpass();

        if ($osmCount === 0) {
            $this->seedCuratedList();
        }
    }

    /**
     * Ambil data POI Kota Bogor secara langsung dari Overpass API OpenStreetMap.
     */
    private function seedFromOverpass(): int
    {
        $overpassQuery = '
            [out:json][timeout:25];
            (
              node["amenity"~"restaurant|cafe|fast_food|food_court|hospital|clinic|university|college|school|bus_station"](-6.66,106.74,-6.53,106.86);
              node["tourism"~"attraction|museum|viewpoint|theme_park"](-6.66,106.74,-6.53,106.86);
              node["leisure"="park"](-6.66,106.74,-6.53,106.86);
              node["shop"~"mall|supermarket|department_store|bakery"](-6.66,106.74,-6.53,106.86);
            );
            out body 200;
        ';

        try {
            $response = Http::timeout(15)->asForm()->post('https://overpass-api.de/api/interpreter', [
                'data' => $overpassQuery,
            ]);

            if (!$response->successful()) {
                return 0;
            }

            $elements = $response->json('elements') ?? [];
            $inserted = 0;

            foreach ($elements as $el) {
                $tags = $el['tags'] ?? [];
                $nama = $tags['name'] ?? null;

                if (!$nama) {
                    continue;
                }

                $kategori = $this->resolveKategori($tags);
                $subKategori = $tags['amenity'] ?? $tags['tourism'] ?? $tags['shop'] ?? $tags['leisure'] ?? null;
                $alamat = $tags['addr:street'] ?? ($tags['addr:full'] ?? null);

                DB::statement('
                    INSERT INTO naik.poi (osm_id, nama_tempat, kategori, sub_kategori, alamat, geom, sumber_data)
                    VALUES (?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), \'OpenStreetMap\')
                    ON CONFLICT (osm_id) DO UPDATE
                    SET nama_tempat = EXCLUDED.nama_tempat,
                        kategori = EXCLUDED.kategori,
                        sub_kategori = EXCLUDED.sub_kategori,
                        alamat = COALESCE(EXCLUDED.alamat, naik.poi.alamat),
                        geom = EXCLUDED.geom,
                        updated_at = CURRENT_TIMESTAMP
                ', [
                    $el['id'],
                    $nama,
                    $kategori,
                    $subKategori,
                    $alamat,
                    $el['lon'],
                    $el['lat'],
                ]);

                $inserted++;
            }

            return $inserted;
        } catch (\Throwable $e) {
            Log::warning('Gagal fetch Overpass API: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Dataset kurasi tempat penting di koridor trayek angkot Kota Bogor.
     */
    private function seedCuratedList(): void
    {
        $curated = [
            // Transportasi
            ['Stasiun Bogor', 'transportasi', 'station', 'Jl. Nyi Raja Permas, Cibogor', -6.594289, 106.790770],
            ['Terminal Baranangsiang', 'transportasi', 'bus_station', 'Jl. Pajajaran, Baranangsiang', -6.604086, 106.805958],
            ['Terminal Bubulak', 'transportasi', 'bus_station', 'Jl. KH R. Abdullah Bin Nuh, Bubulak', -6.569292, 106.755167],
            ['Terminal Merdeka', 'transportasi', 'bus_station', 'Jl. Merdeka, Ciwaringin', -6.592376, 106.786418],
            ['Terminal Laladon', 'transportasi', 'bus_station', 'Laladon, Ciomas', -6.576539, 106.752946],

            // Wisata & Rekreasi
            ['Kebun Raya Bogor', 'wisata', 'park', 'Jl. Ir. H. Juanda No.13, Paledang', -6.597629, 106.799569],
            ['Museum Zoologi Bogor', 'wisata', 'museum', 'Jl. Ir. H. Juanda No.9, Paledang', -6.602220, 106.797220],
            ['Taman Kencana', 'wisata', 'park', 'Jl. Taman Kencana No.1, Babakan', -6.588820, 106.802310],
            ['Taman Heulang', 'wisata', 'park', 'Jl. Heulang, Tanah Sareal', -6.574100, 106.797900],
            ['Alun-Alun Kota Bogor', 'wisata', 'park', 'Jl. Kapten Muslihat, Pabaton', -6.595100, 106.791200],
            ['Taman Sempur', 'wisata', 'park', 'Sempur, Bogor Tengah', -6.590800, 106.800500],

            // Kuliner
            ['Toge Goreng Ibu Hj. Omah', 'kuliner', 'restaurant', 'Jl. Jend. Sudirman No.23', -6.589120, 106.793210],
            ['Soto Kuning Pak Salam', 'kuliner', 'restaurant', 'Jl. Suryakencana, Babakan Pasar', -6.602110, 106.799120],
            ['Asinan Sedap Gedung Dalam', 'kuliner', 'restaurant', 'Jl. Siliwangi No.27C, Sukasari', -6.613200, 106.808900],
            ['Ngo Hiang Gedung Dalam', 'kuliner', 'restaurant', 'Jl. Suryakencana No.256', -6.605400, 106.800900],
            ['Roti Unyil Venus', 'kuliner', 'bakery', 'Jl. Pajajaran No.1, Sukasari', -6.611100, 106.807800],
            ['Kopi Nako Pajajaran', 'kuliner', 'cafe', 'Jl. Pajajaran Indah V No.7', -6.609500, 106.812200],
            ['Popolo Coffee Taman Kencana', 'kuliner', 'cafe', 'Jl. Loader No.9, Baranangsiang', -6.599100, 106.809300],
            ['Es Sekoteng Bogor Permai', 'kuliner', 'cafe', 'Jl. Jend. Sudirman No.23', -6.587800, 106.794100],

            // Pusat Belanja
            ['Bogor Trade Mall (BTM)', 'belanja', 'mall', 'Jl. Ir. H. Juanda No.68, Paledang', -6.605046, 106.796286],
            ['Botani Square Mall', 'belanja', 'mall', 'Jl. Pajajaran, Tegallega', -6.601700, 106.806200],
            ['Lippo Plaza Keboen Raya', 'belanja', 'mall', 'Jl. Pajajaran No.27, Babakan', -6.594600, 106.804800],
            ['Pasar Anyar', 'belanja', 'market', 'Jl. Pabaton, Bogor Tengah', -6.592200, 106.792550],
            ['Pasar Bogor (Suryakencana)', 'belanja', 'market', 'Jl. Suryakencana, Babakan Pasar', -6.602977, 106.799076],

            // Pendidikan
            ['Institut Pertanian Bogor (Kampus Baranangsiang)', 'pendidikan', 'university', 'Jl. Pajajaran, Baranangsiang', -6.601100, 106.804900],
            ['Universitas Pakuan', 'pendidikan', 'university', 'Jl. Pakuan, Tegallega', -6.602300, 106.812900],
            ['Universitas Ibn Khaldun', 'pendidikan', 'university', 'Jl. KH R. Abdullah Bin Nuh', -6.561500, 106.779400],
            ['SMAN 1 Kota Bogor', 'pendidikan', 'school', 'Jl. Ir. H. Juanda No.16', -6.592900, 106.793800],

            // Kesehatan
            ['RS PMI Bogor', 'kesehatan', 'hospital', 'Jl. Pajajaran No.80, Tegallega', -6.598200, 106.804300],
            ['RS Siloam Bogor', 'kesehatan', 'hospital', 'Jl. Pajajaran No.27, Babakan', -6.594900, 106.805200],
            ['RS Salak Bogor', 'kesehatan', 'hospital', 'Jl. Jend. Sudirman No.8, Sempur', -6.590100, 106.794600],
            ['RSUD Kota Bogor', 'kesehatan', 'hospital', 'Jl. DR. Sumeru No.120, Menteng', -6.583500, 106.772500],
        ];

        foreach ($curated as $item) {
            DB::statement('
                INSERT INTO naik.poi (nama_tempat, kategori, sub_kategori, alamat, geom, sumber_data)
                VALUES (?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), \'Kurasi Lokal\')
                ON CONFLICT DO NOTHING
            ', [
                $item[0],
                $item[1],
                $item[2],
                $item[3],
                $item[5],
                $item[4],
            ]);
        }
    }

    /**
     * Klasifikasikan tag OSM ke kategori sistem.
     */
    private function resolveKategori(array $tags): string
    {
        if (isset($tags['amenity'])) {
            if (in_array($tags['amenity'], ['restaurant', 'cafe', 'fast_food', 'food_court'])) {
                return 'kuliner';
            }
            if (in_array($tags['amenity'], ['hospital', 'clinic', 'pharmacy'])) {
                return 'kesehatan';
            }
            if (in_array($tags['amenity'], ['university', 'college', 'school'])) {
                return 'pendidikan';
            }
            if ($tags['amenity'] === 'bus_station') {
                return 'transportasi';
            }
        }

        if (isset($tags['tourism']) || (isset($tags['leisure']) && $tags['leisure'] === 'park')) {
            return 'wisata';
        }

        if (isset($tags['shop'])) {
            return 'belanja';
        }

        return 'lainnya';
    }
}

