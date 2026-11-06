import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import { api } from '../api/naik'
import { PUSAT_BOGOR } from '../data/tempat'
import { DashboardCtx } from './context'
import RailMenu from './components/RailMenu'
import KontrolPeta from './components/KontrolPeta'
import BatasKota from './components/BatasKota'
import { warnaTrayek } from './warna'
import './dashboard.css'

// Kerangka dashboard: peta layar penuh + rail ikon kiri. Panel tiap menu dirender lewat <Outlet/> di atas peta.
export default function DashboardLayout() {
  const [trayek, setTrayek] = useState({ data: null, loading: true, error: null })
  const [rute, setRute] = useState({ data: null, loading: true, error: null })
  const [kepadatan, setKepadatan] = useState({ data: null, loading: false, error: null })
  const [ulang, setUlang] = useState(0)

  // layer & filter dipakai bersama (Beranda mengatur, peta menampilkan)
  const [layers, setLayers] = useState({ jalan: true, rute: true, kepadatan: false })
  const [filter, setFilter] = useState({ kode: '', asal: '', tujuan: '' })

  useEffect(() => {
    let aktif = true
    setTrayek((s) => ({ ...s, loading: true, error: null }))
    setRute((s) => ({ ...s, loading: true, error: null }))
    api
      .trayek()
      .then((d) => aktif && setTrayek({ data: d.map((t) => ({ ...t, warna: warnaTrayek(t.kode_trayek) })), loading: false, error: null }))
      .catch((error) => aktif && setTrayek({ data: null, loading: false, error }))
    api
      .rute()
      .then((d) => {
        if (!aktif) return
        d.features.forEach((f) => (f.properties.warna = warnaTrayek(f.properties.kode_trayek)))
        setRute({ data: d, loading: false, error: null })
      })
      .catch((error) => aktif && setRute({ data: null, loading: false, error }))
    return () => {
      aktif = false
    }
  }, [ulang])

  // ruas jalan + kepadatan cukup besar (±3 MB) -> diambil sekali saat pertama kali dibutuhkan
  const butuhKepadatan = useCallback(() => {
    setKepadatan((s) => {
      if (s.data || s.loading) return s
      api
        .kepadatan()
        .then((data) => setKepadatan({ data, loading: false, error: null }))
        .catch((error) => setKepadatan({ data: null, loading: false, error }))
      return { data: null, loading: true, error: null }
    })
  }, [])

  // warna rute pilihan pengguna per trayek (disimpan di localStorage)
  const [warnaKustom, setWarnaKustomState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('naik-warna-rute') ?? '{}')
    } catch {
      return {}
    }
  })
  const setWarnaTrayek = useCallback((kode, warna) => {
    setWarnaKustomState((s) => {
      const next = { ...s }
      if (warna) next[kode] = warna
      else delete next[kode]
      try {
        localStorage.setItem('naik-warna-rute', JSON.stringify(next))
      } catch {
        /* abaikan */
      }
      return next
    })
  }, [])

  const trayekW = useMemo(
    () => (trayek.data ? { ...trayek, data: trayek.data.map((t) => ({ ...t, warna: warnaKustom[t.kode_trayek] ?? t.warna })) } : trayek),
    [trayek, warnaKustom],
  )
  const ruteW = useMemo(
    () =>
      rute.data
        ? {
            ...rute,
            data: {
              ...rute.data,
              features: rute.data.features.map((f) => ({
                ...f,
                properties: { ...f.properties, warna: warnaKustom[f.properties.kode_trayek] ?? f.properties.warna },
              })),
            },
          }
        : rute,
    [rute, warnaKustom],
  )

  const ctx = useMemo(
    () => ({
      trayek: trayekW,
      rute: ruteW,
      kepadatan,
      butuhKepadatan,
      layers,
      setLayers,
      filter,
      setFilter,
      setWarnaTrayek,
      warnaKustom,
      muatUlang: () => setUlang((x) => x + 1),
    }),
    [trayekW, ruteW, kepadatan, butuhKepadatan, layers, filter, setWarnaTrayek, warnaKustom],
  )

  return (
    <DashboardCtx.Provider value={ctx}>
      <div className="naik-dashboard h-dvh w-full bg-[#E7ECEA] font-sans text-dark">
        <MapContainer center={PUSAT_BOGOR} zoom={13} minZoom={11} zoomControl={false} preferCanvas className="h-full w-full">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
          <BatasKota />
          <RailMenu />
          <KontrolPeta />
          <Outlet />
        </MapContainer>
      </div>
    </DashboardCtx.Provider>
  )
}