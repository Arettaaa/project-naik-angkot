#!/usr/bin/env python3
"""Data ringan untuk peta pratinjau di landing page (bagian "Fitur Utama").

Sumber: data/final (rencana SK, sama dengan yang dipakai dashboard).
Hasil: frontend/src/data/pratinjauPeta.json (garis disederhanakan, ±150 KB).
Jalankan ulang kalau data/final berubah:  python data/buat_pratinjau_landing.py
Butuh: pip install shapely
"""
import collections, json, os
from shapely.geometry import LineString, MultiLineString, shape
from shapely.geometry import Point
from shapely.ops import linemerge, substring, unary_union

SINI = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.join(SINI, "final")
KELUAR = os.path.join(SINI, "..", "frontend", "src", "data", "pratinjauPeta.json")

# contoh hasil "Cari Rute" (diambil dari API /rekomendasi): Stasiun Bogor -> Botani Square, angkot 08
CONTOH_CARI = dict(
    asal=dict(nama="Stasiun Bogor", lat=-6.5953, lng=106.7899),
    tujuan=dict(nama="Botani Square", lat=-6.6008, lng=106.8066),
    kode="08", arah="ke Taman Pajajaran", menit=22, jalan_m=183, angkot_m=3643, tarif=5000,
)


def r(cs):
    return [[round(x, 5), round(y, 5)] for x, y in cs]


def garis(g, tol):
    g = g.simplify(tol, preserve_topology=False)
    parts = list(g.geoms) if isinstance(g, MultiLineString) else [g]
    return [r(p.coords) for p in parts if len(p.coords) > 1]


tr = json.load(open(os.path.join(FINAL, "trayek_angkot_FINAL.geojson"), encoding="utf-8"))
rute, sudah = [], set()
for f in tr["features"]:
    p = f["properties"]
    kode = p["kode_trayek"].replace("Trayek ", "")
    if kode in sudah:
        continue  # satu arah per trayek cukup untuk pratinjau
    sudah.add(kode)
    rute.append(dict(kode=kode, asal=p["nama_trayek"].split(" – ")[0], tujuan=p["nama_trayek"].split(" – ")[-1],
                     panjang_m=round(float(p["panjang_m"])), garis=garis(shape(f["geometry"]), 0.00012)))

kep = json.load(open(os.path.join(FINAL, "kepadatan_trayek_FINAL.geojson"), encoding="utf-8"))
per_kelas = collections.defaultdict(list)
km = collections.Counter()
jalan = collections.defaultdict(lambda: [0, 0.0])
for f in kep["features"]:
    p = f["properties"]
    k = p["kepadatan"]
    per_kelas[k].append(shape(f["geometry"]))
    km[k] += float(p["panjang_m"]) / 1000
    n = p.get("nama_jalan") or ""
    if n and not n.startswith("(") and int(p["jumlah_trayek"]) >= 4:
        jalan[n][0] = max(jalan[n][0], int(p["jumlah_trayek"]))
        jalan[n][1] += float(p["panjang_m"])
kepadatan = {}
for k, gs in per_kelas.items():
    g = linemerge(unary_union(gs))
    kepadatan[k] = garis(g, 0.0001)
teratas = sorted(jalan.items(), key=lambda x: (-x[1][0], -x[1][1]))[:5]

# potongan jalur angkot untuk contoh cari: proyeksikan asal & tujuan ke garis trayek
c = CONTOH_CARI
for f in tr["features"]:
    p = f["properties"]
    if p["kode_trayek"] != f"Trayek {c['kode']}":
        continue
    g = shape(f["geometry"])
    g = linemerge(g) if isinstance(g, MultiLineString) else g
    g = g if isinstance(g, LineString) else max(g.geoms, key=lambda x: x.length)
    a, b = g.project(Point(c["asal"]["lng"], c["asal"]["lat"])), g.project(Point(c["tujuan"]["lng"], c["tujuan"]["lat"]))
    if a < b and abs((b - a) * 111000 - c["angkot_m"]) < 1500:
        c["garis"] = r(substring(g, a, b).simplify(0.00005).coords)
        break

out = dict(
    rute=sorted(rute, key=lambda x: x["kode"]),
    kepadatan=kepadatan,
    km={k: round(v, 1) for k, v in km.items()},
    jalan_padat=[dict(nama=n, rute=v[0]) for n, v in teratas],
    contoh_cari=CONTOH_CARI,
)
json.dump(out, open(KELUAR, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(KELUAR, os.path.getsize(KELUAR) // 1024, "KB", {k: len(v) for k, v in kepadatan.items()}, out["km"], out["jalan_padat"])
