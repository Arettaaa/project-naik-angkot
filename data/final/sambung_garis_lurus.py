#!/usr/bin/env python3
"""SAMBUNG GARIS LURUS DI RUTE KE JALAN OSM

Trayek lama (AK) diambil dari titik GPS. Di beberapa tempat titiknya jarang / jalannya belum ada di
jaringan ruas, jadi rute di peta jadi garis lurus memotong rumah & sawah:
  * 02 lama & 03 lama: Jl. Gunung Batu (±0,9 km)
  * 21 lama          : Jl. Raya Tajur sampai Ciawi (±5 km)
  * 09 lama          : sedikit di sekitar Jl. Kumbang (±0,2 km)

Script ini mencari otomatis semua potongan rute (trayek mana pun) yang tidak menempel ke ruas jalan,
mengunduh jalan di sekitarnya dari OpenStreetMap (api.openstreetmap.org, tanpa API key), lalu merutekan
ulang potongan itu lewat jalan sungguhan dengan mengikuti titik GPS aslinya. Hasil yang terlalu memutar
atau melenceng jauh dari titik GPS ditolak (rute lama dibiarkan).

Yang diperbarui: trayek_angkot_FINAL.geojson, kepadatan_trayek_FINAL.geojson (ruas baru ikut dihitung).
File cek: cek_sambung_garis.geojson (potongan lama vs baru) untuk dilihat di QGIS.

Cara pakai (butuh internet, tanpa library tambahan):
    cd data/final
    python sambung_garis_lurus.py --cek     # unduh + hitung + simpan file cek, data TIDAK diubah
    python sambung_garis_lurus.py           # tulis ke data
Unduhan OSM disimpan di folder osm_unduhan/ (tidak perlu di-commit), jadi run kedua tidak mengunduh lagi.
Aman dijalankan ulang: kalau sudah tersambung, tidak ada yang diubah.
Setelah itu jalankan muat_final_qgis.py lalu buat_skema_rute_v4.py di QGIS.
"""
import argparse
import csv
import heapq
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from perbaiki_rute_sk import (JALAN_MOBIL, KEPADATAN, LOKAL, OSM_CSV, SINI, TRAYEK,  # noqa: E402
                              Jaringan, jarak, kunci, panjang)

CEK = os.path.join(SINI, "cek_sambung_garis.geojson")
CACHE = os.path.join(SINI, "osm_unduhan")
UA = {"User-Agent": "NAIK-angkot-bogor/1.0 (proyek SIG)"}

MIN_SISI = 25     # m: sisi rute tanpa ruas jalan yang lebih pendek dari ini cuma beda presisi, diabaikan
MIN_POTONG = 50   # m: potongan yang diperbaiki minimal sepanjang ini
PAD = 0.0025      # derajat (±280 m) di sekitar potongan yang diunduh dari OSM
MAKS_SISI_KOTAK = 0.02
SIMPANG_MAKS = 150  # m: titik GPS asli boleh paling jauh segini dari jalur baru

# nama jalan yang memang dilewati menurut Moovit / warga (dipakai sebagai preferensi + pengecekan)
HARAP = {
    "Trayek 02AK": ["Gunung Batu"],
    "Trayek 03AK": ["Gunung Batu"],
    "Trayek 21AK": ["Tajur"],
}
# angkot lebih suka jalan besar: biaya per meter dikali faktor ini
FAKTOR = {"trunk": 1.0, "primary": 1.0, "secondary": 1.0, "tertiary": 1.05, "unclassified": 1.25,
          "residential": 1.4, "living_street": 2.0}


# ---------------- OSM ----------------
def unduh_bbox(b, tingkat=0):
    """JSON API 0.6 /map untuk bbox (w, s, e, n). Kalau isinya kebanyakan, kotak dibagi empat."""
    url = "https://api.openstreetmap.org/api/0.6/map.json?bbox=%.5f,%.5f,%.5f,%.5f" % b
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
            return json.load(r)["elements"]
    except urllib.error.HTTPError as e:
        if e.code != 400 or tingkat >= 3:
            raise
    w, s, e_, n = b
    mx, my = (w + e_) / 2, (s + n) / 2
    hasil = {}
    for k in ((w, s, mx, my), (mx, s, e_, my), (w, my, mx, n), (mx, my, e_, n)):
        time.sleep(1)
        for el in unduh_bbox(k, tingkat + 1):
            hasil[(el["type"], el["id"])] = el
    return list(hasil.values())


