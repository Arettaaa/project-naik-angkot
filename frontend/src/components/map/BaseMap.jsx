import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { PUSAT_BOGOR } from '../../data/tempat'

// Peta dasar CartoDB Voyager (gratis, tanpa API key) + data OSM.
export default function BaseMap({ children, onClick, className = '' }) {
  return (
    <MapContainer
      center={PUSAT_BOGOR}
      zoom={13}
      minZoom={11}
      preferCanvas
      zoomControl={false}
      className={`h-full w-full ${className}`}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <ZoomKanan />
      {onClick && <KlikPeta onClick={onClick} />}
      {children}
    </MapContainer>
  )
}

function ZoomKanan() {
  const map = useMap()
  useEffect(() => {
    const z = L.control.zoom({ position: 'bottomright' }).addTo(map)
    return () => z.remove()
  }, [map])
  return null
}

function KlikPeta({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) })
  return null
}

// Zoom ke data GeoJSON tiap kali `data` berubah.
export function FitToGeoJSON({ data, padding = 40 }) {
  const map = useMap()
  useEffect(() => {
    if (!data || !data.features?.length) return
    const b = L.geoJSON(data).getBounds()
    if (b.isValid()) map.fitBounds(b, { padding: [padding, padding] })
  }, [data, map, padding])
  return null
}

// Zoom ke sekumpulan titik [lat, lng].
export function FitToPoints({ points, padding = 60 }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const p = points.filter(Boolean)
    if (!p.length) return
    if (p.length === 1) map.setView(p[0], Math.max(map.getZoom(), 15))
    else map.fitBounds(L.latLngBounds(p), { padding: [padding, padding] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

// Kotak keterangan di atas peta.
export function MapCard({ position = 'bottom-left', children }) {
  const pos = {
    'bottom-left': 'bottom-4 left-4',
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
  }[position]
  return (
    <div className={`pointer-events-auto absolute z-[1000] rounded-2xl border border-border-nav bg-white/95 p-3 shadow-lg backdrop-blur ${pos}`}>
      {children}
    </div>
  )
}
