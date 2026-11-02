# ===== MUAT DATA FINAL NAIK v3 (artikel, 30 trayek x 2 arah) ke QGIS + PostGIS =====
# Taruh 3 file ini di FOLDER:
#   trayek_angkot_FINAL.geojson, kepadatan_trayek_FINAL.geojson, laporan_FINAL.csv
# Cara pakai: Python Console > Show Editor > Open Script > Run

import os
from qgis.core import *
from qgis.utils import iface
import processing

# ---------- CONFIG ----------
FOLDER     = r"D:\Kuliah\Semester 5\GIS\data_final"
KE_POSTGIS = True           # False kalau cuma mau lihat di QGIS
CONN_NAME  = "NAIK ANGKOT"
SCHEMA     = "public"

TRAYEK    = os.path.join(FOLDER, "trayek_angkot_FINAL.geojson")
KEPADATAN = os.path.join(FOLDER, "kepadatan_trayek_FINAL.geojson")
for p in (TRAYEK, KEPADATAN):
    if not os.path.exists(p):
        raise Exception("File tidak ketemu: " + p)

# ---------- bersihkan layer lama ----------
for nm in ("trayek_FINAL", "kepadatan_FINAL", "trayek_snapped", "kepadatan_trayek",
           "trayek_SEMUA_status", "osm_jalan", "tempat_geocode"):
    for l in QgsProject.instance().mapLayersByName(nm):
        QgsProject.instance().removeMapLayer(l.id())

# ---------- layer kepadatan (hijau/kuning/merah) ----------
kep = QgsVectorLayer(KEPADATAN, "kepadatan_FINAL", "ogr")
cats = []
for val, col, w in [("rendah", "#2ecc71", 0.6), ("sedang", "#f1c40f", 1.0), ("tinggi", "#e74c3c", 1.6)]:
    s = QgsLineSymbol.createSimple({"line_color": col, "line_width": str(w), "capstyle": "round"})
    cats.append(QgsRendererCategory(val, s, val))
kep.setRenderer(QgsCategorizedSymbolRenderer("kepadatan", cats))

# ---------- layer trayek (1 warna per trayek, label kode) ----------
tr = QgsVectorLayer(TRAYEK, "trayek_FINAL", "ogr")
import random
random.seed(7)
kodes = sorted(tr.uniqueValues(tr.fields().indexFromName("kode_trayek")))
cats = []
for k in kodes:
    s = QgsLineSymbol.createSimple({"line_color": "#%06x" % random.randint(0x202020, 0xd0d0d0),
                                    "line_width": "0.9", "capstyle": "round"})
    cats.append(QgsRendererCategory(k, s, str(k)))
tr.setRenderer(QgsCategorizedSymbolRenderer("kode_trayek", cats))
lb = QgsPalLayerSettings()
lb.fieldName = "\"kode_trayek\" || ' ' || \"arah\""
lb.isExpression = True
lb.placement = QgsPalLayerSettings.Line
fmt = QgsTextFormat(); fmt.setSize(8); lb.setFormat(fmt)
tr.setLabeling(QgsVectorLayerSimpleLabeling(lb))
tr.setLabelsEnabled(False)   # nyalakan manual kalau perlu

QgsProject.instance().addMapLayer(kep)
QgsProject.instance().addMapLayer(tr)
QgsProject.instance().layerTreeRoot().findLayer(tr.id()).setItemVisibilityChecked(False)
iface.setActiveLayer(kep)
iface.zoomToActiveLayer()

# ---------- ringkasan ----------
from collections import Counter
v = Counter(f["validasi"] for f in tr.getFeatures())
print(f"Trayek: {tr.featureCount()} rute, {len(kodes)} kode | validasi: {dict(v)}")
km = Counter()
for f in kep.getFeatures():
    km[f["kepadatan"]] += f["panjang_m"]
print("Kepadatan:", {k: f"{km[k]/1000:.1f} km" for k in ("rendah", "sedang", "tinggi")})

# ---------- cek: harus data v3 ----------
n_artikel = sum(1 for f in tr.getFeatures() if "artikel" in str(f["sumber"]))
print(f"Rute dari artikel: {n_artikel} (harus 60)")
if dict(v) != {"OK": 60} or n_artikel != 60:
    raise Exception("Ini BUKAN data v3! Extract ulang NAIK_FINAL_v3.zip ke " + FOLDER)

# ---------- opsional: PostGIS ----------
if KE_POSTGIS:
    alg = ("native:importintopostgis"
           if QgsApplication.processingRegistry().algorithmById("native:importintopostgis")
           else "qgis:importintopostgis")
    for lyr, tbl in ((tr, "trayek_snapped"), (kep, "kepadatan_trayek")):
        processing.run(alg, {"INPUT": lyr, "DATABASE": CONN_NAME, "SCHEMA": SCHEMA, "TABLENAME": tbl,
                             "PRIMARY_KEY": "gid", "GEOMETRY_COLUMN": "geom", "ENCODING": "UTF-8",
                             "OVERWRITE": True, "CREATEINDEX": True, "LOWERCASE_NAMES": True,
                             "DROP_STRING_LENGTH": False, "FORCE_SINGLEPART": False})
        print(f"Masuk PostGIS: {SCHEMA}.{tbl}")
    print("Lanjut: Run buat_skema_rute_v4.py biar schema 'naik' ikut ke-update.")
print("Selesai.")
