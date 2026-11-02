# ===== BUAT SKEMA RUTE DI POSTGIS (sesuai rancangan database NAIK) - PyQGIS =====
# Syarat: import_to_postgis.py sudah dijalankan (tabel public.trayek_snapped & public.kepadatan_trayek ada).
# Cara pakai: Python Console > Show Editor > Open Script > Run
#
# Semua tabel dibuat di schema "naik" (biar nggak tabrakan dengan tabel/migrasi Laravel di public):
#   sumber_data, rute, rute_geometri, ruas_jalan, rute_ruas_jalan, hasil_kepadatan,
#   titik_transfer, tarif_rute (kosong, diisi manual) + 2 view (v_rute_peta, v_ruas_kepadatan)
# Script ini aman dijalankan ulang: tabel turunan dibangun ulang, sumber_data & tarif_rute TIDAK dihapus.
#
# Penyesuaian dari rancangan di dokumen:
#   - rute = 1 baris per (kode_trayek, arah), jadi ada kolom arah (urutan ruas beda tiap arah)
#   - tipe YEAR nggak ada di PostgreSQL -> SMALLINT
#   - tarif_rute dikaitkan ke kode_trayek (tarif flat per trayek), bukan rute_id

from qgis.core import *

CONN_NAME = "NAIK ANGKOT"
LOVELY_URL = "https://lovelybogor.com/blog/2025/11/04/rute-angkot-kota-bogor/"
NAMA_BLOG  = "Daftar Trayek Angkot Kota Bogor 2025 (teks identik di Lovely Bogor, lapakfjbku.com, liburmulu.com)"

