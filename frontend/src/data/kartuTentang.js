import ikonPresisi from '../assets/tentang/ikon-presisi.svg'
import ikonPanduan from '../assets/tentang/ikon-panduan.svg'
import ikonSulit from '../assets/tentang/ikon-sulit.svg'

export const kartuTentang = [
  {
    id: 'rute-presisi',
    judul: 'Rute Presisi',
    deskripsi:
      'Temukan titik naik-turun dan jalur trayek paling efisien tanpa takut salah angkot.',
    warna: '#FF7D1F',
    ikon: ikonPresisi,
  },
  {
    id: 'panduan-transit',
    judul: 'Panduan Transit',
    deskripsi:
      'Informasi rute jauh lebih mudah dipahami ketika ditampilkan langsung pada peta.',
    warna: '#09B58D',
    ikon: ikonPanduan,
  },
  {
    id: 'sulit-menentukan',
    judul: 'Sulit Menentukan',
    deskripsi:
      'Pengguna butuh bantuan menemukan rute berdasarkan lokasi asal dan tujuan.',
    warna: '#FFC700',
    ikon: ikonSulit,
  },
]

export default kartuTentang
