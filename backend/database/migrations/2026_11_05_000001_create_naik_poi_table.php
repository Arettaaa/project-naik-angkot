<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement('CREATE SCHEMA IF NOT EXISTS naik');

        DB::statement('
            CREATE TABLE IF NOT EXISTS naik.poi (
                poi_id              BIGSERIAL PRIMARY KEY,
                osm_id              BIGINT UNIQUE,
                nama_tempat         VARCHAR(255) NOT NULL,
                kategori            VARCHAR(50) NOT NULL,
                sub_kategori        VARCHAR(50),
                alamat              TEXT,
                geom                geometry(Point, 4326) NOT NULL,
                sumber_data         VARCHAR(50) DEFAULT \'OpenStreetMap\',
                created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        ');

        DB::statement('CREATE INDEX IF NOT EXISTS idx_poi_geom ON naik.poi USING GIST (geom)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_poi_kategori ON naik.poi (kategori)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_poi_nama ON naik.poi (nama_tempat)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS naik.poi CASCADE');
    }
};

