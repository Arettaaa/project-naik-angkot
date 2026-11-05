// Klien API NAIK (Laravel). Saat `npm run dev`, /api diteruskan ke http://localhost:8000 (lihat vite.config.js).
// Untuk build/deploy, isi VITE_API_URL di .env, mis. VITE_API_URL=https://api-naik.example.com
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api'

async function get(path, params) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : ''
  const res = await fetch(BASE + path + qs, { headers: { Accept: 'application/json' } })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Gagal memuat data (${res.status})`)
  return data
}

export const api = {
  trayek: () => get('/trayek'),
  detailTrayek: (kode) => get(`/trayek/${encodeURIComponent(kode)}`),
  rute: (kode) => get('/rute', { kode }),
  kepadatan: (tingkat) => get('/kepadatan', { tingkat }),
  ringkasan: () => get('/kepadatan/ringkasan'),
  rekomendasi: (asal, tujuan, radius) =>
    get('/rekomendasi', {
      asal: `${asal.lat},${asal.lng}`,
      tujuan: `${tujuan.lat},${tujuan.lng}`,
      radius,
    }),
}
