import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { nomorTampil } from './nomorWarga'

// Mesin animasi simulasi perjalanan (dipakai menu Rute & menu Cari).
// Posisi penanda, jejak, dan kamera diperbarui langsung lewat Leaflet setiap frame (requestAnimationFrame),
// tanpa render ulang React, jadi gerakannya mulus. React hanya diberi kabar ±8x per detik untuk teks/progres.

const RAD = Math.PI / 180

/** jarak meter antara [lat,lng] a dan b */
export function jarakM(a, b) {
  const dLat = (b[0] - a[0]) * RAD
  const dLng = (b[1] - a[1]) * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2
  return 12742000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** arah (derajat dari utara) dari a ke b */
export function arahDerajat(a, b) {
  const y = Math.sin((b[1] - a[1]) * RAD) * Math.cos(b[0] * RAD)
  const x = Math.cos(a[0] * RAD) * Math.sin(b[0] * RAD) - Math.sin(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.cos((b[1] - a[1]) * RAD)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

/** lintasan siap animasi: titik [lat,lng] + jarak kumulatif */
export function buatLintasan(titik) {
  const pts = []
  for (const p of titik) {
    if (!pts.length || jarakM(pts[pts.length - 1], p) > 0.3) pts.push(p)
  }
  const kum = [0]
  for (let i = 1; i < pts.length; i++) kum.push(kum[i - 1] + jarakM(pts[i - 1], pts[i]))
  return { pts, kum, total: kum[kum.length - 1] ?? 0 }
}

/** posisi pada jarak m dari awal lintasan -> { pos, i } (i = indeks titik sebelum posisi) */
export function titikPada(lin, m) {
  const { pts, kum, total } = lin
  if (pts.length < 2) return { pos: pts[0] ?? [0, 0], i: 0 }
  const d = Math.min(Math.max(m, 0), total)
  let lo = 0
  let hi = kum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (kum[mid] <= d) lo = mid
    else hi = mid
  }
  const seg = kum[hi] - kum[lo]
  const f = seg > 0 ? (d - kum[lo]) / seg : 0
  return { pos: [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f], i: lo }
}

/** arah halus: lihat sedikit ke depan supaya tidak goyang di tikungan rapat */
export function arahPada(lin, m) {
  const a = titikPada(lin, m - 6).pos
  const b = titikPada(lin, m + 22).pos
  return jarakM(a, b) < 0.5 ? null : arahDerajat(a, b)
}

/** sudut bergerak pelan ke target lewat jalur terpendek */
export function dekatiSudut(dari, ke, t) {
  if (dari == null) return ke
  const beda = ((ke - dari + 540) % 360) - 180
  return (dari + beda * t + 360) % 360
}

/** kurva gas-rem angkot: pelan di awal & akhir */
export const halus = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(t, 0), 1))

/**
 * Pengatur waktu animasi. onFrame(waktuMs, dtMs) dipanggil tiap frame selama `jalan`,
 * onSelesai() saat waktu mencapai durasiMs. Kembalikan { waktu: ref, setWaktu }.
 */
export function useJam({ durasiMs, jalan, kecepatan = 1, onFrame, onSelesai }) {
  const waktu = useRef(0)
  const cb = useRef({ durasiMs })
  useLayoutEffect(() => {
    cb.current = { onFrame, onSelesai, kecepatan, durasiMs }
  })

  useEffect(() => {
    if (!jalan) return
    let id
    let sebelum = performance.now()
    const langkah = (kini) => {
      const dt = Math.min(kini - sebelum, 64) // tab sempat tertidur -> jangan loncat jauh
      sebelum = kini
      const { durasiMs: D, kecepatan: k } = cb.current
      waktu.current = Math.min(D, waktu.current + dt * k)
      cb.current.onFrame?.(waktu.current, dt)
      if (waktu.current >= D) cb.current.onSelesai?.()
      else id = requestAnimationFrame(langkah)
    }
    id = requestAnimationFrame(langkah)
    return () => cancelAnimationFrame(id)
  }, [jalan])

  const setWaktu = useCallback((ms) => {
    waktu.current = Math.min(Math.max(ms, 0), cb.current.durasiMs)
    cb.current.onFrame?.(waktu.current, 0)
  }, [])

  return useMemo(() => ({ waktu, setWaktu }), [setWaktu])
}

/**
 * Kamera mengikuti penanda dengan lembut (bukan loncat tiap frame).
 * Diam saat peta sedang di-zoom atau digeser pengguna.
 */
export function ikutiKamera(map, pos, dt, kekakuan = 220) {
  if (!map || map._animatingZoom || map.dragging?._draggable?._moving) return
  const c = map.getCenter()
  const t = 1 - Math.exp(-dt / kekakuan)
  const lat = c.lat + (pos[0] - c.lat) * t
  const lng = c.lng + (pos[1] - c.lng) * t
  map.setView([lat, lng], map.getZoom(), { animate: false, noMoveStart: true })
}

/** klik peta tetap terbaca walau mouse/jari sedikit bergeser (bawaan Leaflet 3px). Kembalikan fungsi pemulih. */
export function aturToleransiKlik(map, px = 10) {
  const d = map?.dragging?._draggable
  if (!d) return () => {}
  const lama = d.options.clickTolerance
  d.options.clickTolerance = px
  return () => {
    d.options.clickTolerance = lama
  }
}

/** putar bagian penunjuk arah di dalam ikon penanda */
export function putarPenanda(marker, derajat) {
  const el = marker?.getElement?.()?.querySelector('.naik-arah')
  if (el && derajat != null) el.style.transform = `rotate(${derajat}deg)`
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const SVG_BUS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6M15 6v6M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>'

/** ikon angkot: badan tetap tegak, segitiga kecil di tepi lingkaran menunjuk arah jalan */
export function ikonAngkot(kode, warna = '#1A936F') {
  return L.divIcon({
    className: 'naik-penanda',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div class="naik-penanda-angkot" style="--w:${warna}">
        <span class="naik-penanda-denyut"></span>
        <span class="naik-arah"><i></i></span>
        <span class="naik-penanda-badan">${SVG_BUS}</span>
        <b>${esc(nomorTampil(kode))}</b>
      </div>`,
  })
}

/** ikon orang berjalan: titik biru + kerucut arah */
export function ikonJalan() {
  return L.divIcon({
    className: 'naik-penanda',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div class="naik-penanda-jalan">
        <span class="naik-penanda-denyut"></span>
        <span class="naik-arah"><i></i></span>
        <span class="naik-penanda-titik"></span>
      </div>`,
  })
}
