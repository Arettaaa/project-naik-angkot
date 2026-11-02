import L from 'leaflet'

export const nomor = (kode) => String(kode ?? '').replace(/^Trayek\s*/i, '')

export const uniq = (arr) => [...new Set((arr ?? []).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'))

export const layarBesar = () => window.innerWidth >= 1024

export function titikTengah(f) {
  const g = f.geometry
  const c = g.type === 'MultiLineString' ? g.coordinates.flat() : g.coordinates
  if (!c?.length) return null
  const ll = c.map(([x, y]) => L.latLng(y, x))
  let total = 0
  for (let i = 1; i < ll.length; i++) total += ll[i - 1].distanceTo(ll[i])
  let acc = 0
  for (let i = 1; i < ll.length; i++) {
    const d = ll[i - 1].distanceTo(ll[i])
    if (acc + d >= total / 2) {
      const t = d ? (total / 2 - acc) / d : 0
      return L.latLng(ll[i - 1].lat + (ll[i].lat - ll[i - 1].lat) * t, ll[i - 1].lng + (ll[i].lng - ll[i - 1].lng) * t)
    }
    acc += d
  }
  return ll[0]
}

export const batas = (geojson) => L.geoJSON(geojson).getBounds()