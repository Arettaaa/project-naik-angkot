#!/usr/bin/env python3
"""PERBAIKAN RUTE SESUAI SK (master plan Pemkot / Perumda Pasar Pakuan Jaya, 14 Maret 2017)

Beberapa ruas jalan yang disebut di SK belum dilewati geometri data final karena ruasnya
belum ada di jaringan jalan saat rute dibangun. Script ini:
  1. mengunduh ruas yang hilang langsung dari OpenStreetMap (api.openstreetmap.org, tanpa API key),
  2. merutekan ulang potongan rute di sekitarnya lewat ruas tersebut sesuai urutan SK
     (arah jalan satu arah tetap dihormati),
  3. memperbarui trayek_angkot_FINAL.geojson, kepadatan_trayek_FINAL.geojson, dan laporan_FINAL.csv,
  4. menyimpan cek_perbaikan_sk.geojson (potongan lama vs baru) untuk dicek di QGIS.

Perbaikan yang terdaftar:
  * Trayek 30 Berangkat: "... Jl. Raya Pajajaran – Jl. Kumbang – Jl. Lodaya – Jl. Raya Pajajaran ..."
    (lewat sisi SV IPB / Jl. Kumbang). Di data lama rute ini lurus di Jl. Raya Pajajaran.

Cara pakai (butuh internet, tanpa library tambahan; matplotlib opsional untuk gambar cek):
    cd data/final
    python perbaiki_rute_sk.py              # unduh dari OSM lalu perbaiki
    python perbaiki_rute_sk.py --cek        # hanya hitung & simpan cek, file data tidak diubah
    python perbaiki_rute_sk.py --osm way.json   # pakai hasil unduhan OSM yang sudah ada (JSON API 0.6 "full")
Setelah itu jalankan lagi muat_final_qgis.py lalu buat_skema_rute_v4.py di QGIS.
Versi data sebelum perbaikan tetap ada di riwayat git.
"""
import argparse
import csv
import heapq
import json
import math
import os
import sys
import urllib.request

SINI = os.path.dirname(os.path.abspath(__file__))
TRAYEK = os.path.join(SINI, "trayek_angkot_FINAL.geojson")
KEPADATAN = os.path.join(SINI, "kepadatan_trayek_FINAL.geojson")
LAPORAN = os.path.join(SINI, "laporan_FINAL.csv")
OSM_CSV = os.path.join(SINI, "..", "osm_jalan.csv")
CEK = os.path.join(SINI, "cek_perbaikan_sk.geojson")

PERBAIKAN = [
    dict(
        kode="Trayek 30",
        arah="Berangkat",
        # Lodaya (dari Pajajaran) -> Kumbang ke selatan lewat depan SV -> lanjutan Kumbang -> kembali ke Pajajaran
        lewat=[749992656, 256129600, 902617408],
        bbox=(106.8030, -6.5945, 106.8085, -6.5870),  # semua jalan di sekitar SV diunduh dari OSM
        jalan_sk="Jl. Kumbang",
        jendela_m=450,  # potongan rute di sekitar ruas yang dirutekan ulang (sebelum & sesudah)
        catatan="Jl. Kumbang ditambahkan sesuai SK (ruas OSM 902617408) - lewat sisi SV IPB",
    ),
]
LOKAL = {"tertiary", "secondary", "residential", "unclassified", "living_street", "service", "tertiary_link"}


def jarak(a, b):
    """meter antara (lon, lat)"""
    r = math.pi / 180
    dl = (b[1] - a[1]) * r
    dg = (b[0] - a[0]) * r
    h = math.sin(dl / 2) ** 2 + math.cos(a[1] * r) * math.cos(b[1] * r) * math.sin(dg / 2) ** 2
    return 12742000 * math.asin(math.sqrt(h))


def kunci(c):
    return (round(c[0], 7), round(c[1], 7))


def panjang(cs):
    return sum(jarak(a, b) for a, b in zip(cs, cs[1:]))


