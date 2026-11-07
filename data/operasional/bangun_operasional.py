#!/usr/bin/env python3
"""
BANGUN DATA TRAYEK OPERASIONAL NAIK (kondisi angkot yang benar-benar beroperasi)
=================================================================================
Jalankan dari folder data/operasional:   python bangun_operasional.py
Butuh: pip install networkx

Dasar (lihat README_OPERASIONAL.md):
  * Daftar trayek beroperasi = 24 trayek hasil survei lapangan 2021
    (Althafurrahman & Yuniarti, Jurnal Teknik Sipil-Arsitektur 20(2), Nov 2021, Tabel 4.1):
      - 19 trayek "AP" (nomor hasil rerouting) -> geometrinya SUDAH ADA di ../final/trayek_angkot_FINAL.geojson
      - 5 trayek "AK" (nomor lama, belum di-rerouting): 02, 03, 07, 09, 21 -> dibentuk di sini
  * Geometri trayek AK: titik-titik GPS hasil naik angkot langsung dari feed GTFS
    "bogor-angkot-gtfs" (Michiel de Jong, 2016-2019, sumber/gtfs_bogor_kota_shapes.txt),
    dicocokkan ke jaringan jalan berarah (ruas OSM di ../final/kepadatan_trayek_FINAL.geojson
    + atribut oneway dari ../osm_jalan.csv) dengan map-matching Viterbi + Dijkstra.
    Celah presisi antar-ruas (< 2 m, atau komponen terputus <= 15 m) disambung dulu.
    Jalan yang tidak ada di jaringan ruas kota (Jl. Gunung Batu, Jl. Raya Tajur-Ciawi) digambar
    lurus antar titik GPS dan dicatat di kolom luar_jaringan_m.
  * Kepadatan dihitung ulang hanya dari trayek operasional (1 rendah / 2-3 sedang / >=4 tinggi).
  * Padanan nomor (baru / lama AK / Moovit) -> padanan_nomor_trayek.csv

Hasil: trayek_operasional.geojson, kepadatan_operasional.geojson, laporan_operasional.csv,
       padanan_nomor_trayek.csv, perbandingan_rencana_vs_operasional.csv
Data lama (../final) TIDAK diubah. Semua hasil ditulis ke folder ini.
"""
import collections
import csv
import json
import math
import os

import networkx as nx

HERE = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.join(HERE, "..", "final")
OSM_CSV = os.path.join(HERE, "..", "osm_jalan.csv")
GTFS_SHAPES = os.path.join(HERE, "sumber", "gtfs_bogor_kota_shapes.txt")

JURNAL = "Althafurrahman & Yuniarti (2021), Jurnal Teknik Sipil-Arsitektur 20(2):143-146, Tabel 4.1 (survei 2021)"
GTFS = "bogor-angkot-gtfs (Michiel de Jong, 2016-2019) - titik GPS naik angkot langsung"

