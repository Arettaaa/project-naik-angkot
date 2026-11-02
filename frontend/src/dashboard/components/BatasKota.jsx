import { useEffect, useState } from 'react'
import { GeoJSON } from 'react-leaflet'

// Garis batas Kota Bogor (merah putus-putus). File: public/data/batas-kota-bogor.geojson
export default function BatasKota() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch('/data/batas-kota-bogor.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])
  if (!data) return null
  return (
    <GeoJSON
      data={data}
      interactive={false}
      style={() => ({ color: '#D9433B', weight: 2.5, opacity: 0.85, dashArray: '3 7', lineCap: 'round', fill: false })}
    />
  )
}