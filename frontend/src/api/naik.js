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

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Gagal memproses permintaan (${res.status})`)
  return data
}

export const api = {
  trayek: () => get('/trayek'),
  detailTrayek: (kode) => get(`/trayek/${encodeURIComponent(kode)}`),
  rute: (kode) => get('/rute', { kode }),
  kepadatan: (tingkat) => get('/kepadatan', { tingkat }),
  ringkasan: () => get('/kepadatan/ringkasan'),
  // dekat = [lat, lng] (dibulatkan supaya cache server tetap kena) -> hasil diurutkan dari yang terdekat
  poi: (q, dekat) => get('/poi', { q, limit: 8, lat: dekat?.[0], lng: dekat?.[1] }),
  // alamat titik di peta (reverse geocoding); dibulatkan ±1 m
  alamat: (lat, lng) => get('/alamat', { lat: (+lat).toFixed(5), lng: (+lng).toFixed(5) }),
  rekomendasi: (asal, tujuan, radius) =>
    get('/rekomendasi', {
      asal: `${asal.lat},${asal.lng}`,
      tujuan: `${tujuan.lat},${tujuan.lng}`,
      radius,
    }),
  rekomendasiKoridor: (kode, params) => get(`/rekomendasi/koridor/${encodeURIComponent(kode)}`, params),
  aiRekomendasi: (payload) => post('/ai/rekomendasi', payload),
}
