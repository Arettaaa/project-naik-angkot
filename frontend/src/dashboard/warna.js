// Warna trayek: 30 warna berbeda, disusun di ruang warna OKLCH (15 rona × 2 tingkat terang, kecerahan & saturasi seragam)
// supaya serasi satu sama lain, teks putih tetap terbaca (kontras ≥ 3:1), dan nomor berdekatan punya rona yang jauh beda.
// 01 sengaja hijau brand NAIK. Nomor 16–30 = versi lebih terang dari rona 01–15.
const PALET = [
  '#008D5C', '#B2580B', '#3475C4', '#A84F8E', '#428731', '#0088A4', '#B84C55', '#7C60BD', '#A56300', '#007FBA',
  '#008D87', '#B24C74', '#5E6AC5', '#B75037', '#9656A9', '#00A771', '#DF7A32', '#4F97EF', '#D470B5', '#58A547',
  '#00A2C1', '#E66D75', '#A083EA', '#CD8300', '#009EE0', '#00A49D', '#DF6C98', '#7B8BF0', '#E57255', '#BE78D4',
]

export function warnaTrayek(kode) {
  const n = parseInt(String(kode ?? '').replace(/\D/g, ''), 10)
  const lama = /AK$/i.test(String(kode ?? '')) ? 15 : 0 // trayek lama: warna beda dari nomor SK yang sama
  return PALET[((Number.isFinite(n) ? n - 1 : 0) + lama) % PALET.length]
}

// Kelas kepadatan dari BE (sesuai metode TA): 1 / 2–3 / ≥4 trayek.
// Hijau daun → kunyit → bata: tetap terbaca sebagai "aman → waspada → padat", tapi lebih kalem dari lampu lalu lintas.
export const KEPADATAN = [
  { key: 'Rendah', warna: '#4FAE84', lembut: '#E6F4EC', ket: '1 rute', tebal: 2.5 },
  { key: 'Sedang', warna: '#E3A03A', lembut: '#FCF1DD', ket: '2–3 rute', tebal: 3.5 },
  { key: 'Tinggi', warna: '#C8432E', lembut: '#F8E3DF', ket: '≥ 4 rute', tebal: 5 },
]
export const kepadatanOf = (t) => KEPADATAN.find((k) => k.key === t) ?? KEPADATAN[0]
export const tingkatDari = (n) => (n >= 4 ? 'Tinggi' : n >= 2 ? 'Sedang' : 'Rendah')
