# Algoritme Pencarian Rute Angkot (Dijkstra + Yen)

Dipakai oleh `GET /api/rekomendasi?asal=lat,lon&tujuan=lat,lon` (kode: `backend/app/Services/PencariRuteDijkstra.php`).
Cara lama (langsung + 1x pindah dengan SQL) masih bisa dipanggil dengan `&metode=lama` sebagai pembanding.

## 1. Graf trayek

Graf yang dipakai **bukan graf jalan**, melainkan **graf trayek**. Jalur 30 trayek SK + 4 trayek lama tidak diubah
sama sekali. Yang dicari hanya: naik angkot apa, turun di mana, dan pindah di mana.

| Unsur | Isi |
|---|---|
| Node | 439 titik pindah (`naik.titik_transfer`, perpotongan dua trayek), ditambah node **O** (asal) dan **D** (tujuan) |
| Sisi | satu kali naik angkot pada satu rute (trayek + arah) dari titik *i* ke titik *j* yang dilewati **sesudah** *i* (searah jalur) |
| Arah | berarah, mengikuti arah rute (Berangkat/Pulang, termasuk sistem satu arah) |
| Jumlah sisi | ±12.000 (dibangun dari `naik.mv_transfer_rute`) |

Syarat sisi:
- titik pindah paling jauh 250 m dari jalur angkot;
- naik angkot minimal 300 m (kurang dari itu lebih baik jalan kaki), kecuali angkot langsung asal → tujuan;
- sisi dari **O** hanya ke rute yang jaraknya ≤ 800 m dari asal; sisi ke **D** hanya dari rute yang jaraknya ≤ 800 m dari tujuan.

## 2. Bobot sisi (menit)

```
w = d_naik / 75  +  5  +  s / 250  +  d_turun / 75
```

| Simbol | Arti | Nilai |
|---|---|---|
| d_naik | jalan kaki dari titik (asal / titik pindah) ke jalur angkot | meter |
| 5 | waktu menunggu angkot setiap kali naik | menit |
| s | jarak naik angkot di sepanjang jalur | meter |
| d_turun | jalan kaki dari jalur ke titik berikutnya (titik pindah / tujuan) | meter |
| 75 | kecepatan jalan kaki | m/menit (4,5 km/jam) |
| 250 | kecepatan angkot | m/menit (15 km/jam) |

Karena setiap naik angkot ditambah 5 menit tunggu, rute dengan lebih sedikit pindah otomatis lebih diutamakan.

## 3. Dijkstra

State = (node, jumlah angkot yang sudah dinaiki, trayek terakhir), supaya dua aturan ini tetap tepat:
- maksimal **3 angkot** (2x pindah);
- tidak boleh turun lalu naik **trayek yang sama**.

Dijkstra dimulai dari O dengan antrian prioritas, dan berhenti saat node D pertama kali diambil dari antrian.
Hasilnya adalah rute tercepat.

## 4. Yen (rute alternatif)

1. P1 = Dijkstra(O → D).
2. Untuk setiap node pada rute sebelumnya (spur node):
   - root path = bagian rute dari O sampai spur node;
   - buang sisi dari spur node yang **trayeknya** sudah dipakai rute lain dengan root yang sama;
   - buang node root (kecuali spur node) supaya rute tidak berputar balik;
   - spur path = Dijkstra(spur node → D); kandidat = root + spur → masukkan ke daftar B.
3. Ambil kandidat tercepat dari B sebagai alternatif berikutnya. Ulangi sampai K alternatif.

Penyimpangan dilakukan per **trayek** (bukan per sisi), sehingga setiap alternatif memakai kombinasi angkot yang
berbeda, bukan hanya beda titik pindah beberapa meter.

Yen dijalankan dua tahap: K = 12 untuk rute sampai 2 angkot, lalu K = 10 untuk rute 3 angkot. Dengan begitu opsi
2 angkot yang lebih murah tidak tergeser oleh rute 3 angkot yang hanya sedikit lebih cepat.

## 5. Opsi yang ditampilkan

- **Langsung (1 angkot):** maksimal 5.
- **Pindah 1x (2 angkot):** hanya kalau waktunya ≤ angkot langsung tercepat + 5 menit; maksimal 5.
- **Pindah 2x (3 angkot):** hanya kalau tidak ada opsi 1–2 angkot, atau minimal 5 menit lebih cepat; maksimal 3.
- Rute yang angkot pertamanya sudah bisa langsung sampai tujuan tidak dipakai untuk pindah.
- Rute pindah yang angkot terakhirnya bisa langsung dari asal hanya ditampilkan kalau lebih cepat dari naik
  angkot itu langsung.

## 6. Contoh hitungan (data asli)

SV IPB Cilibende (−6.5885, 106.8060) → Stasiun Bogor (−6.5953, 106.7906). Rute tercepat:

| Langkah | Jarak | Waktu |
|---|---|---|
| Jalan ke Jl. Pajajaran | 43 m | 43/75 = 0,57 mnt |
| Tunggu + naik **30** (warga: 08) arah Bogor Trade Mall | 3.191 m | 5 + 3191/250 = 17,76 mnt |
| Jalan di titik pindah dekat BTM | 127 m | 127/75 = 1,69 mnt |
| Tunggu + naik **29** arah Terminal Merdeka | 1.266 m | 5 + 1266/250 = 10,06 mnt |
| Jalan ke Stasiun Bogor | 119 m | 119/75 = 1,59 mnt |
| **Total** | | **31,7 ≈ 32 menit**, tarif Rp10.000 |

Rute ini tidak ada angkot langsung, karena SSA di sekitar Kebun Raya membuat angkot dari SV mengarah ke BTM dulu.

## 7. Hasil pengujian

Dibandingkan dengan cara lama (langsung + 1x pindah) pada 320 pasangan asal–tujuan acak di Kota Bogor:

| Hasil | Jumlah |
|---|---|
| Waktu tercepat sama | 158 |
| Lebih cepat (karena ada opsi 3 angkot) | 12 |
| Lebih lambat | **0** |
| Dulu "tidak ada angkot", sekarang ada rute | 22 |
| Angkot langsung versi lama yang tetap muncul | 98–100% |

Waktu proses (graf + Dijkstra + Yen): median ±40 ms, maksimal ±160 ms.

## 8. Perbandingan dengan referensi (Pradipta 2016, Algoritme Yen)

| | Pradipta (2016) | NAIK |
|---|---|---|
| Graf | graf jalan, bobot jarak (km) | graf trayek, bobot waktu (menit) |
| Pindah angkot | dicari setelah jalur terpendek ditemukan | sudah dihitung di dalam bobot (tunggu 5 menit) |
| Arah jalan / SSA | data sebelum SSA | mengikuti arah rute (SSA) |
| Asal & tujuan | pilihan tempat dari daftar | titik mana saja di peta / GPS |
| Alternatif | K jalur jalan (lebih dari 2 bisa lambat / crash) | K kombinasi angkot berbeda (±40 ms) |
