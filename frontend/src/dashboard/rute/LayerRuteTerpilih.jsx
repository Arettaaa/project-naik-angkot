import { GeoJSON } from 'react-leaflet'

// Garis rute di menu Rute: semua rute (belum memilih) atau rute terpilih + arah sebaliknya (putus-putus).
export default function LayerRuteTerpilih({ semua, dipilih, lainnya, onKlik }) {
  if (!dipilih)
    return semua ? (
      <GeoJSON
        data={semua}
        style={(f) => ({ color: f.properties.warna, weight: 3, opacity: 0.75 })}
        onEachFeature={(f, layer) => layer.on('click', (e) => onKlik(e.latlng, f.properties))}
      />
    ) : null

  const id = dipilih.properties.rute_id
  return (
    <>
      {lainnya.length > 0 && (
        <GeoJSON
          key={`lain-${id}`}
          data={{ type: 'FeatureCollection', features: lainnya }}
          style={(f) => ({ color: f.properties.warna, weight: 3, opacity: 0.45, dashArray: '6 8' })}
          interactive={false}
        />
      )}
      <GeoJSON key={`w-${id}`} data={dipilih} style={() => ({ color: '#fff', weight: 10, opacity: 0.95 })} interactive={false} />
      <GeoJSON
        key={`d-${id}`}
        data={dipilih}
        style={() => ({ color: dipilih.properties.warna, weight: 5.5 })}
        eventHandlers={{ click: (e) => onKlik(e.latlng, dipilih.properties) }}
      />
    </>
  )
}