# ---------------------------------------------------------------- trayek beroperasi (jurnal 2021)
# kode -> [panjang total pp (km), % tumpang tindih] menurut jurnal
JURNAL_AP = {
    "01": (18.10, 88), "02": (24.00, 18), "03": (16.90, 60), "05": (9.50, 73), "08": (17.40, 97),
    "09": (13.70, 49), "10": (10.50, 37), "13": (15.40, 74), "14": (23.60, 81), "15": (15.60, 58),
    "17": (22.70, 100), "18": (27.10, 100), "19": (17.00, 14), "21": (18.00, 28), "22": (18.00, 63),
    "23": (23.10, 60), "24": (8.30, 69), "25": (12.80, 58), "30": (10.70, 84),
}
# trayek AK lama: shape GTFS, nama, label titik terminal A (awal Berangkat) & B (ujung Berangkat)
JURNAL_AK = {
    "02 AK": dict(shape="AK-02", km=28.8, tt=100, nama="Sukasari – Terminal Bubulak",
                  a="siliwangi-jlsukasari", b="*Term. Bubulak", asal="Sukasari", tujuan="Terminal Bubulak"),
    "03 AK": dict(shape="AK-03", km=20.0, tt=100, nama="Baranangsiang – Terminal Bubulak",
                  a="*Term. Baranangsiang", b="*Term. Bubulak", asal="Baranangsiang", tujuan="Terminal Bubulak"),
    "07 AK": dict(shape="AK-07", km=13.3, tt=100, nama="Ciparigi – Jl. Ir. H. Juanda (Kebun Raya)",
                  a="*Ciparigi", b="#kb-gedong-sawah", asal="Ciparigi", tujuan="Jl. Ir. H. Juanda"),
    "09 AK": dict(shape="AK-09", km=23.6, tt=100, nama="Ciparigi – Sukasari",
                  a="*Ciparigi", b="*Sukasari", asal="Ciparigi", tujuan="Sukasari"),
    "21 AK": dict(shape="AK-21", km=17.2, tt=41, nama="Baranangsiang – Ciawi",
                  a="*Term. Baranangsiang", b="*Ciawi", asal="Baranangsiang", tujuan="Ciawi"),
}
# nama trayek lama (kotabogor.go.id via feed GTFS) untuk padanan nomor
NAMA_LAMA = {
    "AK-01": "Cipinang Gading – Cipaku – Merdeka", "AK-02": "Sukasari – Terminal Bubulak",
    "AK-03": "Baranangsiang – Terminal Bubulak", "AK-04": "Warung Nangka – Rancamaya – Ramayana",
    "AK-05": "Cimahpar – Pangrango – Ramayana", "AK-06": "Ciheuleut – Jl. Bangka – Ramayana",
    "AK-07": "Ciparigi – Terminal Merdeka", "AK-07A": "Ciparigi – Merdeka (varian A)",
    "AK-08": "Warung Jambu – Jl. Ir. H. Juanda – Ramayana", "AK-09": "Ciparigi – Sukasari",
    "AK-10": "Bantar Kemang – Sukasari – Merdeka", "AK-11": "Pajajaran Indah – Pasar Bogor",
    "AK-12": "Cimanggu – MA Salmun – Pasar Anyar", "AK-13": "Bantar Kemang – Jl. Bangka – Ramayana",
    "AK-14": "Sukasari – Pasir Kuda – Bubulak", "AK-15": "Merdeka – Bubulak – SBJ",
    "AK-16": "Pasar Anyar – Salabenda", "AK-17": "Pomad – Tanah Baru – Bina Marga",
    "AK-18": "Ramayana – Mulyaharja", "AK-19": "Terminal Bubulak – Kencana",
    "AK-20": "Pasar Anyar – Kencana", "AK-21": "Baranangsiang – Ciawi",
    "AK-22": "Pasar Anyar – Pondok Rumput", "AK-23": "Ramayana – Taman Kencana – Warung Jambu",
}

# padanan ke kode jalur di Moovit (data komunitas, diunduh Nov 2026; dicocokkan manual dari urutan halte/ujung trayek).
# Moovit memakai campuran nomor baru (AP) dan nomor lama (AK) seperti di lapangan.
MOOVIT = {
    "01": "01", "02": "02; 04 (nomor lama AK-04)", "03": "03; 05 (nomor lama AK-05, sampai Sukaraja)",
    "05": "06 (nomor lama AK-06)", "08": "10 (nomor lama AK-10)", "09": "09", "10": "12 (nomor lama AK-12)",
    "13": "13", "14": "14", "15": "15AP", "17": "17AP", "18": "18", "19": "19AP", "21": "",
    "22": "", "23": "20 (nomor lama AK-20)", "24": "24; 22 (nomor lama AK-22)", "25": "25; 08A (mirip)",
    "30": "08 (nomor lama AK-08)",
    "02 AK": "2_AK", "03 AK": "3_AK", "07 AK": "07A (koridor mirip)", "09 AK": "9_AK", "21 AK": "21AK",
    # trayek rencana SK yang TIDAK ada di daftar jurnal 2021
    "07": "07", "11": "11", "16": "16", "26": "26", "27": "27", "28": "28AP", "29": "29",
}
# ruas yang dilewati trayek tapi tidak ada di jaringan ruas kota (digambar garis lurus antar titik GPS)
SISIPAN_LUAR = {
    "02 AK": [("Jalan Perintis Kemerdekaan", "Jalan Mayjen Ishak Djuarsa", ["Jalan Gunung Batu (luar jaringan)"])],
    "03 AK": [("Jalan Perintis Kemerdekaan", "Jalan Mayjen Ishak Djuarsa", ["Jalan Gunung Batu (luar jaringan)"])],
    "21 AK": [("Jalan Raya Pajajaran", "Ciawi", ["Jalan Raya Tajur (luar jaringan)", "Jalan Raya Wangun (luar jaringan)"])],
}