STATEMENTS = [
# ---------- schema & tabel permanen ----------
"CREATE SCHEMA IF NOT EXISTS naik",

"""CREATE TABLE IF NOT EXISTS naik.sumber_data (
  sumber_id     SERIAL PRIMARY KEY,
  nama_sumber   VARCHAR(150) NOT NULL,
  jenis_sumber  VARCHAR(50),
  tahun_data    SMALLINT,
  url_sumber    TEXT,
  tanggal_akses DATE
)""",

"ALTER TABLE naik.sumber_data ALTER COLUMN nama_sumber TYPE TEXT",

f"""INSERT INTO naik.sumber_data (nama_sumber, jenis_sumber, tahun_data, url_sumber, tanggal_akses)
SELECT '{NAMA_BLOG}', 'Sekunder (blog)', 2025, '{LOVELY_URL}', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM naik.sumber_data WHERE url_sumber = '{LOVELY_URL}')""",

"""INSERT INTO naik.sumber_data (nama_sumber, jenis_sumber, tahun_data, url_sumber, tanggal_akses)
SELECT 'OpenStreetMap (jaringan jalan via Overpass API)', 'OSM', 2026, 'https://www.openstreetmap.org', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM naik.sumber_data WHERE url_sumber = 'https://www.openstreetmap.org')""",

"""INSERT INTO naik.sumber_data (nama_sumber, jenis_sumber, tahun_data, url_sumber, tanggal_akses)
SELECT 'Moovit - jalur Angkutan Kota Bogor (urutan halte)', 'Sekunder (aplikasi, mitra BPTJ)', 2026, 'https://moovitapp.com', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM naik.sumber_data WHERE url_sumber = 'https://moovitapp.com')""",

f"""UPDATE naik.sumber_data SET nama_sumber = '{NAMA_BLOG}', jenis_sumber = 'Sekunder (blog)'
WHERE url_sumber = '{LOVELY_URL}'""",

"""CREATE TABLE IF NOT EXISTS naik.tarif_rute (
  tarif_id    SERIAL PRIMARY KEY,
  kode_trayek VARCHAR(20) NOT NULL,
  tarif       NUMERIC(10,0),
  tahun_data  SMALLINT,
  keterangan  VARCHAR(100),
  sumber_id   INT REFERENCES naik.sumber_data(sumber_id)
)""",

"""DELETE FROM naik.tarif_rute a USING naik.tarif_rute b
WHERE a.kode_trayek = b.kode_trayek AND a.tarif_id > b.tarif_id""",
"CREATE UNIQUE INDEX IF NOT EXISTS uq_tarif_kode ON naik.tarif_rute (kode_trayek)",

# ---------- bangun ulang tabel turunan ----------
"DROP TABLE IF EXISTS naik.titik_transfer, naik.hasil_kepadatan, naik.rute_ruas_jalan, naik.rute_geometri, naik.ruas_jalan, naik.rute CASCADE",

"""CREATE TABLE naik.rute (
  rute_id           SERIAL PRIMARY KEY,
  kode_trayek       VARCHAR(20)  NOT NULL,
  arah              TEXT         NOT NULL,
  nama_trayek       TEXT,
  asal              TEXT,
  tujuan            TEXT,
  lintasan          TEXT,
  status            TEXT,
  kualitas_geometri TEXT,
  sumber_id         INT REFERENCES naik.sumber_data(sumber_id),
  UNIQUE (kode_trayek, arah)
)""",

f"""INSERT INTO naik.rute (kode_trayek, arah, nama_trayek, asal, tujuan, lintasan, status, kualitas_geometri, sumber_id)
SELECT t.kode_trayek, t.arah, t.nama_trayek,
       btrim(split_part(t.lintasan, ' > ', 1)),
       btrim(split_part(t.lintasan, ' > ', array_length(string_to_array(t.lintasan, ' > '), 1))),
       t.lintasan, 'Aktif', t.validasi || COALESCE(' - ' || NULLIF(t.catatan,''), ''),
       CASE WHEN t.sumber LIKE 'Moovit%'
            THEN (SELECT sumber_id FROM naik.sumber_data WHERE url_sumber = 'https://moovitapp.com')
            ELSE (SELECT sumber_id FROM naik.sumber_data WHERE url_sumber = '{LOVELY_URL}') END
FROM public.trayek_snapped t""",

"""CREATE TABLE naik.rute_geometri (
  geometri_id SERIAL PRIMARY KEY,
  rute_id     INT NOT NULL REFERENCES naik.rute(rute_id) ON DELETE CASCADE,
  tahun_data  SMALLINT,
  panjang_m   NUMERIC(12,1),
  max_snap_m  NUMERIC(10,1),
  geom        geometry(MultiLineString, 4326) NOT NULL,
  sumber_id   INT REFERENCES naik.sumber_data(sumber_id)
)""",

"""INSERT INTO naik.rute_geometri (rute_id, tahun_data, panjang_m, max_snap_m, geom, sumber_id)
SELECT r.rute_id, EXTRACT(YEAR FROM CURRENT_DATE)::smallint, t.panjang_m, NULL,
       ST_SetSRID(ST_Multi(ST_Force2D(t.geom)), 4326),
       (SELECT sumber_id FROM naik.sumber_data WHERE url_sumber = 'https://www.openstreetmap.org')
FROM public.trayek_snapped t
JOIN naik.rute r ON r.kode_trayek = t.kode_trayek AND r.arah = t.arah""",

"CREATE INDEX idx_rute_geometri_geom ON naik.rute_geometri USING GIST (geom)",

"""CREATE TABLE naik.ruas_jalan (
  ruas_id     SERIAL PRIMARY KEY,
  osm_id      BIGINT,
  nama_jalan  VARCHAR(150),
  kelas_jalan VARCHAR(50),
  panjang_m   NUMERIC(10,1),
  geom        geometry(LineString, 4326) NOT NULL,
  sumber_id   INT REFERENCES naik.sumber_data(sumber_id)
)""",

"""INSERT INTO naik.ruas_jalan (osm_id, nama_jalan, kelas_jalan, panjang_m, geom, sumber_id)
SELECT k.osm_id, k.nama_jalan, k.highway, k.panjang_m,
       ST_SetSRID(ST_Force2D(d.geom), 4326)::geometry(LineString, 4326),
       (SELECT sumber_id FROM naik.sumber_data WHERE url_sumber = 'https://www.openstreetmap.org')
FROM public.kepadatan_trayek k, LATERAL ST_Dump(k.geom) d
WHERE GeometryType(d.geom) = 'LINESTRING'""",

"CREATE INDEX idx_ruas_jalan_geom ON naik.ruas_jalan USING GIST (geom)",

# ---------- urutan ruas per rute ----------
"DROP TABLE IF EXISTS naik._rg",
"DROP TABLE IF EXISTS naik._rj",

"""CREATE TABLE naik._rg AS
SELECT g.rute_id,
       ST_Transform(CASE WHEN GeometryType(ST_LineMerge(g.geom)) = 'LINESTRING'
                         THEN ST_LineMerge(g.geom)
                         ELSE ST_GeometryN(ST_LineMerge(g.geom), 1) END, 32748) AS line,
       ST_Buffer(ST_Transform(g.geom, 32748), 5) AS buf
FROM naik.rute_geometri g""",
"CREATE INDEX idx_rg_buf ON naik._rg USING GIST (buf)",

"""CREATE TABLE naik._rj AS
SELECT ruas_id, ST_Transform(geom, 32748) AS g, ST_Length(ST_Transform(geom, 32748)) AS len
FROM naik.ruas_jalan""",
"CREATE INDEX idx_rj_g ON naik._rj USING GIST (g)",

"""CREATE TABLE naik.rute_ruas_jalan (
  rute_ruas_id SERIAL PRIMARY KEY,
  rute_id      INT NOT NULL REFERENCES naik.rute(rute_id) ON DELETE CASCADE,
  ruas_id      INT NOT NULL REFERENCES naik.ruas_jalan(ruas_id) ON DELETE CASCADE,
  urutan       INT NOT NULL,
  UNIQUE (rute_id, ruas_id)
)""",

"""INSERT INTO naik.rute_ruas_jalan (rute_id, ruas_id, urutan)
SELECT rute_id, ruas_id, ROW_NUMBER() OVER (PARTITION BY rute_id ORDER BY pos, ruas_id)
FROM (
  SELECT a.rute_id, b.ruas_id,
         ST_LineLocatePoint(a.line, ST_LineInterpolatePoint(b.g, 0.5)) AS pos
  FROM naik._rg a
  JOIN naik._rj b ON a.buf && b.g
  WHERE b.len >= 0.5
    AND ST_Length(ST_Intersection(a.buf, b.g)) >= 0.8 * b.len
) s""",

"CREATE INDEX idx_rute_ruas_ruas ON naik.rute_ruas_jalan (ruas_id)",
"DROP TABLE naik._rg",
"DROP TABLE naik._rj",

# ---------- hasil kepadatan ----------
"""CREATE TABLE naik.hasil_kepadatan (
  kepadatan_id      SERIAL PRIMARY KEY,
  ruas_id           INT NOT NULL REFERENCES naik.ruas_jalan(ruas_id) ON DELETE CASCADE,
  jumlah_rute       INT NOT NULL,
  tingkat_kepadatan VARCHAR(30) NOT NULL,
  tahun_analisis    SMALLINT,
  tanggal_analisis  DATE
)""",

"""INSERT INTO naik.hasil_kepadatan (ruas_id, jumlah_rute, tingkat_kepadatan, tahun_analisis, tanggal_analisis)
SELECT rr.ruas_id, COUNT(DISTINCT r.kode_trayek),
       CASE WHEN COUNT(DISTINCT r.kode_trayek) <= 1 THEN 'Rendah'
            WHEN COUNT(DISTINCT r.kode_trayek) <= 3 THEN 'Sedang'
            ELSE 'Tinggi' END,
       EXTRACT(YEAR FROM CURRENT_DATE)::smallint, CURRENT_DATE
FROM naik.rute_ruas_jalan rr
JOIN naik.rute r ON r.rute_id = rr.rute_id
GROUP BY rr.ruas_id""",

"CREATE INDEX idx_hasil_kepadatan_ruas ON naik.hasil_kepadatan (ruas_id)",

# ---------- titik transfer antar trayek ----------
"""CREATE TABLE naik.titik_transfer AS
WITH k AS (
  SELECT r.kode_trayek,
         ST_Buffer(ST_UnaryUnion(ST_Collect(ST_Transform(g.geom, 32748))), 15) AS buf
  FROM naik.rute r JOIN naik.rute_geometri g ON g.rute_id = r.rute_id
  GROUP BY r.kode_trayek
), pair AS (
  SELECT a.kode_trayek AS trayek_a, b.kode_trayek AS trayek_b,
         (ST_Dump(ST_Intersection(a.buf, b.buf))).geom AS zona
  FROM k a JOIN k b ON a.kode_trayek < b.kode_trayek AND a.buf && b.buf AND ST_Intersects(a.buf, b.buf)
)
SELECT ROW_NUMBER() OVER ()::int AS transfer_id, trayek_a, trayek_b,
       ST_Area(zona)::numeric(12,1) AS luas_zona_m2,
       ST_Transform(ST_PointOnSurface(zona), 4326)::geometry(Point, 4326) AS geom
FROM pair
WHERE GeometryType(zona) = 'POLYGON'""",

"ALTER TABLE naik.titik_transfer ADD PRIMARY KEY (transfer_id)",
"CREATE INDEX idx_titik_transfer_geom ON naik.titik_transfer USING GIST (geom)",

# ---------- nama tampil untuk ruas tanpa nama (nama_jalan asli OSM tidak diubah) ----------
"ALTER TABLE naik.ruas_jalan ADD COLUMN nama_tampil TEXT, ADD COLUMN sumber_nama TEXT",
"""UPDATE naik.ruas_jalan SET
   nama_tampil = CASE WHEN nama_jalan IS NULL OR nama_jalan = '(tanpa nama)' THEN NULL ELSE nama_jalan END,
   sumber_nama = CASE WHEN nama_jalan IS NULL OR nama_jalan = '(tanpa nama)' THEN NULL ELSE 'OSM' END""",
"""WITH w AS (
  SELECT osm_id, ST_Union(geom) AS g FROM naik.ruas_jalan WHERE nama_tampil IS NULL GROUP BY osm_id
), cand AS (
  SELECT w.osm_id, j.nama_tampil, SUM(ST_Length(j.geom::geography)) AS len
  FROM w JOIN naik.ruas_jalan j
    ON j.nama_tampil IS NOT NULL AND j.osm_id <> w.osm_id AND ST_DWithin(j.geom, w.g, 0.00002)
  GROUP BY w.osm_id, j.nama_tampil
), best AS (
  SELECT DISTINCT ON (osm_id) osm_id, nama_tampil FROM cand ORDER BY osm_id, len DESC
)
UPDATE naik.ruas_jalan r SET nama_tampil = b.nama_tampil, sumber_nama = 'perkiraan: tersambung ke jalan bernama'
FROM best b WHERE r.osm_id = b.osm_id AND r.nama_tampil IS NULL""",
"""WITH w AS (
  SELECT osm_id, ST_Union(geom) AS g FROM naik.ruas_jalan WHERE nama_tampil IS NULL GROUP BY osm_id
), cand AS (
  SELECT w.osm_id, j.nama_tampil, SUM(ST_Length(j.geom::geography)) AS len
  FROM w JOIN naik.ruas_jalan j
    ON j.nama_tampil IS NOT NULL AND j.osm_id <> w.osm_id AND ST_DWithin(j.geom, w.g, 0.00002)
  GROUP BY w.osm_id, j.nama_tampil
), best AS (
  SELECT DISTINCT ON (osm_id) osm_id, nama_tampil FROM cand ORDER BY osm_id, len DESC
)
UPDATE naik.ruas_jalan r SET nama_tampil = b.nama_tampil, sumber_nama = 'perkiraan: tersambung ke jalan bernama'
FROM best b WHERE r.osm_id = b.osm_id AND r.nama_tampil IS NULL""",
"""WITH w AS (
  SELECT osm_id, ST_Union(geom) AS g FROM naik.ruas_jalan WHERE nama_tampil IS NULL GROUP BY osm_id
), cand AS (
  SELECT w.osm_id, j.nama_tampil, SUM(ST_Length(j.geom::geography)) AS len
  FROM w JOIN naik.ruas_jalan j
    ON j.nama_tampil IS NOT NULL AND j.osm_id <> w.osm_id AND ST_DWithin(j.geom, w.g, 0.00002)
  GROUP BY w.osm_id, j.nama_tampil
), best AS (
  SELECT DISTINCT ON (osm_id) osm_id, nama_tampil FROM cand ORDER BY osm_id, len DESC
)
UPDATE naik.ruas_jalan r SET nama_tampil = b.nama_tampil, sumber_nama = 'perkiraan: tersambung ke jalan bernama'
FROM best b WHERE r.osm_id = b.osm_id AND r.nama_tampil IS NULL""",
"""UPDATE naik.ruas_jalan r SET
   nama_tampil = 'Sekitar ' || (
     SELECT j.nama_tampil FROM naik.ruas_jalan j
     WHERE j.sumber_nama = 'OSM' AND ST_DWithin(j.geom::geography, r.geom::geography, 50)
     ORDER BY j.geom::geography <-> r.geom::geography LIMIT 1),
   sumber_nama = 'perkiraan: jalan bernama terdekat (<50 m)'
WHERE r.nama_tampil IS NULL
  AND EXISTS (SELECT 1 FROM naik.ruas_jalan j
              WHERE j.sumber_nama = 'OSM' AND ST_DWithin(j.geom::geography, r.geom::geography, 50))""",
"""UPDATE naik.ruas_jalan SET
   nama_tampil = CASE
     WHEN kelas_jalan LIKE '%_link' THEN 'Jalan penghubung simpang'
     WHEN kelas_jalan = 'service' THEN 'Jalan akses'
     WHEN kelas_jalan IN ('residential', 'living_street') THEN 'Jalan lingkungan'
     ELSE 'Jalan lokal' END,
   sumber_nama = 'perkiraan: jenis jalan OSM'
WHERE nama_tampil IS NULL""",

# ---------- rapikan nama trayek & label arah (buat tampilan) ----------
"""UPDATE naik.rute SET
   arah = 'ke ' || tujuan
WHERE arah IN ('Berangkat', 'Pulang')""",
"""UPDATE naik.rute SET
   asal   = replace(regexp_replace(asal,   '^Jl\\. ', ''), 'Warung Jambu Timur', 'Warung Jambu'),
   tujuan = replace(regexp_replace(tujuan, '^Jl\\. ', ''), 'Warung Jambu Timur', 'Warung Jambu')""",
"""UPDATE naik.rute SET arah = 'ke ' || tujuan WHERE arah LIKE 'ke %'""",
"""UPDATE naik.rute SET
   arah   = replace(arah, 'PONDOK', 'Pondok'),
   asal   = replace(asal, 'PONDOK', 'Pondok'),
   tujuan = replace(tujuan, 'PONDOK', 'Pondok')""",
"""UPDATE naik.rute r SET nama_trayek = x.nama
FROM (
  SELECT kode_trayek,
         CASE WHEN COUNT(*) >= 2
              THEN substr(MIN(arah) FILTER (WHERE arah LIKE 'ke %'), 4) || ' – ' || substr(MAX(arah) FILTER (WHERE arah LIKE 'ke %'), 4)
              ELSE MIN(asal) || ' – ' || MIN(tujuan) END AS nama
  FROM naik.rute
  WHERE sumber_id = (SELECT sumber_id FROM naik.sumber_data WHERE url_sumber = 'https://moovitapp.com')
  GROUP BY kode_trayek
) x
WHERE r.kode_trayek = x.kode_trayek""",

# ---------- view buat backend / peta ----------
"""CREATE OR REPLACE VIEW naik.v_rute_peta AS
SELECT r.rute_id, r.kode_trayek, r.arah, r.nama_trayek, r.asal, r.tujuan, r.lintasan,
       '#' || substr(md5(r.kode_trayek), 1, 6) AS warna,
       g.panjang_m, r.kualitas_geometri, g.geom
FROM naik.rute r JOIN naik.rute_geometri g ON g.rute_id = r.rute_id""",

"DROP VIEW IF EXISTS naik.v_ruas_kepadatan",
"""CREATE VIEW naik.v_ruas_kepadatan AS
SELECT j.ruas_id, j.nama_tampil AS nama_jalan, j.nama_jalan AS nama_osm, j.sumber_nama, j.kelas_jalan, j.panjang_m,
       h.jumlah_rute, h.tingkat_kepadatan,
       (SELECT string_agg(DISTINCT r.kode_trayek, ', ' ORDER BY r.kode_trayek)
          FROM naik.rute_ruas_jalan rr JOIN naik.rute r ON r.rute_id = rr.rute_id
         WHERE rr.ruas_id = j.ruas_id) AS trayek,
       j.geom
FROM naik.ruas_jalan j JOIN naik.hasil_kepadatan h ON h.ruas_id = j.ruas_id""",
]

