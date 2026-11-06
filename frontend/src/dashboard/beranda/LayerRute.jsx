import { GeoJSON } from 'react-leaflet'
import AnimasiRute from '../rute/AnimasiRute'

// Garis rute angkot (warna per trayek) + titik awal/tujuan jika rute tunggal difilter.
export default function LayerRute({ data, tebal = 3, onPilih }) {
  if (!data) return null
  const single = data.features.length === 1 ? data.features[0] : null
  return (
    <>
      <GeoJSON
        key={`${tebal}-${data.features.map((f) => `${f.properties.rute_id}${f.properties.warna}`).join('.')}`}
        data={data}
        style={(f) => ({ color: f.properties.warna, weight: tebal, opacity: 0.9 })}
        onEachFeature={(f, layer) => layer.on('click', (e) => onPilih({ posisi: e.latlng, props: f.properties }))}
      />
      {single && <AnimasiRute fitur={single} />}
    </>
  )
}