def sisipkan_luar(teks, kode):
    for a, b, isi in SISIPAN_LUAR.get(kode, []):
        teks = teks.replace(f"{a} > {b}", " > ".join([a] + isi + [b]))
        teks = teks.replace(f"{b} > {a}", " > ".join([b] + isi[::-1] + [a]))
    return teks


K = 111320.0


def jarak(a, b):
    """jarak meter antara (lon,lat) a dan b (haversine)."""
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371000 * math.asin(min(1, math.sqrt(h)))


def panjang(coords):
    return sum(jarak(a, b) for a, b in zip(coords, coords[1:]))


def kelas(n):
    return "tinggi" if n >= 4 else "sedang" if n >= 2 else "rendah"


# ---------------------------------------------------------------- 1. graf jalan berarah
def bangun_graf():
    oneway = {int(r["osm_id"]): r["oneway"] for r in csv.DictReader(open(OSM_CSV, encoding="utf-8"))}
    kep = json.load(open(os.path.join(FINAL, "kepadatan_trayek_FINAL.geojson"), encoding="utf-8"))
    G = nx.DiGraph()
    R = lambda c: (round(c[0], 7), round(c[1], 7))
    for fid, f in enumerate(kep["features"]):
        g = f["geometry"]
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        satu_arah = oneway.get(f["properties"]["osm_id"]) == "yes"
        for line in lines:
            for a, b in zip(line, line[1:]):
                a, b = R(a), R(b)
                d = jarak(a, b)
                G.add_edge(a, b, len=d, fid=fid)
                if not satu_arah:
                    G.add_edge(b, a, len=d, fid=fid)
    grid = collections.defaultdict(list)
    for n in G.nodes:
        grid[(int(n[0] * 1000), int(n[1] * 1000))].append(n)

    # Ruas di data final kadang tidak berbagi titik persis di simpang (selisih < 1 m karena presisi),
    # sehingga jaringan terputus (mis. Jl. Ishak Djuarsa - Jl. RE Abdullah). Sambungkan:
    # (a) node berjarak <= 2 m, (b) tiap komponen terpisah ke komponen utama lewat pasangan terdekat <= 15 m.
    def sambungkan(a, b):
        d = jarak(a, b)
        for u, v in ((a, b), (b, a)):
            if not G.has_edge(u, v):
                G.add_edge(u, v, len=d, fid=None)
    for n in list(G.nodes):
        for q in node_dekat(grid, n, maks=2, n=6)[0]:
            if q != n:
                sambungkan(n, q)
    cc = sorted(nx.weakly_connected_components(G), key=len, reverse=True)
    utama = cc[0]
    for c in cc[1:]:
        best = None
        for n in c:
            for q in node_dekat(grid, n, maks=15, n=10)[0]:
                if q in utama and (best is None or jarak(n, q) < best[0]):
                    best = (jarak(n, q), n, q)
        if best:
            sambungkan(best[1], best[2])
            utama |= c
    return G, grid, kep


def node_dekat(grid, p, maks=60, n=6):
    """n node graf terdekat dari titik p (lon,lat) dalam radius maks meter."""
    gi, gj = int(p[0] * 1000), int(p[1] * 1000)
    kand = []
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for q in grid.get((gi + di, gj + dj), []):
                d = jarak(p, q)
                if d <= maks:
                    kand.append((d, q))
    return [q for _, q in sorted(kand)[:n]], (sorted(kand)[0][0] if kand else None)