CHECKS = [
    ("rute (kode+arah)",      "SELECT COUNT(*) FROM naik.rute"),
    ("rute_geometri",         "SELECT COUNT(*) FROM naik.rute_geometri"),
    ("ruas_jalan",            "SELECT COUNT(*) FROM naik.ruas_jalan"),
    ("rute_ruas_jalan",       "SELECT COUNT(*) FROM naik.rute_ruas_jalan"),
    ("rute tanpa ruas",       "SELECT COUNT(*) FROM naik.rute r WHERE NOT EXISTS (SELECT 1 FROM naik.rute_ruas_jalan x WHERE x.rute_id = r.rute_id)"),
    ("titik_transfer",        "SELECT COUNT(*) FROM naik.titik_transfer"),
    ("pasangan trayek transfer", "SELECT COUNT(*) FROM (SELECT DISTINCT trayek_a, trayek_b FROM naik.titik_transfer) x"),
]

md = QgsProviderRegistry.instance().providerMetadata("postgres")
conn = md.connections()[CONN_NAME]

for i, sql in enumerate(STATEMENTS, 1):
    head = " ".join(sql.split())[:90]
    print(f"[{i}/{len(STATEMENTS)}] {head}")
    try:
        conn.executeSql(sql)
    except Exception as ex:
        raise Exception(f"Gagal di statement {i}: {head}\n{ex}")

