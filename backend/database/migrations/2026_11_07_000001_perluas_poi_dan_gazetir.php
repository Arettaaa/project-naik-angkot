<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data tempat lengkap untuk pencarian ala aplikasi ojol:
 * - naik.poi diperluas: osm_ref (n123/w456/r789, karena id node/way/relation bisa bentrok), kata_kunci, bobot
 * - naik.gazetir (baru): nama jalan, kelurahan/kecamatan, perumahan — untuk pencarian & alamat (reverse geocoding)
 */
return new class extends Migration
{
    // tanpa transaksi: kalau CREATE EXTENSION pg_trgm ditolak, langkah lain tetap tersimpan
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement('ALTER TABLE naik.poi DROP CONSTRAINT IF EXISTS poi_osm_id_key');
        DB::statement('ALTER TABLE naik.poi ADD COLUMN IF NOT EXISTS osm_ref VARCHAR(20)');
        DB::statement('ALTER TABLE naik.poi ADD COLUMN IF NOT EXISTS kata_kunci TEXT');
        DB::statement('ALTER TABLE naik.poi ADD COLUMN IF NOT EXISTS bobot SMALLINT NOT NULL DEFAULT 1');
        DB::statement("UPDATE naik.poi SET osm_ref = 'n' || osm_id WHERE osm_ref IS NULL AND osm_id IS NOT NULL");
        // baris kurasi lama tanpa kunci akan diisi ulang seeder (kuncinya kurasi1, kurasi2, …) -> hapus supaya tidak dobel
        DB::statement("DELETE FROM naik.poi WHERE osm_ref IS NULL AND sumber_data = 'Kurasi Lokal'");
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS uq_poi_osm_ref ON naik.poi (osm_ref)');
        DB::statement("UPDATE naik.poi SET kata_kunci = lower(concat_ws(' ', nama_tempat, kategori, alamat)) WHERE kata_kunci IS NULL");

        DB::statement("
            CREATE TABLE IF NOT EXISTS naik.gazetir (
                gazetir_id  BIGSERIAL PRIMARY KEY,
                osm_ref     VARCHAR(40) UNIQUE,
                nama        VARCHAR(255) NOT NULL,
                jenis       VARCHAR(20) NOT NULL,      -- jalan | kelurahan | kecamatan | perumahan | wilayah
                ket         TEXT,                      -- konteks, mis. nama kelurahan
                bobot       SMALLINT NOT NULL DEFAULT 1,
                kata_kunci  TEXT,
                titik       geometry(Point, 4326) NOT NULL,   -- titik wakil (untuk hasil pencarian)
                geom        geometry(Geometry, 4326)          -- garis jalan / poligon wilayah (untuk alamat)
            )
        ");
        DB::statement('CREATE INDEX IF NOT EXISTS idx_gazetir_titik ON naik.gazetir USING GIST (titik)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_gazetir_geom ON naik.gazetir USING GIST (geom)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_gazetir_jenis ON naik.gazetir (jenis)');

        // pencarian teks cepat (ILIKE '%...%'). pg_trgm butuh hak buat extension; kalau gagal, tetap jalan tanpa index.
        try {
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_poi_kata_trgm ON naik.poi USING GIN (kata_kunci gin_trgm_ops)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_gazetir_kata_trgm ON naik.gazetir USING GIN (kata_kunci gin_trgm_ops)');
        } catch (\Throwable $e) {
            // abaikan
        }
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS naik.gazetir');
        DB::statement('DROP INDEX IF EXISTS naik.uq_poi_osm_ref');
        DB::statement('ALTER TABLE naik.poi DROP COLUMN IF EXISTS osm_ref, DROP COLUMN IF EXISTS kata_kunci, DROP COLUMN IF EXISTS bobot');
    }
};
