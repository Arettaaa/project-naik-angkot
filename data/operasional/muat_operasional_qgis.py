# ===== MUAT DATA OPERASIONAL NAIK (24 trayek yang benar-benar jalan) ke QGIS + PostGIS =====
# Data lama (data/final, rencana SK 30 trayek) TIDAK diubah dan TIDAK ditimpa:
#   - layer QGIS lama (trayek_FINAL, kepadatan_FINAL) dibiarkan
#   - tabel PostGIS lama (trayek_snapped, kepadatan_trayek, schema naik) tidak disentuh
# Data operasional masuk ke group & tabel sendiri: trayek_operasional, kepadatan_operasional, padanan_nomor_trayek
#
# File yang dibutuhkan di FOLDER (semua ada di data/operasional):
#   trayek_operasional.geojson, kepadatan_operasional.geojson, padanan_nomor_trayek.csv
# Cara pakai: QGIS > Plugins > Python Console > Show Editor > Open Script > (atur FOLDER) > Run

import os
from collections import Counter
from qgis.core import (QgsApplication, QgsCategorizedSymbolRenderer, QgsLineSymbol, QgsPalLayerSettings,
                       QgsProject, QgsRendererCategory, QgsTextFormat, QgsVectorLayer,
                       QgsVectorLayerSimpleLabeling)
from qgis.utils import iface
import processing

# ---------- CONFIG ----------
FOLDER     = r"D:\Kuliah\Semester 5\GIS\project-naik-angkot\data\operasional"
KE_POSTGIS = True            # False kalau cuma mau lihat di QGIS
CONN_NAME  = "NAIK ANGKOT"   # nama koneksi PostGIS di QGIS Browser
SCHEMA     = "public"
GROUP      = "NAIK – Operasional (jurnal 2021 + GPS)"

# kalau script dijalankan dari folder data/operasional, FOLDER otomatis ikut lokasi script
try:
    _sini = os.path.dirname(os.path.abspath(__file__))
    if os.path.exists(os.path.join(_sini, "trayek_operasional.geojson")):
        FOLDER = _sini
except NameError:
    pass

TRAYEK    = os.path.join(FOLDER, "trayek_operasional.geojson")
KEPADATAN = os.path.join(FOLDER, "kepadatan_operasional.geojson")
PADANAN   = os.path.join(FOLDER, "padanan_nomor_trayek.csv")
for p in (TRAYEK, KEPADATAN, PADANAN):
    if not os.path.exists(p):
        raise Exception("File tidak ketemu: " + p + "\nAtur FOLDER ke folder data/operasional.")

# tabel lama yang TIDAK BOLEH ditimpa
TABEL_LAMA = {"trayek_snapped", "kepadatan_trayek", "trayek_semua_status", "osm_jalan"}
TABEL = {"trayek": "trayek_operasional", "kepadatan": "kepadatan_operasional", "padanan": "padanan_nomor_trayek"}
assert not (set(TABEL.values()) & TABEL_LAMA)

# warna sama dengan aplikasi (frontend/src/dashboard/warna.js)
KEPADATAN_WARNA = [("rendah", "#4FAE84", 0.6, "Rendah (1 trayek)"),
                   ("sedang", "#E3A03A", 1.0, "Sedang (2–3 trayek)"),
                   ("tinggi", "#C8432E", 1.6, "Tinggi (≥4 trayek)")]
PALET = ['#008D5C', '#B2580B', '#3475C4', '#A84F8E', '#428731', '#0088A4', '#B84C55', '#7C60BD', '#A56300', '#007FBA',
         '#008D87', '#B24C74', '#5E6AC5', '#B75037', '#9656A9', '#00A771', '#DF7A32', '#4F97EF', '#D470B5', '#58A547',
         '#00A2C1', '#E66D75', '#A083EA', '#CD8300', '#009EE0', '#00A49D', '#DF6C98', '#7B8BF0', '#E57255', '#BE78D4']

proj = QgsProject.instance()

# ---------- bersihkan HANYA layer operasional lama (kalau script dijalankan ulang) ----------
for nm in ("trayek_operasional", "kepadatan_operasional", "padanan_nomor_trayek"):
    for l in proj.mapLayersByName(nm):
        proj.removeMapLayer(l.id())
root = proj.layerTreeRoot()
grp = root.findGroup(GROUP) or root.insertGroup(0, GROUP)

# ---------- kepadatan (hijau/kuning/merah) ----------
kep = QgsVectorLayer(KEPADATAN, "kepadatan_operasional", "ogr")
if not kep.isValid():
    raise Exception("Gagal membuka " + KEPADATAN)
