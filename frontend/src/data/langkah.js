import ikonJalur from '../assets/carakerja/ikon-jalur.svg'
import ikonLokasi from '../assets/carakerja/ikon-lokasi.svg'
import ikonRekomendasi from '../assets/carakerja/ikon-rekomendasi.svg'
import ikonTujuan from '../assets/carakerja/ikon-tujuan.svg'

const langkah = [
  {
    nomor: '01',
    judul: 'Pilih lokasi asal',
    deskripsi: 'Masukkan dari mana kamu berangkat.',
    warna: '#38BDF8',
    ikon: ikonLokasi,
  },
  {
    nomor: '02',
    judul: 'Tentukan tujuan',
    deskripsi: 'Pilih lokasi yang ingin kamu tuju.',
    warna: '#FFAB2E',
    ikon: ikonTujuan,
  },
  {
    nomor: '03',
    judul: 'Lihat rekomendasi rute',
    deskripsi: 'Sistem mencocokkan lokasi dengan data rute.',
    warna: '#A586FF',
    ikon: ikonRekomendasi,
  },
  {
    nomor: '04',
    judul: 'Eksplorasi jalur',
    deskripsi: 'Lihat jalur angkot langsung pada peta.',
    warna: '#2F6B4F',
    ikon: ikonJalur,
  },
]

export default langkah