def ambil_bbox(b):
    os.makedirs(CACHE, exist_ok=True)
    nama = os.path.join(CACHE, "bbox_%.4f_%.4f_%.4f_%.4f.json" % b)
    if os.path.exists(nama):
        return json.load(open(nama, encoding="utf-8"))["elements"]
    print("  unduh OSM bbox %.4f,%.4f,%.4f,%.4f ..." % b, flush=True)
    el = unduh_bbox(b)
    # simpan hanya jalan + simpulnya (gedung dll dibuang supaya kecil)
    jalan = [e for e in el if e["type"] == "way" and e.get("tags", {}).get("highway") in JALAN_MOBIL]
    perlu = {n for w in jalan for n in w["nodes"]}
    simpul = [e for e in el if e["type"] == "node" and e["id"] in perlu]
    json.dump({"elements": simpul + jalan}, open(nama, "w", encoding="utf-8"))
    time.sleep(1)
    return simpul + jalan


def kotak_untuk(a, b):
    w = math.floor((min(a[0], b[0]) - PAD) * 1e4) / 1e4
    s = math.floor((min(a[1], b[1]) - PAD) * 1e4) / 1e4
    e = math.ceil((max(a[0], b[0]) + PAD) * 1e4) / 1e4
    n = math.ceil((max(a[1], b[1]) + PAD) * 1e4) / 1e4
    return (w, s, e, n)


def gabung_kotak(kotak):
    kotak = sorted(set(kotak))
    berubah = True
    while berubah:
        berubah = False
        for i in range(len(kotak)):
            for j in range(i + 1, len(kotak)):
                a, b = kotak[i], kotak[j]
                if a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]:
                    u = (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))
                    if u[2] - u[0] <= MAKS_SISI_KOTAK and u[3] - u[1] <= MAKS_SISI_KOTAK:
                        kotak = [k for x, k in enumerate(kotak) if x not in (i, j)] + [u]
                        berubah = True
                        break
            if berubah:
                break
    return kotak


def tambah_jalan_osm(J, elements):
    """masukkan semua jalan mobil dari OSM ke jaringan (sisi yang sudah ada tidak diubah)"""
    node = {e["id"]: (e["lon"], e["lat"]) for e in elements if e["type"] == "node"}
    n_baru = 0
    for e in elements:
        t = e.get("tags", {})
        if e["type"] != "way" or t.get("highway") not in JALAN_MOBIL or any(n not in node for n in e["nodes"]):
            continue
        cs = [kunci(node[n]) for n in e["nodes"]]
        if t.get("oneway") == "-1":
            cs = cs[::-1]
        satu = t.get("oneway") in ("yes", "-1") or t.get("junction") == "roundabout"
        if e["id"] not in J.info:
            J.info[e["id"]] = (t.get("name", "(tanpa nama)"), t["highway"])
        for ujung in (cs[0], cs[-1]):  # ujung jalan yang beda beberapa cm dari simpul jaringan
            if ujung not in J.keluar:
                n = J.terdekat(ujung, 3)
                if n:
                    J.tambah(ujung, n, e["id"], False)
        for a, b in zip(cs, cs[1:]):
            if b in J.keluar.get(a, {}) or a in J.keluar.get(b, {}):
                continue
            J.tambah(a, b, e["id"], satu)
            n_baru += 1
    J.__dict__.pop("_masuk", None)
    return n_baru


# ---------------- geometri ----------------
def ke_meter(p, ref):
    return ((p[0] - ref[0]) * 111320 * math.cos(math.radians(ref[1])), (p[1] - ref[1]) * 110574)