# ---------------- jaringan jalan ----------------
class Jaringan:
    def __init__(self, kep, oneway):
        self.kep = kep
        self.oneway = oneway
        self.keluar = {}  # node -> {node: (panjang, osm_id)}
        self.grid = {}  # sel ±55 m -> node
        self.info = {}  # osm_id -> (nama, highway)
        for f in kep["features"]:
            p = f["properties"]
            cs = [kunci(c) for c in f["geometry"]["coordinates"]]
            self.info[p["osm_id"]] = (p["nama_jalan"], p["highway"])
            for a, b in zip(cs, cs[1:]):
                self.tambah(a, b, p["osm_id"], oneway.get(p["osm_id"]) == "yes")

    def tambah(self, a, b, osm_id, satu_arah):
        if a == b:
            return
        d = jarak(a, b)
        for n in (a, b):
            if n not in self.keluar:
                self.keluar[n] = {}
                self.grid.setdefault((int(n[0] * 2000), int(n[1] * 2000)), []).append(n)
        self.keluar[a][b] = (d, osm_id)
        if not satu_arah:
            self.keluar[b][a] = (d, osm_id)

    def terdekat(self, p, maks=30):
        best, bd = None, maks
        gx, gy = int(p[0] * 2000), int(p[1] * 2000)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for n in self.grid.get((gx + dx, gy + dy), ()):
                    d = jarak(n, p)
                    if d < bd:
                        best, bd = n, d
        return best

    def tempel(self, c, maks=1.5):
        """koordinat rute -> simpul jaringan yang sama (beda presisi beberapa cm)"""
        k = kunci(c)
        if k in self.keluar:
            return k
        return self.terdekat(k, maks) or k

    def dijkstra(self, s, t, abaikan_lokal=False):
        dist = {s: 0.0}
        asal = {}
        q = [(0.0, s)]
        while q:
            d, u = heapq.heappop(q)
            if u == t:
                break
            if d > dist.get(u, 1e18) or d > 8000:
                continue
            tetangga = dict(self.keluar.get(u, {}))
            if abaikan_lokal:  # boleh melawan arah di jalan lokal (bukan trunk/primary)
                for v, (dv, oid) in self.masuk(u).items():
                    if v not in tetangga and self.info.get(oid, ("", ""))[1] in LOKAL:
                        tetangga[v] = (dv, oid)
            for v, (dv, _) in tetangga.items():
                nd = d + dv
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    asal[v] = u
                    heapq.heappush(q, (nd, v))
        if t not in dist:
            return None
        jalur = [t]
        while jalur[-1] != s:
            jalur.append(asal[jalur[-1]])
        return jalur[::-1]

    def masuk(self, u):
        if not hasattr(self, "_masuk"):
            self._masuk = {}
            for a, nb in self.keluar.items():
                for b, (d, oid) in nb.items():
                    self._masuk.setdefault(b, {})[a] = (d, oid)
        return self._masuk.get(u, {})

    def osm_sisi(self, a, b):
        e = self.keluar.get(a, {}).get(b) or self.keluar.get(b, {}).get(a)
        return e[1] if e else None


