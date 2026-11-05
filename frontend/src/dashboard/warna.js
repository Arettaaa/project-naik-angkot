// Warna trayek konsisten (badge & garis), mengikuti palet desain.
const PALET = ['#1A936F', '#38BDF8', '#FF9F1C', '#A586FF', '#FF6B6B', '#22C55E', '#F472B6', '#0EA5E9', '#EAB308', '#8B5CF6']

export function warnaTrayek(kode) {
  const n = parseInt(String(kode ?? '').replace(/\D/g, ''), 10)
  return PALET[(Number.isFinite(n) ? n - 1 : 0) % PALET.length]
}

// Kelas kepadatan dari BE (sesuai metode TA): 1 / 2–3 / ≥4 trayek.
export const KEPADATAN = [
  { key: 'Rendah', warna: '#2DBE7E', ket: '1 rute', tebal: 2.5 },
  { key: 'Sedang', warna: '#FFC531', ket: '2–3 rute', tebal: 3.5 },
  { key: 'Tinggi', warna: '#F2542D', ket: '≥ 4 rute', tebal: 5 },
]
export const kepadatanOf = (t) => KEPADATAN.find((k) => k.key === t) ?? KEPADATAN[0]
