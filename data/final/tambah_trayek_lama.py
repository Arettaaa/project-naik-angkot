#!/usr/bin/env python3
"""TAMBAH TRAYEK LAMA (di luar SK 2017) YANG MASIH BEROPERASI KE DATA FINAL

Trayek bernomor lama ini belum dialihkan ke nomor SK dan masih jalan di lapangan
(tercantum di Moovit Nov 2026 & disebut warga/mahasiswa SV IPB). Geometrinya diambil dari
../operasional/trayek_operasional.geojson (titik GPS naik angkot langsung, bogor-angkot-gtfs 2016-2019).

Kode di data final: "Trayek 02AK", "Trayek 03AK", ... (tampil di aplikasi sebagai "02 lama").
30 trayek SK tidak diubah. Script aman dijalankan ulang (semua trayek AK dihapus dulu, lalu ditambah lagi).

07 AK (Ciparigi – Jl. Ir. H. Juanda) TIDAK dimasukkan: di Moovit tidak ada padanan yang jelas
(cuma "07A" yang koridornya mirip) dan tidak disebut warga/teman SV. Datanya tetap ada di folder operasional.

    cd data/final
    python tambah_trayek_lama.py
    python sambung_garis_lurus.py      # sambungkan potongan garis lurus 02/03/21 lama ke jalan OSM
Setelah itu jalankan muat_final_qgis.py lalu buat_skema_rute_v4.py di QGIS
(tarif trayek lama otomatis ikut tarif umum).
"""
import collections
import json
import math
import os

SINI = os.path.dirname(os.path.abspath(__file__))
TR = os.path.join(SINI, "trayek_angkot_FINAL.geojson")
KP = os.path.join(SINI, "kepadatan_trayek_FINAL.geojson")
OPS = os.path.join(SINI, "..", "operasional", "trayek_operasional.geojson")

LAMA = {  # kode operasional -> (kode final, nama, kode Moovit, catatan)
    "02 AK": ("Trayek 02AK", "Sukasari – Terminal Bubulak", "2_AK", "lewat Jl. Gunung Batu"),
    "03 AK": ("Trayek 03AK", "Baranangsiang – Terminal Bubulak", "3_AK", "lewat Jl. Gunung Batu"),
    "09 AK": ("Trayek 09AK", "Ciparigi – Sukasari (Ekalokasari)", "9_AK", "lewat Jl. Lodaya - Jl. Kumbang (SV IPB)"),
    "21 AK": ("Trayek 21AK", "Baranangsiang – Ciawi", "21AK", "lewat Jl. Raya Tajur sampai Ciawi"),
}
SUMBER = ("trayek lama di luar SK yang masih beroperasi (Moovit Nov 2026, keterangan warga/mahasiswa SV IPB); "
          "geometri titik GPS bogor-angkot-gtfs 2016-2019")


def kunci(c):
    return (round(c[0], 7), round(c[1], 7))


def jarak(a, b):
    r = math.pi / 180
    h = math.sin((b[1] - a[1]) * r / 2) ** 2 + math.cos(a[1] * r) * math.cos(b[1] * r) * math.sin((b[0] - a[0]) * r / 2) ** 2
    return 12742000 * math.asin(math.sqrt(h))


def main():
    tr = json.load(open(TR, encoding="utf-8"))
    kp = json.load(open(KP, encoding="utf-8"))
    ops = json.load(open(OPS, encoding="utf-8"))
    def lama(k):  # semua kode trayek lama (termasuk yang sudah tidak dipakai, mis. 07AK)
        return str(k).strip().upper().endswith("AK")

    tr["features"] = [f for f in tr["features"] if not lama(f["properties"]["kode_trayek"])]

    # simpul ruas (rute GPS menempel ke simpul ruas dengan selisih presisi beberapa cm)
    grid = collections.defaultdict(list)
    simpul = set()
    for f in kp["features"]:
        for c in f["geometry"]["coordinates"]:
            k = kunci(c)
            if k not in simpul:
                simpul.add(k)
                grid[(int(k[0] * 2000), int(k[1] * 2000))].append(k)

    def tempel(c):
        k = kunci(c)
        if k in simpul:
            return k
        best, bd = None, 1.5
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for n in grid.get((int(k[0] * 2000) + dx, int(k[1] * 2000) + dy), ()):
                    d = jarak(n, k)
                    if d < bd:
                        best, bd = n, d
        return best

    sisi = collections.defaultdict(set)  # kode final -> sisi ruas yang dilewati
    for f in ops["features"]:
        p = f["properties"]
        if p.get("kode") not in LAMA:
            continue
        kode, nama, moovit, catatan = LAMA[p["kode"]]
        tr["features"].append(dict(type="Feature", geometry=f["geometry"], properties=dict(
            kode_trayek=kode, kode_moovit=moovit, nama_trayek=nama, arah=p["arah"], lintasan=p["lintasan"], sumber=SUMBER,
            n_halte=int(p["n_halte"]), halte_tak_terpetakan=int(p["halte_tak_terpetakan"]), panjang_m=float(p["panjang_m"]),
            status=p["status"], validasi="OK", catatan=f"tambahan di luar SK (nomor lama); {catatan}")))
        cs = [tempel(c) for c in f["geometry"]["coordinates"]]
        for a, b in zip(cs, cs[1:]):
            if a and b and a != b:
                sisi[kode].add(frozenset((a, b)))

    for f in kp["features"]:
        cs = [kunci(c) for c in f["geometry"]["coordinates"]]
        s = {frozenset(e) for e in zip(cs, cs[1:])}
        daftar = [t.strip() for t in f["properties"]["trayek"].split(",") if t.strip() and not lama(t)]
        daftar += [k for k, ss in sisi.items() if s & ss]
        daftar = sorted(set(daftar))
        n = len(daftar)
        f["properties"].update(trayek=", ".join(daftar), jumlah_trayek=n,
                               kepadatan="rendah" if n == 1 else "sedang" if n <= 3 else "tinggi")
    kp["features"] = [f for f in kp["features"] if f["properties"]["jumlah_trayek"] > 0]

    json.dump(tr, open(TR, "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(kp, open(KP, "w", encoding="utf-8"), ensure_ascii=False)
    km = collections.Counter()
    for f in kp["features"]:
        km[f["properties"]["kepadatan"]] += f["properties"]["panjang_m"] / 1000
    print(f"trayek: {len(tr['features'])} rute ({len(tr['features']) // 2} trayek, termasuk {len(sisi)} trayek lama)")
    print("kepadatan:", {k: f"{v:.1f} km" for k, v in sorted(km.items())})


if __name__ == "__main__":
    main()