def unduh_way(osm_id):
    url = f"https://api.openstreetmap.org/api/0.6/way/{osm_id}/full.json"
    req = urllib.request.Request(url, headers={"User-Agent": "NAIK-angkot-bogor/1.0 (proyek SIG)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


JALAN_MOBIL = {"trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary",
               "tertiary_link", "unclassified", "residential", "living_street"}


def unduh_bbox(b):
    url = "https://api.openstreetmap.org/api/0.6/map.json?bbox=%.5f,%.5f,%.5f,%.5f" % b
    req = urllib.request.Request(url, headers={"User-Agent": "NAIK-angkot-bogor/1.0 (proyek SIG)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def baca_way(data, osm_id):
    node = {e["id"]: (e["lon"], e["lat"]) for e in data["elements"] if e["type"] == "node"}
    for e in data["elements"]:
        if e["type"] == "way" and e["id"] == osm_id:
            return [kunci(node[n]) for n in e["nodes"]], e.get("tags", {})
    raise SystemExit(f"Way {osm_id} tidak ada di data OSM")


# ---------------- utama ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", nargs="*", default=[], help="file JSON OSM API 0.6 (full) yang sudah diunduh")
    ap.add_argument("--cek", action="store_true", help="hanya hitung & simpan file cek, data tidak diubah")
    args = ap.parse_args()

    tr = json.load(open(TRAYEK, encoding="utf-8"))
    kep = json.load(open(KEPADATAN, encoding="utf-8"))
    oneway = {}
    with open(OSM_CSV, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            oneway[int(r["osm_id"])] = r["oneway"]
    J = Jaringan(kep, oneway)
    osm_lokal = {}
    for f in args.osm:
        d = json.load(open(f, encoding="utf-8"))
        for e in d["elements"]:
            if e["type"] == "way":
                osm_lokal[e["id"]] = d

    # tambahkan way yang belum ada di jaringan: semua jalan mobil di sekitar lokasi + way yang diminta
    way_baru = {}
    for pb in PERBAIKAN:
        if not pb.get("bbox"):
            continue
        try:
            data = unduh_bbox(pb["bbox"]) if not args.osm else {"elements": [e for d in osm_lokal.values() for e in d["elements"]]}
        except Exception as e:  # noqa: BLE001
            raise SystemExit(f"Gagal mengunduh jalan sekitar dari OSM: {e}")
        node = {e["id"]: (e["lon"], e["lat"]) for e in data["elements"] if e["type"] == "node"}
        for e in data["elements"]:
            t = e.get("tags", {})
            if e["type"] != "way" or t.get("highway") not in JALAN_MOBIL or e["id"] in J.info or e["id"] in way_baru:
                continue
            if any(n not in node for n in e["nodes"]):
                continue
            cs = [kunci(node[n]) for n in e["nodes"]]
            if t.get("oneway") == "-1":
                cs = cs[::-1]
            for ujung in (cs[0], cs[-1]):
                if ujung not in J.keluar:
                    n = J.terdekat(ujung, 3)
                    if n:
                        J.tambah(ujung, n, e["id"], False)
            satu = t.get("oneway") in ("yes", "-1") or t.get("junction") == "roundabout"
            for a, b in zip(cs, cs[1:]):
                J.tambah(a, b, e["id"], satu)
            J.info[e["id"]] = (t.get("name", "(tanpa nama)"), t["highway"])
            way_baru[e["id"]] = cs
        print(f"+ {len(way_baru)} jalan sekitar dari OSM")
    for pb in PERBAIKAN:
        for wid in pb["lewat"]:
            if wid in J.info or wid in way_baru:
                continue
            try:
                data = osm_lokal.get(wid) or unduh_way(wid)
            except Exception as e:  # noqa: BLE001
                raise SystemExit(f"Gagal mengunduh way OSM {wid}: {e}\nCek koneksi internet, atau unduh manual "
                                 f"https://api.openstreetmap.org/api/0.6/way/{wid}/full.json lalu pakai --osm file.json")
            cs, tags = baca_way(data, wid)
            # simpul ujung yang tidak persis sama -> sambungkan ke simpul jaringan terdekat (<= 15 m)
            for ujung in (cs[0], cs[-1]):
                if ujung not in J.keluar:
                    n = J.terdekat(ujung, 15)
                    if n:
                        J.tambah(ujung, n, wid, False)
            satu = tags.get("oneway") == "yes"
            for a, b in zip(cs, cs[1:]):
                J.tambah(a, b, wid, satu)
            J.info[wid] = (tags.get("name", "Jalan"), tags.get("highway", "unclassified"))
            way_baru[wid] = cs
            print(f"+ way {wid} {tags.get('name')} ({tags.get('highway')}, oneway={tags.get('oneway', 'no')}), {panjang(cs):.0f} m")
    J.__dict__.pop("_masuk", None)  # cache arah-masuk dibangun ulang setelah ada way baru

    cek = []
    for pb in PERBAIKAN:
        f = next(x for x in tr["features"] if x["properties"]["kode_trayek"] == pb["kode"] and x["properties"]["arah"] == pb["arah"])
        cs = [J.tempel(c) for c in f["geometry"]["coordinates"]]
        kum = [0.0]
        for a, b in zip(cs, cs[1:]):
            kum.append(kum[-1] + jarak(a, b))

        def geom_way(wid):
            if wid in way_baru:
                return way_baru[wid]
            return [kunci(c) for x in kep["features"] if x["properties"]["osm_id"] == wid for c in x["geometry"]["coordinates"]]

        def titik_tengah(wid):
            g = geom_way(wid)
            # simpul way yang paling jauh dari kedua ujungnya (supaya pasti melewati ruas ini)
            return max(g, key=lambda n: min(jarak(n, g[0]), jarak(n, g[-1])))

        w = [titik_tengah(wid) for wid in pb["lewat"]]
        i_dekat = [min(range(len(cs)), key=lambda i: jarak(cs[i], p)) for p in w]
        mulai = max(0, min(i_dekat))
        while mulai > 0 and kum[min(i_dekat)] - kum[mulai] < pb["jendela_m"]:
            mulai -= 1
        akhir = min(len(cs) - 1, max(i_dekat))
        while akhir < len(cs) - 1 and kum[akhir] - kum[max(i_dekat)] < pb["jendela_m"]:
            akhir += 1
        # rute lama kadang bolak-balik di sekitar sini (mencoba menyentuh ruas yang hilang):
        # perpanjang potongan sampai titik terakhir (<= 2 km ke depan) yang kembali ke jejak potongan ini
        jejak = cs[mulai:akhir + 1]
        j = akhir + 1
        while j < len(cs) and kum[j] - kum[akhir] < 2000:
            if min(jarak(cs[j], q) for q in jejak) < 15:
                akhir = j
            j += 1
        S, E = cs[mulai], cs[akhir]
        if S not in J.keluar or E not in J.keluar:
            raise SystemExit("Titik potong rute tidak ada di jaringan, perbaikan dibatalkan")

        def rute(abaikan):
            titik = [S] + w + [E]
            jalur = [S]
            for a, b in zip(titik, titik[1:]):
                p = J.dijkstra(a, b, abaikan)
                if p is None:
                    return None
                jalur += p[1:]
            return jalur

        def putar_balik(j):
            return j is not None and any(j[i] == j[i + 2] for i in range(len(j) - 2))

        jalur = rute(False)
        mode = "ok"
        if jalur is None or putar_balik(jalur):
            jalur = rute(True)
            mode = "cek:lawan_arah_jalan_lokal"
        if putar_balik(jalur):
            jalur = None
            print("   (ditolak: jalur hanya bisa dengan putar balik di ujung jalan)")
        if jalur is None:
            raise SystemExit(f"Tidak ada jalur untuk {pb['kode']} {pb['arah']} lewat {pb['lewat']}")
        lama = cs[mulai:akhir + 1]
        if panjang(jalur) > panjang(lama) + 1500:
            raise SystemExit(f"Jalur baru terlalu memutar ({panjang(jalur):.0f} m vs {panjang(lama):.0f} m), dibatalkan")
        nama = []
        for a, b in zip(jalur, jalur[1:]):
            n = J.info.get(J.osm_sisi(a, b), ("?", ""))[0]
            if not nama or nama[-1] != n:
                nama.append(n)
        print(f"{pb['kode']} {pb['arah']}: potongan {panjang(lama):.0f} m -> {panjang(jalur):.0f} m [{mode}]")
        print("   lewat:", " > ".join(nama))
        baru = cs[:mulai] + jalur + cs[akhir + 1:]
        cek += [
            dict(type="Feature", properties=dict(kode=pb["kode"], arah=pb["arah"], versi="lama"),
                 geometry=dict(type="LineString", coordinates=[list(c) for c in lama])),
            dict(type="Feature", properties=dict(kode=pb["kode"], arah=pb["arah"], versi="baru", mode=mode),
                 geometry=dict(type="LineString", coordinates=[list(c) for c in jalur])),
        ]
        if args.cek:
            continue

        # ---- tulis ke trayek ----
        f["geometry"]["coordinates"] = [list(c) for c in baru]
        p = f["properties"]
        p["panjang_m"] = round(panjang(baru), 1)
        p["status"] = mode
        p["catatan"] = "; ".join(x for x in (p.get("catatan") or "", pb["catatan"]) if x)

        # ---- kepadatan: keanggotaan trayek per ruas dihitung ulang untuk trayek ini ----
        sisi_semua = set()
        for x in tr["features"]:
            if x["properties"]["kode_trayek"] == pb["kode"]:
                c2 = [J.tempel(c) for c in x["geometry"]["coordinates"]]
                sisi_semua |= {frozenset(e) for e in zip(c2, c2[1:])}
        ada = set()
        for x in kep["features"]:
            c2 = [kunci(c) for c in x["geometry"]["coordinates"]]
            sisi = {frozenset(e) for e in zip(c2, c2[1:])}
            ada |= sisi
            daftar = [t.strip() for t in (x["properties"]["trayek"] or "").split(",") if t.strip()]
            lewat = bool(sisi & sisi_semua)
            if lewat and pb["kode"] not in daftar:
                daftar.append(pb["kode"])
            if not lewat and pb["kode"] in daftar:
                daftar.remove(pb["kode"])
            x["properties"]["trayek"] = ", ".join(sorted(daftar))
        for a, b in zip(jalur, jalur[1:]):  # ruas baru (belum ada di kepadatan)
            if frozenset((a, b)) in ada or a == b:
                continue
            oid = J.osm_sisi(a, b)
            nm, hw = J.info.get(oid, ("Jalan", "unclassified"))
            kep["features"].append(dict(type="Feature", geometry=dict(type="LineString", coordinates=[list(a), list(b)]),
                                        properties=dict(osm_id=oid, nama_jalan=nm, highway=hw, jumlah_trayek=0,
                                                        trayek=pb["kode"], kepadatan="rendah", panjang_m=round(jarak(a, b), 1))))
            ada.add(frozenset((a, b)))

        # ---- laporan ----
        with open(LAPORAN, encoding="utf-8-sig") as fh:
            baris = list(csv.DictReader(fh))
        for r in baris:
            if r["kode_trayek"] == pb["kode"] and r["arah"] == pb["arah"]:
                sebut = [x.strip() for x in r["tidak_dilewati"].split(";") if x.strip() and x.strip() != pb["jalan_sk"]]
                tot = int(r["jalan_artikel_dilewati"].split("/")[1])
                r["tidak_dilewati"] = "; ".join(sebut)
                r["jalan_artikel_dilewati"] = f"{tot - len(sebut)}/{tot}"
                r["persen"] = f"{100 * (tot - len(sebut)) / tot:.1f}"
                r["panjang_m"] = f"{p['panjang_m']:.1f}"
                r["status"] = mode
                r["catatan"] = "; ".join(x for x in (r["catatan"], pb["catatan"]) if x)
        with open(LAPORAN, "w", newline="", encoding="utf-8-sig") as fh:
            w_ = csv.DictWriter(fh, fieldnames=list(baris[0].keys()))
            w_.writeheader()
            w_.writerows(baris)

    json.dump(dict(type="FeatureCollection", features=cek), open(CEK, "w", encoding="utf-8"), ensure_ascii=False)
    print("cek potongan lama vs baru:", os.path.relpath(CEK))
    gambar(cek)
    if args.cek:
        print("Mode --cek: data tidak diubah.")
        return

    # kelas kepadatan dihitung ulang, ruas tanpa trayek dibuang
    fit = []
    for x in kep["features"]:
        daftar = [t for t in x["properties"]["trayek"].split(", ") if t]
        if not daftar:
            continue
        n = len(daftar)
        x["properties"]["jumlah_trayek"] = n
        x["properties"]["kepadatan"] = "rendah" if n == 1 else "sedang" if n <= 3 else "tinggi"
        fit.append(x)
    kep["features"] = fit
    json.dump(tr, open(TRAYEK, "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(kep, open(KEPADATAN, "w", encoding="utf-8"), ensure_ascii=False)
    print("Selesai. Jalankan lagi muat_final_qgis.py lalu buat_skema_rute_v4.py di QGIS.")

def gambar(cek):
    try:  # gambar cek (opsional, butuh matplotlib)
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return
    fig, ax = plt.subplots(figsize=(7, 7))
    for x in cek:
        xs, ys = zip(*x["geometry"]["coordinates"])
        lama = x["properties"]["versi"] == "lama"
        ax.plot(xs, ys, lw=5 if lama else 2, color="#bbbbbb" if lama else "#C8432E", label=x["properties"]["versi"])
        if not lama:
            ax.annotate("mulai", xs[0:1] and (xs[0], ys[0]), fontsize=8)
            ax.annotate("selesai", (xs[-1], ys[-1]), fontsize=8)
    ax.set_aspect(1 / math.cos(math.radians(6.59)))
    ax.legend()
    ax.set_title("Perbaikan rute sesuai SK (abu-abu = lama, merah = baru)")
    fig.savefig(os.path.join(SINI, "cek_perbaikan_sk.png"), dpi=110)
    print("gambar cek: cek_perbaikan_sk.png")


if __name__ == "__main__":
    sys.exit(main())
