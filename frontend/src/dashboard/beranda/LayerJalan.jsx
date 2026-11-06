import { GeoJSON } from 'react-leaflet'
import { kepadatanOf } from '../warna'

const lewat = (p, kode) => kode.some((k) => String(p.trayek ?? '').split(',').some((s) => s.trim() === k))

// Ruas jalan yang dilalui angkot: abu-abu (Jaringan Jalan) atau berwarna (Kepadatan).
// `fokus` = kode trayek terpilih: ruas di luar jalurnya dipudarkan. `sorot` = nama jalan yang ditebalkan.
export default function LayerJalan({ data, kepadatan, fokus = [], sorot, onPilih }) {
  if (!data) return null
  return (
    <GeoJSON
      key={`${kepadatan ? 'kepadatan' : 'jalan'}-${fokus.join('.')}-${sorot ?? ''}`}
      data={data}
      style={(f) => {
        const p = f.properties
        if (!kepadatan) return { color: '#7C8C92', weight: 2.5, opacity: 0.55, lineCap: 'round' }
        if (fokus.length && !lewat(p, fokus)) return { color: '#93A3A8', weight: 1.5, opacity: 0.3, lineCap: 'round' }
        const k = kepadatanOf(p.tingkat)
        const s = sorot && p.nama_jalan === sorot
        return { color: k.warna, weight: s ? k.tebal + 4 : fokus.length ? k.tebal + 1.5 : k.tebal, opacity: 0.95, lineCap: 'round' }
      }}
      onEachFeature={(f, layer) => layer.on('click', (e) => onPilih({ posisi: e.latlng, props: f.properties }))}
    />
  )
}
