import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import { Floating } from '../ui'
import { IconLocate, IconMinus, IconPlus } from '../icons'

const TOMBOL =
  'flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-dark shadow-[0_6px_20px_rgba(21,30,44,0.14)] transition hover:bg-[#F3F6F6]'

// Tombol zoom + lokasi saya (kanan bawah). Di HP pada Beranda, tombol lokasi ikut di atas bottom sheet.
export default function KontrolPeta() {
  const map = useMap()
  const [saya, setSaya] = useState(null)
  const { pathname } = useLocation()
  const beranda = pathname === '/peta'
  const sedangDetailRute = /^\/rute\/[^/]+/.test(pathname)
  useMapEvents({ locationfound: (e) => setSaya(e.latlng) })

  return (
    <>
      <Floating className={`right-3 bottom-24 flex-col gap-2 ${pathname === '/rute' ? 'max-lg:!bottom-[164px]' : ''} lg:bottom-20 ${sedangDetailRute ? 'lg:right-[396px]' : 'lg:right-3'} ${beranda ? 'hidden lg:flex' : 'flex'}`}>
        <button aria-label="Perbesar" className={`${TOMBOL} hidden lg:flex`} onClick={() => map.zoomIn()}>
          <IconPlus />
        </button>
        <button aria-label="Perkecil" className={`${TOMBOL} hidden lg:flex`} onClick={() => map.zoomOut()}>
          <IconMinus />
        </button>
        <button aria-label="Lokasi saya" className={`${TOMBOL} lg:mt-2`} onClick={() => map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true })}>
          <IconLocate />
        </button>
      </Floating>
      {saya && <CircleMarker center={saya} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#38BDF8', fillOpacity: 1 }} />}
    </>
  )
}
