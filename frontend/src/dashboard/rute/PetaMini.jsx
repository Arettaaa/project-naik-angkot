import { useEffect } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { batas } from '../lib'

// Peta kecil (tidak bisa digeser) di panel Detail Rute.
export default function PetaMini({ fitur }) {
  return (
    <div className="mt-4 h-[150px] overflow-hidden rounded-2xl border border-[#E8EDEE]">
      <MapContainer
        key={fitur.properties.rute_id}
        bounds={batas(fitur)}
        boundsOptions={{ padding: [14, 14] }}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        className="h-full w-full"
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <GeoJSON data={fitur} style={() => ({ color: fitur.properties.warna, weight: 4 })} interactive={false} />
        <Refit fitur={fitur} />
      </MapContainer>
    </div>
  )
}

function Refit({ fitur }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const b = batas(fitur)
    if (b.isValid()) map.fitBounds(b, { padding: [14, 14] })
  }, [fitur, map])
  return null
}