import { GeoJSON } from 'react-leaflet'

// Garis rute angkot (warna per trayek).
export default function LayerRute({ data, tebal = 3, onPilih }) {
  if (!data) return null
  return (
    <GeoJSON
      key={`${tebal}-${data.features.map((f) => f.properties.rute_id).join('.')}`}
      data={data}
      style={(f) => ({ color: f.properties.warna, weight: tebal, opacity: 0.9 })}
      onEachFeature={(f, layer) => layer.on('click', (e) => onPilih({ posisi: e.latlng, props: f.properties }))}
    />
  )
}