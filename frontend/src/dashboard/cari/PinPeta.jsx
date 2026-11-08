import { useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../../api/naik'
import { Card, Floating, PrimaryButton } from '../ui'
import { IconLocate } from '../icons'
import { AKURAT_M, ambilLokasi, zoomUntuk } from './lokasi'

// Pilih titik di peta. Pin diam di tengah layar (ala ojol):
//  - geser peta, atau
//  - tarik pinnya langsung ke tempat lain, atau
//  - ketuk peta -> pin pindah ke situ.
// "Lokasi saya" memakai GPS akurasi tinggi dan menampilkan lingkaran akurasinya.
export default function PinPeta({ label, warna, awal, gps: gpsAwal = null, onBatal, onPilih }) {
  const map = useMap()
  const [geser, setGeser] = useState(false)
  const [pusat, setPusat] = useState(() => {
    const c = awal ? { lat: awal.lat, lng: awal.lng } : map.getCenter()
    return { lat: c.lat, lng: c.lng }
  })
  const [alamat, setAlamat] = useState({ kunci: '', data: null, gagal: false })
  const [gps, setGps] = useState(gpsAwal)
  const [cariGps, setCariGps] = useState(false)
  const [errGps, setErrGps] = useState('')
  const [tarik, setTarik] = useState(null) // posisi pin saat ditarik {x, y} (px dalam kontainer peta)
  const pinRef = useRef(null)
  const kunci = `${pusat.lat.toFixed(5)},${pusat.lng.toFixed(5)}`

  // mulai dari titik lama (kalau ada) dan cukup dekat supaya pin mudah ditempatkan
  const mulai = useRef(false)
  useEffect(() => {
    if (mulai.current) return
    mulai.current = true
    const z = gpsAwal ? zoomUntuk(gpsAwal.akurasi) : Math.max(map.getZoom(), 17)
    map.setView([pusat.lat, pusat.lng], z, { animate: false })
  }, [map, pusat, gpsAwal])

  // pin bisa ditarik: jangan sampai tarikan pin ikut menggeser peta
  useEffect(() => {
    if (pinRef.current) L.DomEvent.disableClickPropagation(pinRef.current)
  }, [])

  useMapEvents({
    movestart: () => setGeser(true),
    moveend: () => {
      const c = map.getCenter()
      setGeser(false)
      setPusat({ lat: c.lat, lng: c.lng })
    },
    click: (e) => map.panTo(e.latlng), // ketuk peta = pindahkan pin ke situ
  })

  // ambil alamat setelah peta berhenti digeser
  useEffect(() => {
    if (geser || tarik) return
    let batal = false
    const t = setTimeout(() => {
      api
        .alamat(pusat.lat, pusat.lng)
        .then((d) => !batal && setAlamat({ kunci, data: d, gagal: false }))
        .catch(() => !batal && setAlamat({ kunci, data: null, gagal: true }))
    }, 350)
    return () => {
      batal = true
      clearTimeout(t)
    }
  }, [kunci, geser, tarik, pusat.lat, pusat.lng])

  function lokasiSaya() {
    setErrGps('')
    setCariGps(true)
    ambilLokasi()
      .then((g) => {
        setGps(g)
        map.setView([g.lat, g.lng], zoomUntuk(g.akurasi))
      })
      .catch((e) => setErrGps(e.message))
      .finally(() => setCariGps(false))
  }

  // ---- tarik pin ----
  const posisiDi = (e) => {
    const r = map.getContainer().getBoundingClientRect()
    // jari menutupi ujung pin, jadi di layar sentuh ujung pin diangkat sedikit di atas jari
    const naik = e.pointerType === 'touch' ? 36 : 0
    return { x: e.clientX - r.left, y: e.clientY - r.top - naik }
  }
  const mulaiTarik = (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setTarik(posisiDi(e))
  }
  const saatTarik = (e) => tarik && setTarik(posisiDi(e))
  const selesaiTarik = (e) => {
    if (!tarik) return
    const p = posisiDi(e)
    setTarik(null)
    map.panTo(map.containerPointToLatLng([p.x, p.y]))
  }

  // tombol bisa dipakai begitu pin diam; alamat tidak perlu ditunggu (kalau belum ada, diisi belakangan)
  const diam = !geser && !tarik
  const siap = diam && alamat.kunci === kunci
  const nama = siap ? (alamat.data?.nama ?? 'Titik di peta') : null
  const ket = siap ? (alamat.data?.ket ?? (alamat.gagal ? 'Alamat tidak bisa dimuat — titik tetap bisa dipakai' : null)) : null
  const jauhDariGps = gps && map.distance([gps.lat, gps.lng], [pusat.lat, pusat.lng])

  return (
    <>
      {gps && (
        <>
          <Circle center={[gps.lat, gps.lng]} radius={gps.akurasi} pathOptions={{ color: '#2F80ED', weight: 1, fillColor: '#2F80ED', fillOpacity: 0.1 }} interactive={false} />
          <CircleMarker center={[gps.lat, gps.lng]} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2F80ED', fillOpacity: 1 }} interactive={false} />
        </>
      )}

      {/* pin (ujung bawah pin = titik yang dipilih). Bisa ditarik. */}
      <div
        ref={pinRef}
        onPointerDown={mulaiTarik}
        onPointerMove={saatTarik}
        onPointerUp={selesaiTarik}
        onPointerCancel={() => setTarik(null)}
        style={tarik ? { left: tarik.x, top: tarik.y } : undefined}
        className={`absolute z-[1000] -translate-x-1/2 -translate-y-full touch-none select-none ${tarik ? 'cursor-grabbing' : 'top-1/2 left-1/2 cursor-grab'}`}
        title="Tarik pin, atau geser peta"
      >
        <div className={`transition-transform duration-150 ${geser || tarik ? '-translate-y-3 scale-105' : ''}`}>
          <svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true" className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)]">
            <path d="M22 2C11 2 3 10.3 3 20.6 3 34.4 22 54 22 54s19-19.6 19-33.4C41 10.3 33 2 22 2Z" fill={warna} stroke="#fff" strokeWidth="3" />
            <circle cx="22" cy="20.5" r="7" fill="#fff" />
          </svg>
        </div>
      </div>
      <div
        style={tarik ? { left: tarik.x, top: tarik.y } : undefined}
        className={`pointer-events-none absolute z-[999] h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25 blur-[1px] transition-[width,opacity] ${tarik ? '' : 'top-1/2 left-1/2'} ${geser || tarik ? 'w-3 opacity-60' : 'w-4'}`}
      />

      <Floating className="right-3 bottom-[88px] left-3 lg:right-auto lg:bottom-5 lg:left-1/2 lg:w-[440px] lg:-translate-x-1/2">
        <Card className="px-5 pt-4 pb-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-dark/55 uppercase">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: warna }} />
              Pilih lokasi {label}
            </p>
            <button
              onClick={lokasiSaya}
              disabled={cariGps}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F4F5] px-3 py-1.5 text-[12.5px] font-semibold text-dark/70 hover:bg-mist disabled:opacity-60"
            >
              <IconLocate className={`h-3.5 w-3.5 ${cariGps ? 'animate-pulse text-[#2F80ED]' : ''}`} /> {cariGps ? 'Mencari…' : 'Lokasi saya'}
            </button>
          </div>

          <div className="mt-3 min-h-[52px]">
            {nama ? (
              <>
                <p className="font-display text-[17px] leading-snug font-bold text-tentang-dark">{nama}</p>
                {ket && <p className="mt-0.5 text-[13px] leading-snug text-dark/55">{ket}</p>}
              </>
            ) : (
              <div className="animate-pulse space-y-2 pt-1">
                <div className="h-4 w-2/3 rounded bg-[#E9EEF0]" />
                <div className="h-3 w-1/2 rounded bg-[#EEF2F3]" />
              </div>
            )}
          </div>

          {errGps ? (
            <p className="mt-2 text-[12px] text-red-700">{errGps}</p>
          ) : gps && gps.akurasi > AKURAT_M && jauhDariGps < gps.akurasi ? (
            <p className="mt-2 rounded-lg bg-[#EEF3FE] px-2.5 py-1.5 text-[12px] leading-snug text-[#1E3A8A]">
              GPS kurang tepat (±{gps.akurasi} m). Tarik pin ke posisi kamu yang sebenarnya.
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-dark/45">Tarik pin, geser peta, atau ketuk peta untuk menaruh pin tepat di lokasi.</p>
          )}

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <button onClick={onBatal} className="h-12 rounded-2xl border border-[#E3E8EA] px-5 text-[14.5px] font-semibold text-dark/70 hover:bg-[#F6F9F9]">
              Batal
            </button>
            <PrimaryButton
              disabled={!diam}
              onClick={() =>
                onPilih(
                  { lat: +pusat.lat.toFixed(6), lng: +pusat.lng.toFixed(6), nama: nama ?? 'Titik di peta', ket: siap ? (alamat.data?.ket ?? null) : null },
                  !siap || !alamat.data,
                )
              }
            >
              Pilih lokasi ini
            </PrimaryButton>
          </div>
        </Card>
      </Floating>
    </>
  )
}