# ---------------------------------------------------------------- 2. trayek AK dari titik GPS
def baca_gtfs():
    S = collections.defaultdict(list)
    with open(GTFS_SHAPES, encoding="utf-8") as fh:
        for r in csv.reader(fh):
            if r and r[0] != "shape_id":
                S[r[0]].append((float(r[2]), float(r[1]), r[-1].strip()))  # (lon, lat, label)
    return S


def pecah_putaran(titik, a, b):
    """putaran berangkat+pulang -> (berangkat, pulang) mulai dari label a, berbalik di label b."""
    pts = list(titik)
    if len(pts) > 1 and jarak(pts[0][:2], pts[-1][:2]) < 30:
        pts = pts[:-1]  # titik akhir = titik awal
    ia = next(i for i, p in enumerate(pts) if p[2] == a)
    rot = pts[ia:] + pts[:ia]
    ib = next(i for i, p in enumerate(rot) if p[2] == b and i > 0)
    return rot[: ib + 1], rot[ib:] + [rot[0]]


def sambung(G, grid, titik):
    """Map-matching sederhana (Viterbi): pilih node jalan untuk tiap titik GPS sehingga total
    jalur berarah antar titik paling pendek. Hasil: coords, fid ruas, catatan, panjang luar jaringan (m)."""
    # titik putar balik di tol (Jagorawi) tidak ada di jaringan ruas kota -> dilewati
    pts = [p for p in titik if p[2] not in ("*Jl. Tol",)]
    # buang titik yang terlalu rapat
    rapi = []
    for p in pts:
        if not rapi or jarak(rapi[-1][:2], p[:2]) >= 15:
            rapi.append(p)
    UG = G.to_undirected(as_view=True)
    cat = collections.Counter()

    def biaya_jalur(u, v, lurus):
        """(panjang, path, jenis) jalur u->v; berarah dulu, kalau memutar terlalu jauh pakai abaikan arah (penalti)."""
        try:
            Lu, pu = nx.single_source_dijkstra(UG, u, v, weight="len", cutoff=3 * lurus + 1500)
        except nx.NetworkXNoPath:
            return lurus * 4 + 1000, [u, v], "garis_lurus"
        try:
            L, path = nx.single_source_dijkstra(G, u, v, weight="len", cutoff=3 * lurus + 1500)
            # berarah dipakai kalau tidak memutar jauh dibanding koridor terpendek. Kalau memutar jauh,
            # biasanya lajur searah di jalan dua lajur terpisah tidak ada di jaringan ruas -> pakai koridor yang sama.
            if L <= 1.25 * Lu + 150:
                return L, path, "ok"
        except nx.NetworkXNoPath:
            pass
        return Lu * 1.5 + 200, pu, "abaikan_satu_arah"

    # segmen-segmen titik yang ada di jaringan; titik luar jaringan memutus segmen
    coords, fids, luar = [], [], 0.0
    segmen, cur = [], []
    for p in rapi:
        kand, _ = node_dekat(grid, p[:2], maks=70, n=8)
        if kand:
            cur.append((p, kand))
        else:
            if cur:
                segmen.append(cur)
                cur = []
            segmen.append([(p, None)])
    if cur:
        segmen.append(cur)

    for seg in segmen:
        if seg[0][1] is None:  # titik GPS luar jaringan
            p = seg[0][0][:2]
            if coords:
                luar += jarak(coords[-1], p)
            coords.append(p)
            cat["titik_luar_jaringan"] += 1
            continue
        # Viterbi di dalam segmen
        layer = [{c: (2 * jarak(seg[0][0][:2], c), None, None, None) for c in seg[0][1]}]
        for i in range(1, len(seg)):
            p, kand = seg[i]
            prev = layer[-1]
            nxt = {}
            for c in kand:
                best = None
                for u, (cost, *_r) in prev.items():
                    lurus = jarak(u, c)
                    L, path, jenis = biaya_jalur(u, c, lurus)
                    tot = cost + L + 2 * jarak(p[:2], c)
                    if best is None or tot < best[0]:
                        best = (tot, u, path, jenis)
                nxt[c] = best
            layer.append(nxt)
        # telusur balik
        c = min(layer[-1], key=lambda x: layer[-1][x][0])
        jalur = []
        for i in range(len(layer) - 1, 0, -1):
            _, u, path, jenis = layer[i][c]
            jalur.append((path, jenis))
            c = u
        jalur.reverse()
        if coords:  # sambungan dari titik luar jaringan sebelumnya
            luar += jarak(coords[-1], c)
            cat["garis_lurus"] += 1
        coords.append(c)
        for path, jenis in jalur:
            if jenis != "ok":
                cat[jenis] += 1
            if jenis == "garis_lurus":
                luar += jarak(path[0], path[-1])
            for u, v in zip(path, path[1:]):
                e = G.get_edge_data(u, v) or G.get_edge_data(v, u)
                if e and e["fid"] is not None:
                    fids.append(e["fid"])
                coords.append(v)
    out = [coords[0]]
    for c in coords[1:]:
        if jarak(out[-1], c) > 0.5:
            out.append(c)
    return out, fids, cat, luar


