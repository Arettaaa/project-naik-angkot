import ikonPresisi from '../assets/tentang/ikon-presisi.svg'
import ikonPanduan from '../assets/tentang/ikon-panduan.svg'
import ikonSulit from '../assets/tentang/ikon-sulit.svg'

export const kartuTentang = [
  {
    id: 'rute-presisi',
    judul: 'Rute Jelas',
    deskripsi: 'Lihat jalur setiap angkot lengkap dengan nama jalan yang dilewati.',
    warna: '#FF7D1F',
    ikon: ikonPresisi,
  },
  {
    id: 'panduan-transit',
    judul: 'Titik Pindah',
    deskripsi: 'Perlu ganti angkot? NAIK menunjukkan tempat turun dan angkot berikutnya.',
    warna: '#09B58D',
    ikon: ikonPanduan,
  },
  {
    id: 'sulit-menentukan',
    judul: 'Asal ke Tujuan',
    deskripsi: 'Cukup isi asal dan tujuan. Angkot tercepat beserta tarifnya langsung muncul.',
    warna: '#FFC700',
    ikon: ikonSulit,
  },
]

export default kartuTentang
