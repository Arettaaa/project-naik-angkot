import ikonJalur from '../assets/carakerja/ikon-jalur.svg'
import ikonLokasi from '../assets/carakerja/ikon-lokasi.svg'
import ikonRekomendasi from '../assets/carakerja/ikon-rekomendasi.svg'
import ikonTujuan from '../assets/carakerja/ikon-tujuan.svg'

const langkah = [
  {
    nomor: '01',
    judul: 'Tentukan titik berangkat',
    deskripsi: 'Lokasimu terisi otomatis, atau ketik nama tempat.',
    warna: '#38BDF8',
    ikon: ikonLokasi,
  },
  {
    nomor: '02',
    judul: 'Pilih tujuan',
    deskripsi: 'Ketik tujuan atau klik di peta. Rute langsung dicari.',
    warna: '#FFAB2E',
    ikon: ikonTujuan,
  },
  {
    nomor: '03',
    judul: 'Bandingkan angkot',
    deskripsi: 'Lihat waktu tempuh dan tarif setiap pilihan angkot.',
    warna: '#A586FF',
    ikon: ikonRekomendasi,
  },
  {
    nomor: '04',
    judul: 'Ikuti jalurnya',
    deskripsi: 'Lihat jalurnya di peta dan putar simulasi perjalanannya.',
    warna: '#2F6B4F',
    ikon: ikonJalur,
  },
]

export default langkah