cats = []
for val, col, w, label in KEPADATAN_WARNA:
    s = QgsLineSymbol.createSimple({"line_color": col, "line_width": str(w), "capstyle": "round", "joinstyle": "round"})
    cats.append(QgsRendererCategory(val, s, label))
kep.setRenderer(QgsCategorizedSymbolRenderer("kepadatan", cats))

# ---------- trayek (1 warna per kode; trayek AK nomor lama = garis putus-putus) ----------
tr = QgsVectorLayer(TRAYEK, "trayek_operasional", "ogr")
if not tr.isValid():
    raise Exception("Gagal membuka " + TRAYEK)
jenis_kode = {f["kode"]: f["jenis"] for f in tr.getFeatures()}
nama_kode = {f["kode"]: f["nama_trayek"] for f in tr.getFeatures()}
cats = []
for i, k in enumerate(sorted(jenis_kode)):
    sifat = {"line_color": PALET[i % len(PALET)], "line_width": "0.9", "capstyle": "round", "joinstyle": "round"}
    if jenis_kode[k] == "AK":
        sifat.update(line_style="dash", line_width="1.1")
    cats.append(QgsRendererCategory(k, QgsLineSymbol.createSimple(sifat), f"{k} · {nama_kode[k]}"))
tr.setRenderer(QgsCategorizedSymbolRenderer("kode", cats))
lb = QgsPalLayerSettings()
lb.fieldName = "\"kode\" || ' ' || \"arah\""
lb.isExpression = True
lb.placement = QgsPalLayerSettings.Line
fmt = QgsTextFormat()
fmt.setSize(8)
lb.setFormat(fmt)
tr.setLabeling(QgsVectorLayerSimpleLabeling(lb))
tr.setLabelsEnabled(False)  # nyalakan manual kalau perlu

# ---------- tabel padanan nomor (tanpa geometri) ----------
pad = QgsVectorLayer(PADANAN, "padanan_nomor_trayek", "ogr")
if not pad.isValid():
    raise Exception("Gagal membuka " + PADANAN)

for lyr in (kep, tr, pad):
    proj.addMapLayer(lyr, False)
    grp.addLayer(lyr)
root.findLayer(tr.id()).setItemVisibilityChecked(False)
iface.setActiveLayer(kep)
iface.zoomToActiveLayer()

# ---------- ringkasan + cek ----------
kodes = set(jenis_kode)
jenis = Counter(jenis_kode.values())
km = Counter()
for f in kep.getFeatures():
    km[f["kepadatan"]] += float(f["panjang_m"])
print(f"Trayek operasional: {tr.featureCount()} rute, {len(kodes)} kode (AP {jenis['AP']}, AK {jenis['AK']})")
print("Kepadatan operasional:", {k: f"{km[k]/1000:.1f} km" for k in ("rendah", "sedang", "tinggi")})
print(f"Padanan nomor: {pad.featureCount()} baris")
if tr.featureCount() != 48 or len(kodes) != 24 or jenis["AK"] != 5:
    raise Exception("Data operasional tidak lengkap (harus 48 rute / 24 trayek / 5 AK). Jalankan ulang bangun_operasional.py.")
if any(f["jaringan"] != "operasional" for f in kep.getFeatures()):
    raise Exception("kepadatan_operasional.geojson bukan hasil bangun_operasional.py")

# ---------- opsional: PostGIS (tabel BARU, data lama aman) ----------
if KE_POSTGIS:
    alg = ("native:importintopostgis"
           if QgsApplication.processingRegistry().algorithmById("native:importintopostgis")
           else "qgis:importintopostgis")
    for lyr, tbl in ((tr, TABEL["trayek"]), (kep, TABEL["kepadatan"]), (pad, TABEL["padanan"])):
        processing.run(alg, {"INPUT": lyr, "DATABASE": CONN_NAME, "SCHEMA": SCHEMA, "TABLENAME": tbl,
                             "PRIMARY_KEY": "gid", "GEOMETRY_COLUMN": "geom", "ENCODING": "UTF-8",
                             "OVERWRITE": True, "CREATEINDEX": True, "LOWERCASE_NAMES": True,
                             "DROP_STRING_LENGTH": False, "FORCE_SINGLEPART": False})
        print(f"Masuk PostGIS: {SCHEMA}.{tbl}")
    print("Tabel lama (trayek_snapped, kepadatan_trayek, schema naik) tidak diubah.")
print("Selesai.")
