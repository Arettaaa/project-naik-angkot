import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import { api } from '../api/naik'
import { TEMPAT } from '../data/tempat'

// true jika layar desktop (≥1024px), ikut berubah saat jendela di-resize.
export function useLayarBesar() {
  const q = '(min-width: 1024px)'
  const [besar, setBesar] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setBesar(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return besar
}

// ---------- pencarian tempat ----------

const BBOX_BOGOR = '106.70,-6.70,106.90,-6.48' // minLon,minLat,maxLon,maxLat (Kota Bogor + pinggiran)
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

export function jarakMeter(a, b) {
  const R = 6371000
  const r = (x) => (x * Math.PI) / 180
  const dLat = r(b[0] - a[0])
  const dLng = r(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
export const teksJarak = (m) => (m == null ? '' : m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`)

// cadangan kalau backend tidak bisa dihubungi: Photon (OpenStreetMap) langsung dari browser
async function cariOsm(q, dekat, signal) {
  const bias = dekat ? `&lat=${dekat[0]}&lon=${dekat[1]}` : ''
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=${BBOX_BOGOR}&limit=8${bias}`, { signal })
  if (!res.ok) return []
  const d = await res.json()
  return (d.features ?? [])
    .filter((f) => f.properties?.name)
    .map((f) => {
      const p = f.properties
      const [lng, lat] = f.geometry.coordinates
      return {
        nama: p.name,
        ket: [p.street, p.district ?? p.locality, p.city].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', '),
        lat: +lat.toFixed(6),
        lng: +lng.toFixed(6),
        jenis: 'osm',
      }
    })
}

/**
 * Cari tempat: /api/poi (semua tempat, jalan, kelurahan & perumahan dari OSM di database NAIK; diurutkan paling cocok lalu terdekat)
 * + daftar tempat cepat. `dekat` = [lat, lng] pusat peta / lokasi pengguna.
 */
export function useCariTempat(q, dekat) {
  const [state, setState] = useState({ kunci: '', hasil: [], gagal: false })
  const k = norm(q)
  const d = dekat ? [+dekat[0].toFixed(2), +dekat[1].toFixed(2)] : null // ±1 km, supaya cache server tetap kena
  const kunci = `${k}|${d?.join(',') ?? ''}`
  useEffect(() => {
    if (k.length < 2) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      let server = null
      let osm = null
      try {
        server = await api.poi(k, d)
      } catch {
        osm = await cariOsm(k, d, ctrl.signal).catch(() => null)
      }
      if (ctrl.signal.aborted) return
      const jarak = (x) => (x.jarak_m != null ? x.jarak_m : d ? Math.round(jarakMeter(d, [x.lat, x.lng])) : null)
      const lokal = TEMPAT.filter((t) => norm(t.nama).includes(k)).map((t) => ({ ...t, jenis: 'naik' }))
      const lihat = new Set()
      const hasil = [...(server ?? []), ...(osm ?? []), ...lokal]
        .filter((x) => {
          const n = norm(x.nama)
          if (lihat.has(n)) return false
          lihat.add(n)
          return true
        })
        .map((x) => ({ ...x, jarak_m: jarak(x) }))
      setState({ kunci, hasil: hasil.slice(0, 10), gagal: server === null && osm === null && !lokal.length })
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci])
  if (k.length < 2) return { hasil: [], loading: false, siap: false, gagal: false }
  const cocok = state.kunci === kunci
  return { hasil: cocok ? state.hasil : [], loading: !cocok, siap: cocok, gagal: cocok && state.gagal }
}

// ---------- riwayat & tempat tersimpan (Rumah, Kampus) — disimpan di browser ----------

const KUNCI_SAYA = 'naik:tempat-saya'
const KOSONG = { riwayat: [], rumah: null, kampus: null }
let cadangan = KOSONG // dipakai kalau localStorage diblokir

function bacaSaya() {
  try {
    return { ...KOSONG, ...(JSON.parse(localStorage.getItem(KUNCI_SAYA)) ?? {}) }
  } catch {
    return cadangan
  }
}
function tulisSaya(d) {
  cadangan = d
  try {
    localStorage.setItem(KUNCI_SAYA, JSON.stringify(d))
  } catch {
    // abaikan (mode privat dsb.)
  }
  window.dispatchEvent(new Event('naik-tempat-saya'))
}
const ringkas = (t) => ({
  nama: t.nama === 'Lokasi saya' ? t.ket?.split(',')[0] || 'Titik tersimpan' : t.nama,
  ket: t.ket ?? null,
  lat: +(+t.lat).toFixed(6),
  lng: +(+t.lng).toFixed(6),
})
const sama = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5

export const tempatSaya = {
  tambahRiwayat(t) {
    if (!t || t.nama === 'Lokasi saya') return
    const d = bacaSaya()
    tulisSaya({ ...d, riwayat: [ringkas(t), ...d.riwayat.filter((r) => !sama(r, t))].slice(0, 8) })
  },
  hapusRiwayat(t) {
    const d = bacaSaya()
    tulisSaya({ ...d, riwayat: d.riwayat.filter((r) => !sama(r, t)) })
  },
  atur(slot, t) {
    tulisSaya({ ...bacaSaya(), [slot]: t ? ringkas(t) : null })
  },
  sama,
}

export function useTempatSaya() {
  const [d, setD] = useState(bacaSaya)
  useEffect(() => {
    const f = () => setD(bacaSaya())
    window.addEventListener('naik-tempat-saya', f)
    window.addEventListener('storage', f)
    return () => {
      window.removeEventListener('naik-tempat-saya', f)
      window.removeEventListener('storage', f)
    }
  }, [])
  return d
}

/**
 * Daftar saran saat kolom masih kosong: Rumah, Kampus, riwayat.
 * Dipakai kolom Beranda & kolom Dari/Ke. Item = { peran, t, judul? }.
 */
export function saranAwal(saya, maksRiwayat = 5) {
  const out = []
  if (saya.rumah) out.push({ peran: 'rumah', t: saya.rumah, judul: 'Rumah' })
  if (saya.kampus) out.push({ peran: 'kampus', t: saya.kampus, judul: 'Kampus' })
  for (const r of saya.riwayat.slice(0, maksRiwayat)) out.push({ peran: 'riwayat', t: r })
  return out
}

export function usePusatPeta() {
  const map = useMap()
  const c = map.getCenter()
  return [c.lat, c.lng]
}
