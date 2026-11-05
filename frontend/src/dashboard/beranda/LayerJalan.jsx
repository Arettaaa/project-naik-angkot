import { GeoJSON } from 'react-leaflet'
import { kepadatanOf } from '../warna'

// Ruas jalan yang dilalui angkot: abu-abu (Jaringan Jalan) atau berwarna (Kepadatan Rute).
export default function LayerJalan({ data, kepadatan, onPilih }) {
  if (!data) return null
  return (
    <GeoJSON
      key={kepadatan ? 'kepadatan' : 'jalan'}
      data={data}
      style={(f) => {
        if (!kepadatan) return { color: '#7C8C92', weight: 2.5, opacity: 0.55, lineCap: 'round' }
        const k = kepadatanOf(f.properties.tingkat)
        return { color: k.warna, weight: k.tebal, opacity: 0.9, lineCap: 'round' }
      }}
      onEachFeature={(f, layer) => layer.on('click', (e) => onPilih({ posisi: e.latlng, props: f.properties }))}
    />
  )
}