import { useEffect, useRef, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { api } from '../../api/naik'
import { Card, Floating, PrimaryButton } from '../ui'
import { IconLocate } from '../icons'

// Pin diam di tengah layar; pengguna menggeser peta (ala ojol). Alamat titik muncul otomatis.
export default function PinPeta({ label, warna, awal, onBatal, onPilih }) {
  const map = useMap()
  const [geser, setGeser] = useState(false)
  const [pusat, setPusat] = useState(() => {
    const c = awal ? { lat: awal.lat, lng: awal.lng } : map.getCenter()
    return { lat: c.lat, lng: c.lng }
  })
  const [alamat, setAlamat] = useState({ kunci: '', data: null, gagal: false })
  const kunci = `${pusat.lat.toFixed(5)},${pusat.lng.toFixed(5)}`

  // mulai dari titik lama (kalau ada) dan cukup dekat supaya pin mudah ditempatkan
  const mulai = useRef(false)
  useEffect(() => {
    if (mulai.current) return
    mulai.current = true
    map.setView([pusat.lat, pusat.lng], Math.max(map.getZoom(), 17), { animate: false })
  }, [map, pusat])

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
    if (geser) return
    let batal = false
    const t = setTimeout(() => {
      api
        .alamat(pusat.lat, pusat.lng)
        .then((d) => !batal && setAlamat({ kunci, data: d, gagal: false }))
        .catch(() => !batal && setAlamat({ kunci, data: null, gagal: true }))
    }, 450)
    return () => {
      batal = true
      clearTimeout(t)
    }
  }, [kunci, geser, pusat.lat, pusat.lng])

  const siap = !geser && alamat.kunci === kunci
  const nama = siap ? (alamat.data?.nama ?? 'Titik di peta') : null
  const ket = siap ? (alamat.data?.ket ?? (alamat.gagal ? 'Alamat tidak bisa dimuat — titik tetap bisa dipakai' : null)) : null

  return (
    <>
      {/* pin di tengah (ujung bawah pin = titik yang dipilih) */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-full">
        <div className={`transition-transform duration-150 ${geser ? '-translate-y-3' : ''}`}>
          <svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true">
            <path d="M22 2C11 2 3 10.3 3 20.6 3 34.4 22 54 22 54s19-19.6 19-33.4C41 10.3 33 2 22 2Z" fill={warna} stroke="#fff" strokeWidth="3" />
            <circle cx="22" cy="20.5" r="7" fill="#fff" />
          </svg>
        </div>
      </div>
      <div className={`pointer-events-none absolute top-1/2 left-1/2 z-[999] h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25 blur-[1px] transition-all ${geser ? 'w-3 opacity-60' : 'w-4'}`} />

      <Floating className="right-3 bottom-[88px] left-3 lg:right-auto lg:bottom-5 lg:left-1/2 lg:w-[440px] lg:-translate-x-1/2">
        <Card className="px-5 pt-4 pb-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-dark/55 uppercase">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: warna }} />
              Pilih lokasi {label}
            </p>
            <button
              onClick={() => map.locate({ setView: true, maxZoom: 17 })}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F4F5] px-3 py-1.5 text-[12.5px] font-semibold text-dark/70 hover:bg-mist"
            >
              <IconLocate className="h-3.5 w-3.5" /> Lokasi saya
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
          <p className="mt-2 text-[12px] text-dark/45">Geser peta (atau ketuk) untuk menaruh pin tepat di lokasi.</p>

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <button onClick={onBatal} className="h-12 rounded-2xl border border-[#E3E8EA] px-5 text-[14.5px] font-semibold text-dark/70 hover:bg-[#F6F9F9]">
              Batal
            </button>
            <PrimaryButton
              disabled={!siap}
              onClick={() => onPilih({ lat: +pusat.lat.toFixed(6), lng: +pusat.lng.toFixed(6), nama: nama ?? 'Titik di peta', ket: alamat.data?.ket ?? null })}
            >
              Pilih lokasi ini
            </PrimaryButton>
          </div>
        </Card>
      </Floating>
    </>
  )
}
