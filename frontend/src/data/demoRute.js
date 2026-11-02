// Koordinat perkiraan untuk demo; ganti dengan data resmi sebelum dipakai publik.
// DATA CONTOH
export const halte = [
  { id: 'baranangsiang', nama: 'Terminal Baranangsiang', posisi: [-6.6025, 106.806] },
  { id: 'sukasari', nama: 'Sukasari', posisi: [-6.619, 106.8073], warna: '#F04B43' },
  { id: 'warung-jambu', nama: 'Warung Jambu', posisi: [-6.5795, 106.8136], warna: '#F18B31' },
  { id: 'bubulak', nama: 'Terminal Bubulak', posisi: [-6.5634, 106.7467], warna: '#14B9C4' },
  { id: 'pusat-kota', nama: 'Pusat Kota', posisi: [-6.5951, 106.7972], warna: '#087B87' },
  { id: 'pasar-anyar', nama: 'Pasar Anyar', posisi: [-6.5941, 106.7903], warna: '#14B9C4' },
  { id: 'merdeka', nama: 'Terminal Merdeka', posisi: [-6.5883, 106.7781], warna: '#2FCB7B' },
  { id: 'pasar-bogor', nama: 'Pasar Bogor', posisi: [-6.5975, 106.7926], warna: '#A65BC2' },
]

// DATA CONTOH
export const trayek = [
  {
    id: '01 AP',
    nama: 'Baranangsiang – Bubulak',
    warna: '#F04B43',
    halte: ['baranangsiang', 'pusat-kota', 'pasar-anyar', 'bubulak'],
    menit: 28,
  },
  {
    id: '03 AP',
    nama: 'Bubulak – Sukasari',
    warna: '#2FCB7B',
    halte: ['bubulak', 'pusat-kota', 'sukasari'],
    menit: 32,
  },
  {
    id: '07 AP',
    nama: 'Warung Jambu – Pasar Bogor',
    warna: '#F18B31',
    halte: ['warung-jambu', 'merdeka', 'pasar-bogor'],
    menit: 24,
  },
  {
    id: '02 AK',
    nama: 'Merdeka – Baranangsiang',
    warna: '#168EA0',
    halte: ['merdeka', 'pasar-bogor', 'warung-jambu'],
    menit: 26,
  },
]

// DATA CONTOH
export const ruasPadat = [
  {
    id: 'pajajaran',
    nama: 'Jl. Pajajaran',
    tingkat: 'Padat',
    warna: '#F04B43',
    jumlahTrayek: 6,
    posisi: [
      [-6.6025, 106.806],
      [-6.592, 106.81],
      [-6.5795, 106.8136],
    ],
  },
  {
    id: 'juanda',
    nama: 'Jl. Ir. H. Juanda',
    tingkat: 'Sedang',
    warna: '#F18B31',
    jumlahTrayek: 4,
    posisi: [
      [-6.5975, 106.7926],
      [-6.5951, 106.7972],
      [-6.5905, 106.801],
    ],
  },
  {
    id: 'suryakencana',
    nama: 'Jl. Suryakencana',
    tingkat: 'Renggang',
    warna: '#2FCB7B',
    jumlahTrayek: 2,
    posisi: [
      [-6.619, 106.8073],
      [-6.611, 106.802],
      [-6.6025, 106.806],
    ],
  },
]

export default { halte, trayek, ruasPadat }