print("\n=== VERIFIKASI ===")
for label, sql in CHECKS:
    print(f"{label:28s}: {conn.executeSql(sql)[0][0]}")

print("\nKepadatan (dihitung ulang dari rute_ruas_jalan):")
for row in conn.executeSql(
    "SELECT tingkat_kepadatan, COUNT(*), ROUND(SUM(j.panjang_m)/1000.0, 2) "
    "FROM naik.hasil_kepadatan h JOIN naik.ruas_jalan j USING (ruas_id) GROUP BY 1 ORDER BY 3 DESC"):
    print(f"  {row[0]:7s} | {row[1]} ruas | {row[2]} km")

print("\nContoh urutan ruas (Trayek 08, arah pertama, 8 ruas):")
for row in conn.executeSql(
    "SELECT rr.urutan, j.nama_jalan FROM naik.rute_ruas_jalan rr "
    "JOIN naik.rute r USING (rute_id) JOIN naik.ruas_jalan j USING (ruas_id) "
    "WHERE r.rute_id = (SELECT MIN(rute_id) FROM naik.rute WHERE kode_trayek = 'Trayek 08') ORDER BY rr.urutan LIMIT 8"):
    print(f"  {row[0]:>3} {row[1]}")

print("\nSelesai. Refresh di Browser > PostgreSQL > NAIK ANGKOT > schema naik.")
print("Catatan: isi naik.tarif_rute secara manual (kode_trayek, tarif, tahun_data, sumber_id).")

print("\nNama ruas jalan:")
for row in conn.executeSql("SELECT sumber_nama, COUNT(*) FROM naik.ruas_jalan GROUP BY 1 ORDER BY 2 DESC"):
    print(f"  {row[1]:>5} ruas | {row[0]}")

print("\nRute per sumber:")
for row in conn.executeSql("SELECT s.nama_sumber, COUNT(r.rute_id) FROM naik.sumber_data s "
                           "LEFT JOIN naik.rute r USING (sumber_id) GROUP BY 1 ORDER BY 2 DESC"):
    print(f"  {row[1]:>3} rute | {row[0]}")
