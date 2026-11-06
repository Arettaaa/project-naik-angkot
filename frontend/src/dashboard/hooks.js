import { useEffect, useState } from 'react'
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

// ---------- pencarian tempat bebas ----------

const BBOX_BOGOR = '106.70,-6.70,106.90,-6.48' // minLon,minLat,maxLon,maxLat (Kota Bogor + pinggiran)
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Photon (pencarian OpenStreetMap yang memang dibuat untuk ketik-langsung-muncul), dibatasi area Bogor.
async function cariOsm(q, signal) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=${BBOX_BOGOR}&limit=8`
  const res = await fetch(url, { signal })
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
        sumber: 'osm',
      }
    })
}

// Gabungan: tempat cepat (data/tempat.js) + POI database NAIK (/api/poi) + OpenStreetMap. Duplikat nama dibuang.
export function useCariTempat(q) {
  const [state, setState] = useState({ q: '', hasil: [], loading: false })
  const k = norm(q)
  useEffect(() => {
    if (k.length < 2) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true }))
      const [poi, osm] = await Promise.all([
        api.poi(k).catch(() => []),
        cariOsm(k, ctrl.signal).catch(() => []),
      ])
      if (ctrl.signal.aborted) return
      const lokal = TEMPAT.filter((t) => norm(t.nama).includes(k)).map((t) => ({ ...t, sumber: 'naik' }))
      const db = poi.map((p) => ({ nama: p.nama, ket: p.alamat ?? p.kategori, lat: p.lat, lng: p.lng, sumber: 'naik' }))
      const lihat = new Set()
      const hasil = [...lokal, ...db, ...osm].filter((x) => {
        const n = norm(x.nama)
        if (lihat.has(n)) return false
        lihat.add(n)
        return true
      })
      setState({ q: k, hasil: hasil.slice(0, 10), loading: false })
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [k])
  if (k.length < 2) return { hasil: [], loading: false, siap: false }
  return { hasil: state.q === k ? state.hasil : [], loading: state.q !== k || state.loading, siap: state.q === k && !state.loading }
}