def lintasan(fids, kep):
    nama = []
    for f in fids:
        n = kep["features"][f]["properties"]["nama_jalan"]
        if n and not n.startswith("(") and (not nama or nama[-1] != n):
            nama.append(n)
    # hilangkan "kedip" A > B > A yang sangat pendek
    return " > ".join(nama)


# ---------------------------------------------------------------- 3. padanan nomor lama (AP)
def padanan_lama(coords_list, S):
    """trayek lama GTFS yang paling mirip dengan rute (gabungan dua arah)."""
    sampel = []
    for cs in coords_list:
        acc = 0
        for a, b in zip(cs, cs[1:]):
            acc += jarak(a, b)
            if acc >= 100:
                sampel.append(b)
                acc = 0
    grid = collections.defaultdict(list)
    for cs in coords_list:
        for c in cs:
            grid[(int(c[0] * 500), int(c[1] * 500))].append(c)

    def dekat_rute(p, maks):
        gi, gj = int(p[0] * 500), int(p[1] * 500)
        return any(jarak(p, q) <= maks for di in (-1, 0, 1) for dj in (-1, 0, 1) for q in grid.get((gi + di, gj + dj), []))

    hasil = []
    for sid, pts in S.items():
        cov_lama = sum(dekat_rute(p[:2], 120) for p in pts) / len(pts)
        # seberapa banyak rute baru yang dekat ke titik-titik trayek lama
        cov_baru = sum(any(jarak(s, p[:2]) <= 350 for p in pts) for s in sampel) / max(1, len(sampel))
        hasil.append((min(cov_lama, cov_baru), sid, cov_lama, cov_baru))
    hasil.sort(reverse=True)
    return hasil[0]