def jarak_ke_garis(p, cs):
    best = 1e18
    for a, b in zip(cs, cs[1:]):
        ax, ay = ke_meter(a, p)
        bx, by = ke_meter(b, p)
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def melenceng(lama, jalur):
    """seberapa jauh jalur baru dari garis lama, diukur tiap 50 m di garis lama.
    Hasil: rasio terhadap batas (<= 1 berarti wajar) dan jarak terjauh (m).
    Batas tiap sisi lama: SIMPANG_MAKS atau 35% panjang sisi itu (jalan asli boleh melengkung dari garis lurus)."""
    rasio, maks = 0.0, 0.0
    for a, b in zip(lama, lama[1:]):
        L = jarak(a, b)
        n = max(1, int(L // 50))
        batas = max(SIMPANG_MAKS, 0.35 * L)
        for k in range(n + 1):
            t = k / n
            d = jarak_ke_garis((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), jalur)
            maks = max(maks, d)
            rasio = max(rasio, d / batas)
    return rasio, maks


def buang_ekor(j):
    """hapus 'ekor' a-b-a (masuk sebentar ke titik GPS lalu balik lagi)"""
    berubah = True
    while berubah:
        berubah = False
        for i in range(len(j) - 2):
            if j[i] == j[i + 2]:
                j = j[:i + 1] + j[i + 3:]
                berubah = True
                break
    out = [j[0]]
    for n in j[1:]:
        if n != out[-1]:
            out.append(n)
    return out


# ---------------- perutean ----------------
class Perute:
    def __init__(self, J):
        self.J = J
        self.kelas = {}  # simpul -> kelas jalan terbesar yang menyentuhnya (buat menempelkan titik GPS)
        for a, nb in J.keluar.items():
            for b, (_, oid) in nb.items():
                hw = J.info.get(oid, ("", ""))[1]
                for n in (a, b):
                    if FAKTOR.get(hw.replace("_link", ""), 1.4) < FAKTOR.get(self.kelas.get(n, "living_street"), 2):
                        self.kelas[n] = hw.replace("_link", "")

    def tempel_gps(self, p, maks=60):
        """titik GPS -> simpul jaringan terdekat, lebih memilih jalan besar"""
        best, bd = None, 1e18
        gx, gy = int(p[0] * 2000), int(p[1] * 2000)
        for dx in (-2, -1, 0, 1, 2):
            for dy in (-2, -1, 0, 1, 2):
                for n in self.J.grid.get((gx + dx, gy + dy), ()):
                    d = jarak(n, p)
                    if d > maks:
                        continue
                    skor = d * FAKTOR.get(self.kelas.get(n, "residential"), 1.4)
                    if skor < bd:
                        best, bd = n, skor
        return best

    def biaya(self, d, oid, harap):
        nama, hw = self.J.info.get(oid, ("", "residential"))
        f = FAKTOR.get(hw.replace("_link", ""), 1.4)
        if harap and any(h.lower() in nama.lower() for h in harap):
            f *= 0.75
        return d * f

    def dijkstra(self, s, t, harap, lawan_lokal=False):
        J = self.J
        dist, asal, q = {s: 0.0}, {}, [(0.0, s)]
        while q:
            d, u = heapq.heappop(q)
            if u == t:
                break
            if d > dist.get(u, 1e18) or d > 15000:
                continue
            tetangga = dict(J.keluar.get(u, {}))
            if lawan_lokal:
                for v, (dv, oid) in J.masuk(u).items():
                    if v not in tetangga and J.info.get(oid, ("", ""))[1] in LOKAL:
                        tetangga[v] = (dv, oid)
            for v, (dv, oid) in tetangga.items():
                nd = d + self.biaya(dv, oid, harap)
                if nd < dist.get(v, 1e18):
                    dist[v], asal[v] = nd, u
                    heapq.heappush(q, (nd, v))
        if t not in dist:
            return None
        j = [t]
        while j[-1] != s:
            j.append(asal[j[-1]])
        return j[::-1]

    def lewat(self, titik, harap, lawan_lokal):
        jalur = [titik[0]]
        for a, b in zip(titik, titik[1:]):
            if a == b:
                continue
            p = self.dijkstra(a, b, harap, lawan_lokal)
            if p is None:
                return None
            jalur += p[1:]
        return buang_ekor(jalur)


def cari_potongan(J, cs):
    """indeks sisi rute yang tidak ada di jaringan -> potongan [i0, i1] (titik i0 .. i1+1)"""
    bolong = [i for i, (a, b) in enumerate(zip(cs, cs[1:]))
              if a != b and J.osm_sisi(a, b) is None and jarak(a, b) >= MIN_SISI]
    potong = []
    for i in bolong:
        if potong and i - potong[-1][1] <= 3:
            potong[-1][1] = i
        else:
            potong.append([i, i])
    return [(i0, i1) for i0, i1 in potong if panjang(cs[i0:i1 + 2]) >= MIN_POTONG]


def nama_jalan(J, jalur):
    nama = []
    for a, b in zip(jalur, jalur[1:]):
        n = J.info.get(J.osm_sisi(a, b), ("?", ""))[0]
        if not nama or nama[-1] != n:
            nama.append(n)
    return nama


# ---------------- utama ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cek", action="store_true", help="hanya hitung & simpan file cek, data tidak diubah")
    ap.add_argument("--osm", nargs="*", default=[], help="pakai file JSON OSM API 0.6 ini saja (tanpa unduh)")
    args = ap.parse_args()

    tr = json.load(open(TRAYEK, encoding="utf-8"))
    kep = json.load(open(KEPADATAN, encoding="utf-8"))
    oneway = {}
    with open(OSM_CSV, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            oneway[int(r["osm_id"])] = r["oneway"]
    J = Jaringan(kep, oneway)

    # 1. cari potongan yang tidak menempel ke jalan
    temuan = []  # (feature, cs, [(i0, i1)])
    for f in tr["features"]:
        if f["geometry"]["type"] != "LineString":
            continue
        cs = [J.tempel(c) for c in f["geometry"]["coordinates"]]
        pot = cari_potongan(J, cs)
        if pot:
            temuan.append((f, cs, pot))
            p = f["properties"]
            print(f"{p['kode_trayek']} {p['arah']}: {len(pot)} potongan, "
                  + ", ".join(f"{panjang(cs[a:b + 2]):.0f} m" for a, b in pot))
    if not temuan:
        print("Tidak ada garis lurus yang perlu disambung. Data sudah rapi.")
        return 0

    # 2. unduh jalan OSM di sekitarnya
    if args.osm:
        el = [e for fn in args.osm for e in json.load(open(fn, encoding="utf-8"))["elements"]]
    else:
        kotak = [kotak_untuk(cs[i], cs[i + 1]) for _, cs, pot in temuan for i0, i1 in pot for i in range(i0, i1 + 1)]
        kotak = gabung_kotak(kotak)
        print(f"jalan OSM: {len(kotak)} kotak")
        el = []
        try:
            for k in kotak:
                el += ambil_bbox(k)
        except Exception as e:  # noqa: BLE001
            raise SystemExit(f"Gagal mengunduh dari OpenStreetMap: {e}\nCek koneksi internet lalu jalankan lagi "
                             f"(yang sudah terunduh tersimpan di {os.path.relpath(CACHE)}).")
    print(f"+ {tambah_jalan_osm(J, el)} sisi jalan baru dari OSM")
    P = Perute(J)

    # 3. rutekan ulang tiap potongan
    cek, diubah, ditolak = [], set(), []
    for f, cs, pot in temuan:
        p = f["properties"]
        harap = HARAP.get(p["kode_trayek"], [])
        baru = list(cs)
        for i0, i1 in reversed(pot):  # dari belakang supaya indeks depan tidak bergeser
            lama = cs[i0:i1 + 2]
            titik = [P.tempel_gps(c, 80 if k in (0, len(lama) - 1) else 60) for k, c in enumerate(lama)]
            if titik[0] is None or titik[-1] is None:
                ditolak.append(f"{p['kode_trayek']} {p['arah']} #{i0}: ujung potongan tidak dekat jalan OSM")
                continue
            titik = [t for t in titik if t is not None]
            hasil, alasan = None, "tidak ada jalur"
            for lawan, mode in ((False, "ok"), (True, "cek:lawan_arah_jalan_lokal")):
                jalur = P.lewat(titik, harap, lawan)
                if jalur is None or len(jalur) < 2:
                    continue
                rasio, simpang = melenceng(lama, jalur)
                if panjang(jalur) > 1.5 * panjang(lama) + 400 or rasio > 1:
                    alasan = f"{panjang(jalur):.0f} m vs {panjang(lama):.0f} m, melenceng {simpang:.0f} m"
                    continue
                hasil = (jalur, mode, simpang)
                break
            if hasil is None:
                ditolak.append(f"{p['kode_trayek']} {p['arah']} #{i0}: {alasan}")
                continue
            jalur, mode, simpang = hasil
            nm = nama_jalan(J, jalur)
            ok_harap = not harap or any(h.lower() in " ".join(nm).lower() for h in harap)
            print(f"{p['kode_trayek']} {p['arah']} #{i0}: {panjang(lama):.0f} m lurus -> {panjang(jalur):.0f} m "
                  f"[{mode}] melenceng maks {simpang:.0f} m")
            print("   lewat:", " > ".join(nm) + ("" if ok_harap else f"   (!! tidak lewat {', '.join(harap)})"))
            # ujung potongan yang dipindah ke jalan terdekat ikut diganti
            baru = baru[:i0] + jalur + baru[i1 + 2:]
            cek += [
                dict(type="Feature", properties=dict(kode=p["kode_trayek"], arah=p["arah"], versi="lama",
                                                     panjang_m=round(panjang(lama))),
                     geometry=dict(type="LineString", coordinates=[list(c) for c in lama])),
                dict(type="Feature", properties=dict(kode=p["kode_trayek"], arah=p["arah"], versi="baru", mode=mode,
                                                     panjang_m=round(panjang(jalur)), lewat=" > ".join(nm)),
                     geometry=dict(type="LineString", coordinates=[list(c) for c in jalur])),
            ]
            if mode != "ok":
                p["status"] = mode
        if baru != cs:
            f["_baru"] = baru
            diubah.add(p["kode_trayek"])
    for t in ditolak:
        print("dilewati (rute lama dibiarkan):", t)

    json.dump(dict(type="FeatureCollection", features=cek), open(CEK, "w", encoding="utf-8"), ensure_ascii=False)
    print("cek potongan lama vs baru:", os.path.relpath(CEK))
    if args.cek or not diubah:
        for f in tr["features"]:
            f.pop("_baru", None)
        print("Mode --cek: data tidak diubah." if args.cek else "Tidak ada yang diubah.")
        return 0

    # 4. tulis trayek
    for f in tr["features"]:
        baru = f.pop("_baru", None)
        if baru is None:
            continue
        p = f["properties"]
        f["geometry"]["coordinates"] = [list(c) for c in baru]
        p["panjang_m"] = round(panjang(baru), 1)
        tambahan = "garis lurus disambung ke jalan OSM (sambung_garis_lurus.py)"
        if tambahan not in (p.get("catatan") or ""):
            p["catatan"] = "; ".join(x for x in (p.get("catatan") or "", tambahan) if x)

    # 5. kepadatan: keanggotaan trayek yang diubah dihitung ulang, ruas baru ditambahkan
    sisi_kode = {}
    for f in tr["features"]:
        k = f["properties"]["kode_trayek"]
        if k in diubah:
            c2 = [J.tempel(c) for c in f["geometry"]["coordinates"]]
            for e in zip(c2, c2[1:]):
                if e[0] != e[1]:
                    sisi_kode.setdefault(frozenset(e), set()).add(k)
    ada = set()
    for x in kep["features"]:
        c2 = [kunci(c) for c in x["geometry"]["coordinates"]]
        sisi = {frozenset(e) for e in zip(c2, c2[1:])}
        ada |= sisi
        lewat = set().union(*(sisi_kode.get(s, set()) for s in sisi)) if sisi else set()
        daftar = {t.strip() for t in (x["properties"]["trayek"] or "").split(",") if t.strip()}
        daftar = (daftar - diubah) | lewat
        x["properties"]["trayek"] = ", ".join(sorted(daftar))
    n_ruas = 0
    for f in tr["features"]:  # ruas baru disusun berurutan, digabung per jalan OSM yang sama
        if f["properties"]["kode_trayek"] not in diubah:
            continue
        c2 = [J.tempel(c) for c in f["geometry"]["coordinates"]]
        run, kunci_run = [], None
        for a, b in list(zip(c2, c2[1:])) + [(None, None)]:
            e = frozenset((a, b)) if a is not None else None
            k = None
            if e is not None and a != b and e not in ada:
                k = (J.osm_sisi(a, b), tuple(sorted(sisi_kode.get(e, ()))))
            if run and (k is None or k != kunci_run):
                oid, kode = kunci_run
                nm, hw = J.info.get(oid, ("Jalan", "unclassified"))
                kep["features"].append(dict(type="Feature", geometry=dict(type="LineString", coordinates=[list(c) for c in run]),
                                            properties=dict(osm_id=oid, nama_jalan=nm, highway=hw, jumlah_trayek=0,
                                                            trayek=", ".join(kode), kepadatan="rendah",
                                                            panjang_m=round(panjang(run), 1))))
                n_ruas += 1
                run = []
            if k is not None:
                if not run:
                    run = [a]
                run.append(b)
                kunci_run = k
                ada.add(e)
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
    print(f"+ {n_ruas} ruas baru di kepadatan. Trayek diubah: {', '.join(sorted(diubah))}")
    print("Selesai. Jalankan lagi muat_final_qgis.py lalu buat_skema_rute_v4.py di QGIS.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
