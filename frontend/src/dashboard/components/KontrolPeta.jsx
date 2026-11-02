import { useState } from 'react'
import { CircleMarker, useMap } from 'react-leaflet'
import { Floating } from '../ui'
import { IconLocate, IconMinus, IconPlus } from '../icons'

const TOMBOL =
  'flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-dark shadow-[0_6px_20px_rgba(21,30,44,0.14)] transition hover:bg-[#F3F6F6]'

// Tombol zoom + lokasi saya (kanan bawah).
export default function KontrolPeta() {
  const map = useMap()
  const [saya, setSaya] = useState(null)

  function lokasi() {
    map.locate({ setView: true, maxZoom: 16 })
    map.once('locationfound', (e) => setSaya(e.latlng))
  }

  return (
    <>
      <Floating className="right-3 bottom-24 flex flex-col gap-2 lg:bottom-4">
        <button aria-label="Perbesar" className={TOMBOL} onClick={() => map.zoomIn()}>
          <IconPlus />
        </button>
        <button aria-label="Perkecil" className={TOMBOL} onClick={() => map.zoomOut()}>
          <IconMinus />
        </button>
        <button aria-label="Lokasi saya" className={`${TOMBOL} mt-2`} onClick={lokasi}>
          <IconLocate />
        </button>
      </Floating>
      {saya && <CircleMarker center={saya} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#38BDF8', fillOpacity: 1 }} />}
    </>
  )
}