# ---------------------------------------------------------------- main
def main():
    G, grid, kep = bangun_graf()
    S = baca_gtfs()
    final = json.load(open(os.path.join(FINAL, "trayek_angkot_FINAL.geojson"), encoding="utf-8"))
    fitur, laporan = [], []
    anggota = collections.defaultdict(set)  # fid ruas -> kode operasional

    # 19 AP: ambil dari data final (rerouting) + anggota ruasnya dari kepadatan final
    for i, f in enumerate(kep["features"]):
        for t in str(f["properties"]["trayek"] or "").split(","):
            kode = t.strip().replace("Trayek ", "")
            if kode in JURNAL_AP:
                anggota[i].add(kode)
    per_kode = collections.defaultdict(list)
    for f in final["features"]:
        kode = f["properties"]["kode_trayek"].replace("Trayek ", "")
        if kode in JURNAL_AP:
            per_kode[kode].append(f)
    mirip_semua = {k: padanan_lama([x["geometry"]["coordinates"] for x in per_kode[k]], S) for k in JURNAL_AP}
    terbaik = {}  # nomor lama -> kode AP dengan skor tertinggi (satu nomor lama hanya untuk satu trayek)
    for k, m in mirip_semua.items():
        if m[0] >= 0.55 and (m[1] not in terbaik or m[0] > mirip_semua[terbaik[m[1]]][0]):
            terbaik[m[1]] = k
    catatan_lama = {}
    for kode in sorted(JURNAL_AP):
        fs = per_kode[kode]
        mirip = mirip_semua[kode]
        lama = mirip[1] if mirip[0] >= 0.55 and terbaik.get(mirip[1]) == kode else ""
        if mirip[0] >= 0.55 and not lama:
            catatan_lama[kode] = f"mirip {mirip[1]} (skor {mirip[0]:.2f}) tapi {mirip[1]} lebih cocok ke trayek {terbaik[mirip[1]]}"
        for f in fs:
            p = dict(f["properties"])
            p.update(
                kode=kode, kode_moovit=MOOVIT.get(kode, ""), jenis="AP", jaringan="operasional", nama_lama=lama,
                nama_lama_trayek=NAMA_LAMA.get(lama, ""),
                bukti_operasi=JURNAL, sumber_geometri=p.get("sumber", ""),
                status_lapangan="beroperasi (survei 2021) - perlu cek ulang 2026",
            )
            fitur.append({"type": "Feature", "geometry": f["geometry"], "properties": p})
        km = sum(x["properties"]["panjang_m"] for x in fs) / 1000
        laporan.append(dict(kode=kode, jenis="AP", nama_trayek=fs[0]["properties"]["nama_trayek"],
                            km_data=round(km, 1), km_jurnal=JURNAL_AP[kode][0],
                            selisih_persen=round((km / JURNAL_AP[kode][0] - 1) * 100),
                            nama_lama=lama, nama_lama_trayek=NAMA_LAMA.get(lama, ""),
                            skor_kemiripan=round(mirip[0], 2),
                            catatan_pembentukan="geometri dari data final (artikel rerouting)"
                            + (f"; {catatan_lama[kode]}" if kode in catatan_lama else "")))

    # 5 AK: dari titik GPS GTFS
    luar_total = collections.Counter()  # panjang (m) di luar jaringan ruas kota per trayek
    for kode, cfg in JURNAL_AK.items():
        brk, plg = pecah_putaran(S[cfg["shape"]], cfg["a"], cfg["b"])
        km_total, cat_total = 0, collections.Counter()
        for arah, titik, asal, tujuan in (("Berangkat", brk, cfg["asal"], cfg["tujuan"]),
                                          ("Pulang", plg, cfg["tujuan"], cfg["asal"])):
            coords, fids, cat, luar = sambung(G, grid, titik)
            cat_total.update(cat)
            luar_total[kode] += luar
            for fid in fids:
                anggota[fid].add(kode)
            m = panjang(coords)
            km_total += m / 1000
            catatan = ", ".join(f"{k}={v}" for k, v in cat.items()) or ""
            fitur.append({"type": "Feature",
                          "geometry": {"type": "LineString", "coordinates": [[round(x, 7), round(y, 7)] for x, y in coords]},
                          "properties": {
                              "kode_trayek": f"Trayek {kode}", "kode_moovit": MOOVIT.get(kode, ""),
                              "nama_trayek": cfg["nama"], "arah": arah,
                              "lintasan": sisipkan_luar(f"{asal} > {lintasan(fids, kep)} > {tujuan}", kode),
                              "sumber": GTFS, "n_halte": len(titik), "halte_tak_terpetakan": cat.get("titik_luar_jaringan", 0),
                              "panjang_m": round(m, 1), "luar_jaringan_m": round(luar, 1),
                              "status": "ok" if not cat else "cek:" + catatan,
                              "validasi": "OK", "catatan": catatan,
                              "kode": kode, "jenis": "AK", "jaringan": "operasional",
                              "nama_lama": cfg["shape"], "nama_lama_trayek": NAMA_LAMA[cfg["shape"]],
                              "bukti_operasi": JURNAL, "sumber_geometri": GTFS,
                              "status_lapangan": "beroperasi (survei 2021) - perlu cek ulang 2026",
                          }})
        laporan.append(dict(kode=kode, jenis="AK", nama_trayek=cfg["nama"], km_data=round(km_total, 1), km_jurnal=cfg["km"],
                            selisih_persen=round((km_total / cfg["km"] - 1) * 100), nama_lama=cfg["shape"],
                            nama_lama_trayek=NAMA_LAMA[cfg["shape"]], skor_kemiripan="",
                            catatan_pembentukan=(", ".join(f"{k}={v}" for k, v in cat_total.items()) or "semua titik tersambung lewat jalan")
                            + (f"; luar jaringan ruas kota {luar_total[kode]/1000:.1f} km" if luar_total[kode] > 50 else "")))

    # kepadatan operasional
    kep_out = []
    for fid, kodes in anggota.items():
        f = kep["features"][fid]
        p = f["properties"]
        kep_out.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "osm_id": p["osm_id"], "nama_jalan": p["nama_jalan"], "highway": p["highway"],
            "jumlah_trayek": len(kodes), "trayek": ", ".join(sorted(kodes)),
            "kepadatan": kelas(len(kodes)), "panjang_m": p["panjang_m"], "jaringan": "operasional"}})

    # % tumpang tindih per trayek (bandingkan dengan jurnal)
    tt = {}
    for kode in list(JURNAL_AP) + list(JURNAL_AK):
        tot = sum(kep["features"][fid]["properties"]["panjang_m"] for fid, ks in anggota.items() if kode in ks)
        ov = sum(kep["features"][fid]["properties"]["panjang_m"] for fid, ks in anggota.items() if kode in ks and len(ks) >= 2)
        tot += luar_total.get(kode, 0) / 2  # rata-rata dua arah, dianggap tidak tumpang tindih
        tt[kode] = round(100 * ov / tot) if tot else None
    for r in laporan:
        r["tumpang_tindih_data_persen"] = tt[r["kode"]]
        r["tumpang_tindih_jurnal_persen"] = (JURNAL_AP.get(r["kode"]) or (None, JURNAL_AK.get(r["kode"], {}).get("tt")))[1]

    # perbandingan rencana (SK rerouting, data final) vs operasional
    def km_kelas(features):
        c = collections.Counter()
        for f in features:
            c[f["properties"]["kepadatan"]] += f["properties"]["panjang_m"] / 1000
        return c
    rencana, oper = km_kelas(kep["features"]), km_kelas(kep_out)

    crs = {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}}
    json.dump({"type": "FeatureCollection", "name": "trayek_operasional", "crs": crs, "features": fitur},
              open(os.path.join(HERE, "trayek_operasional.geojson"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump({"type": "FeatureCollection", "name": "kepadatan_operasional", "crs": crs, "features": kep_out},
              open(os.path.join(HERE, "kepadatan_operasional.geojson"), "w", encoding="utf-8"), ensure_ascii=False)
    with open(os.path.join(HERE, "laporan_operasional.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(laporan[0].keys()))
        w.writeheader()
        w.writerows(sorted(laporan, key=lambda r: (r["jenis"], r["kode"])))
    with open(os.path.join(HERE, "perbandingan_rencana_vs_operasional.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["kepadatan", "rencana_sk_km (30 trayek)", "operasional_km (24 trayek)"])
        for k in ("rendah", "sedang", "tinggi"):
            w.writerow([k, round(rencana[k], 1), round(oper[k], 1)])
        w.writerow(["total", round(sum(rencana.values()), 1), round(sum(oper.values()), 1)])

    # padanan nomor: semua 30 kode rencana SK + 5 AK -> nomor lama, kode Moovit, status operasi
    nama_sk = {}
    geom_sk = collections.defaultdict(list)
    for f in final["features"]:
        k = f["properties"]["kode_trayek"].replace("Trayek ", "")
        nama_sk.setdefault(k, f["properties"]["nama_trayek"])
        geom_sk[k].append(f["geometry"]["coordinates"])
    lap = {r["kode"]: r for r in laporan}
    baris = []
    for k in sorted(nama_sk):
        if k in JURNAL_AP:
            r = lap[k]
            baris.append(dict(kode_operasional=k, kode_rencana_sk=f"Trayek {k}", jenis="AP (nomor baru)",
                              nama_trayek=nama_sk[k], nomor_lama=r["nama_lama"], nama_trayek_lama=r["nama_lama_trayek"],
                              kode_moovit=MOOVIT.get(k, ""), status="beroperasi (jurnal 2021)",
                              km_jurnal=r["km_jurnal"], km_data=r["km_data"],
                              tumpang_tindih_jurnal_persen=r["tumpang_tindih_jurnal_persen"],
                              tumpang_tindih_data_persen=r["tumpang_tindih_data_persen"],
                              catatan="; ".join(x for x in (
                                  catatan_lama.get(k, ""),
                                  f"panjang data {r['selisih_persen']:+d}% dari jurnal -> geometri perlu dicek lapangan"
                                  if abs(r["selisih_persen"]) > 25 else "") if x)))
        else:
            m = padanan_lama(geom_sk[k], S)
            mv = MOOVIT.get(k, "")
            baris.append(dict(kode_operasional="", kode_rencana_sk=f"Trayek {k}", jenis="rencana SK",
                              nama_trayek=nama_sk[k], nomor_lama="", nama_trayek_lama="",
                              kode_moovit=mv,
                              status=("tidak ada di jurnal 2021, tapi ADA di Moovit -> cek lapangan" if mv
                                      else "tidak tercatat beroperasi (jurnal 2021 & Moovit)"),
                              km_jurnal="", km_data="", tumpang_tindih_jurnal_persen="", tumpang_tindih_data_persen="",
                              catatan=(f"jalurnya mirip {m[1]} ({NAMA_LAMA.get(m[1], '')}, skor {m[0]:.2f})"
                                       if m[0] >= 0.55 else "")))
    for k, cfg in JURNAL_AK.items():
        r = lap[k]
        baris.append(dict(kode_operasional=k, kode_rencana_sk="", jenis="AK (nomor lama, belum dialihkan)",
                          nama_trayek=cfg["nama"], nomor_lama=cfg["shape"], nama_trayek_lama=NAMA_LAMA[cfg["shape"]],
                          kode_moovit=MOOVIT.get(k, ""), status="beroperasi (jurnal 2021)",
                          km_jurnal=cfg["km"], km_data=r["km_data"],
                          tumpang_tindih_jurnal_persen=cfg["tt"], tumpang_tindih_data_persen=r["tumpang_tindih_data_persen"],
                          catatan="geometri dari titik GPS GTFS; " + r["catatan_pembentukan"]))
    with open(os.path.join(HERE, "padanan_nomor_trayek.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(baris[0].keys()))
        w.writeheader()
        w.writerows(baris)

    print(f"trayek_operasional: {len(fitur)} rute ({len(fitur)//2} trayek)")
    print(f"kepadatan_operasional: {len(kep_out)} ruas | " + ", ".join(f"{k} {oper[k]:.1f} km" for k in ("rendah", "sedang", "tinggi")))
    print(f"(rencana SK: " + ", ".join(f"{k} {rencana[k]:.1f} km" for k in ("rendah", "sedang", "tinggi")) + ")")
    for r in sorted(laporan, key=lambda r: (r["jenis"], r["kode"])):
        print(f"{r['kode']:6} {r['km_data']:5.1f} km (jurnal {r['km_jurnal']:5.1f}, {r['selisih_persen']:+4d}%) "
              f"tumpang tindih {r['tumpang_tindih_data_persen']}% (jurnal {r['tumpang_tindih_jurnal_persen']}%) "
              f"lama={r['nama_lama'] or '-'} {r['catatan_pembentukan'] if r['jenis']=='AK' else ''}")


if __name__ == "__main__":
    main()
