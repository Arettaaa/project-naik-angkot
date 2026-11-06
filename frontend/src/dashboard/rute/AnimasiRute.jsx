import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, Marker, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { rupiah } from '../../utils/format'
import { nomor } from '../lib'
import { IconBus } from '../icons'

// Konversi koordinat GeoJSON (LineString / MultiLineString [lng, lat]) -> Leaflet [lat, lng]
export function ekstrakKoordinat(fitur) {
  if (!fitur?.geometry) return []
  const g = fitur.geometry
  let coords = []
  if (g.type === 'LineString') {
    coords = g.coordinates
  } else if (g.type === 'MultiLineString') {
    coords = g.coordinates.flat(1)
  }
  return coords.map(([lng, lat]) => [lat, lng])
}

// Hitung jarak Haversine (meter) antara dua titik [lat, lng]
function hitungJarakM(p1, p2) {
  const R = 6371000
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1[0] * Math.PI) / 180) * Math.cos((p2[0] * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Hitung sudut rotasi arah jalan (bearing/azimuth 0 - 360 derajat)
function hitungBearing(p1, p2) {
  const lat1 = (p1[0] * Math.PI) / 180
  const lat2 = (p2[0] * Math.PI) / 180
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Marker custom HTML titik awal (Asal)
function buatIconAwal(label) {
  return L.divIcon({
    className: 'naik-icon-awal',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer;">
        <div style="background:#10B981; color:#fff; font-size:11px; font-weight:700; padding:3px 9px; border-radius:9999px; box-shadow:0 3px 10px rgba(16,185,129,0.35); border:2px solid #fff; white-space:nowrap; display:flex; align-items:center; gap:5px;">
          <span style="display:inline-block; width:6px; height:6px; background:#fff; border-radius:9999px;"></span>
          Awal: ${label || 'Asal'}
        </div>
        <div style="width:14px; height:14px; background:#10B981; border:3px solid #fff; border-radius:9999px; box-shadow:0 2px 6px rgba(0,0,0,0.3); margin-top:2px;"></div>
      </div>
    `,
    iconSize: [0, 0],
  })
}

// Marker custom HTML titik tujuan (Tujuan)
function buatIconTujuan(label) {
  return L.divIcon({
    className: 'naik-icon-tujuan',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer;">
        <div style="background:#EF4444; color:#fff; font-size:11px; font-weight:700; padding:3px 9px; border-radius:9999px; box-shadow:0 3px 10px rgba(239,68,68,0.35); border:2px solid #fff; white-space:nowrap; display:flex; align-items:center; gap:5px;">
          <span style="display:inline-block; width:6px; height:6px; background:#fff; border-radius:9999px;"></span>
          Tujuan: ${label || 'Tujuan'}
        </div>
        <div style="width:14px; height:14px; background:#EF4444; border:3px solid #fff; border-radius:9999px; box-shadow:0 2px 6px rgba(0,0,0,0.3); margin-top:2px;"></div>
      </div>
    `,
    iconSize: [0, 0],
  })
}

// Marker icon angkot berjalan dengan aura berdenyut
function buatIconAngkot(kode, warna, rotasi) {
  return L.divIcon({
    className: 'naik-icon-angkot',
    html: `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
        <div style="position:absolute; inset:-4px; border-radius:9999px; background:${warna || '#1A936F'}; opacity:0.35; animation:naik-pulse 1.4s ease-out infinite;"></div>
        <div style="width:38px; height:38px; border-radius:9999px; background:#fff; border:3px solid ${warna || '#1A936F'}; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; transform:rotate(${rotasi}deg); transition:transform 0.15s ease;">
          <svg style="width:20px; height:20px; color:${warna || '#1A936F'};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6M15 6v6M2 12h19.6" />
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
            <circle cx="7" cy="18" r="2" />
            <path d="M9 18h5" />
            <circle cx="16" cy="18" r="2" />
          </svg>
        </div>
        <div style="position:absolute; bottom:-7px; background:#151E2C; color:#fff; font-size:10px; font-weight:800; padding:1px 6px; border-radius:6px; border:1.5px solid #fff; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.25);">
          ${kode || 'Angkot'}
        </div>
      </div>
    `,
    iconSize: [0, 0],
  })
}

export default function AnimasiRute({
  fitur,
  titikJalan,
  halte,
  titikAktif,
  simulasiAktif,
  onSelesaiSimulasi,
  onMulaiSimulasi,
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const p = fitur?.properties || {}
  const warna = p.warna || '#1A936F'
  const kodeSingkat = nomor(p.kode_trayek)

  // Ekstrak koordinat rute
  const coords = useMemo(() => ekstrakKoordinat(fitur), [fitur])

  // Hitung jarak kumulatif antar titik rute
  const { kumulatif, totalJarakM } = useMemo(() => {
    if (coords.length < 2) return { kumulatif: [0], totalJarakM: 0 }
    const dists = [0]
    let total = 0
    for (let i = 1; i < coords.length; i++) {
      const d = hitungJarakM(coords[i - 1], coords[i])
      total += d
      dists.push(total)
    }
    return { kumulatif: dists, totalJarakM: total }
  }, [coords])

  // Titik detail di jalannya: per jalan yang dilewati (nama dari backend), fallback titik berjarak teratur
  const checkpoints = useMemo(() => {
    if (coords.length < 2) return []
    if (halte?.length > 2) {
      const norm = (s) => String(s ?? '').trim().toLowerCase()
      const peta = new Map((titikJalan ?? []).map((t) => [norm(t.nama), t]))
      const posisiJarak = (m) => {
        let k = 0
        while (k < kumulatif.length - 2 && kumulatif[k + 1] < m) k++
        const seg = kumulatif[k + 1] - kumulatif[k]
        const f = seg > 0 ? (m - kumulatif[k]) / seg : 0
        return [coords[k][0] + (coords[k + 1][0] - coords[k][0]) * f, coords[k][1] + (coords[k + 1][1] - coords[k][1]) * f]
      }
      const n = halte.length
      return halte.map((nama, i) => {
        const t = peta.get(norm(nama))
        const pos = t ? [t.lat, t.lng] : posisiJarak((i / (n - 1)) * totalJarakM)
        let jarakM = Math.round((i / (n - 1)) * totalJarakM)
        if (t) {
          let best = 0
          let bestD = Infinity
          for (let k = 0; k < coords.length; k++) {
            const d = (coords[k][0] - pos[0]) ** 2 + (coords[k][1] - pos[1]) ** 2
            if (d < bestD) {
              bestD = d
              best = k
            }
          }
          jarakM = Math.round(kumulatif[best])
        }
        return {
          id: `hl-${i}`,
          idx: i,
          urutan: i + 1,
          ujung: i === 0 || i === n - 1,
          nama,
          posisi: i === 0 ? coords[0] : i === n - 1 ? coords[coords.length - 1] : pos,
          jarakM,
          estimasiMenit: Math.max(1, Math.round((jarakM / 1000) * 3)),
        }
      })
    }
    if (titikJalan?.length) {
      return titikJalan.map((t, i) => {
        const pos = [t.lat, t.lng]
        // jarak dari awal = jarak kumulatif ke titik rute terdekat
        let best = 0
        let bestD = Infinity
        for (let k = 0; k < coords.length; k++) {
          const d = (coords[k][0] - pos[0]) ** 2 + (coords[k][1] - pos[1]) ** 2
          if (d < bestD) {
            bestD = d
            best = k
          }
        }
        const jarakM = Math.round(kumulatif[best])
        return {
          id: `jl-${i}`,
          urutan: i + 1,
          nama: t.nama,
          posisi: pos,
          jarakM,
          estimasiMenit: Math.max(1, Math.round((jarakM / 1000) * 3)),
        }
      })
    }
    if (coords.length <= 4 || totalJarakM < 300) return []
    const step = Math.max(350, totalJarakM / 12)
    const list = []
    let nextTarget = step

    for (let i = 1; i < coords.length - 1; i++) {
      if (kumulatif[i] >= nextTarget && nextTarget < totalJarakM - 200) {
        list.push({
          id: `cp-${i}`,
          urutan: list.length + 1,
          nama: null,
          posisi: coords[i],
          jarakM: Math.round(kumulatif[i]),
          estimasiMenit: Math.max(1, Math.round((kumulatif[i] / 1000) * 3)),
        })
        nextTarget += step
      }
    }
    return list
  }, [coords, kumulatif, totalJarakM, titikJalan, halte])

  // Klik nama di daftar "Jalur Rute" -> terbang ke titiknya & buka popup otomatis
  const refs = useRef({})
  useEffect(() => {
    if (!titikAktif) return
    const cp = checkpoints.find((c) => c.idx === titikAktif.idx)
    if (!cp) return
    map.flyTo(cp.posisi, Math.max(map.getZoom(), 16), { duration: 0.8 })
    const t = setTimeout(() => {
      const ref = cp.ujung ? (cp.idx === 0 ? refs.current.awal : refs.current.tujuan) : refs.current[cp.id]
      ref?.openPopup()
    }, 900)
    return () => clearTimeout(t)
  }, [titikAktif, checkpoints, map])

  // State simulasi animasi perjalanan
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0 to 1
  const [speed, setSpeed] = useState(1) // 1x, 2x, 4x
  const [ikutiKamera, setIkutiKamera] = useState(true)
  const [sudahTiba, setSudahTiba] = useState(false)

  const animFrameRef = useRef(null)
  const lastTimeRef = useRef(null)
  const progressRef = useRef(0)
  const isPlayingRef = useRef(false)
  const ikutiKameraRef = useRef(true)
  const speedRef = useRef(1)

  progressRef.current = progress
  isPlayingRef.current = isPlaying
  ikutiKameraRef.current = ikutiKamera
  speedRef.current = speed

  const titikAwal = coords[0]
  const titikTujuan = coords[coords.length - 1]

  // Hitung posisi dan rotasi angkot berdasarkan progress (0..1)
  const { posisiAngkot, rotasiAngkot, indeksSegmen } = useMemo(() => {
    if (coords.length < 2) return { posisiAngkot: coords[0] || null, rotasiAngkot: 0, indeksSegmen: 0 }
    const targetM = progress * totalJarakM

    // Cari segmen garis tempat targetM berada
    let idx = 0
    while (idx < kumulatif.length - 1 && kumulatif[idx + 1] < targetM) {
      idx++
    }
    if (idx >= coords.length - 1) {
      const last = coords[coords.length - 1]
      const prev = coords[coords.length - 2]
      return { posisiAngkot: last, rotasiAngkot: hitungBearing(prev, last), indeksSegmen: coords.length - 1 }
    }

    const p1 = coords[idx]
    const p2 = coords[idx + 1]
    const segDist = kumulatif[idx + 1] - kumulatif[idx]
    const frac = segDist > 0 ? (targetM - kumulatif[idx]) / segDist : 0
    const lat = p1[0] + (p2[0] - p1[0]) * frac
    const lng = p1[1] + (p2[1] - p1[1]) * frac
    const rot = hitungBearing(p1, p2)

    return { posisiAngkot: [lat, lng], rotasiAngkot: rot, indeksSegmen: idx }
  }, [coords, kumulatif, totalJarakM, progress])

  // Jejak lintasan yang sudah dilalui angkot (highlight polyline)
  const koordinatDilalui = useMemo(() => {
    if (!posisiAngkot || coords.length < 2) return []
    const slice = coords.slice(0, indeksSegmen + 1)
    slice.push(posisiAngkot)
    return slice
  }, [coords, indeksSegmen, posisiAngkot])

  // Fungsi mulai simulasi (zoom in ke awal jalan sesuai permintaan user)
  const mulaiJalan = useCallback(() => {
    if (!titikAwal) return
    setIsPlaying(false)
    setSudahTiba(false)
    setProgress(0)
    progressRef.current = 0

    // Zoom in mendekat ke titik awal agar detail jalannya terlihat jelas
    map.flyTo(titikAwal, 16.5, {
      duration: 1.2,
      easeLinearity: 0.25,
    })

    // Mulai animasi setelah kamera zoom selesai
    const timer = setTimeout(() => {
      setIsPlaying(true)
      lastTimeRef.current = performance.now()
    }, 1300)

    return () => clearTimeout(timer)
  }, [titikAwal, map])

  // Pemicu otomatis ketika prop simulasiAktif berubah jadi true
  useEffect(() => {
    if (simulasiAktif) {
      mulaiJalan()
    } else {
      setIsPlaying(false)
      setProgress(0)
      setSudahTiba(false)
    }
  }, [simulasiAktif, mulaiJalan])

  // Loop animasi requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    // Durasi dasar simulasi dari awal ke akhir (sekitar 24 detik untuk 1x speed)
    const baseDurationMs = 24000

    const step = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time
      const delta = time - lastTimeRef.current
      lastTimeRef.current = time

      const deltaProgress = (delta / (baseDurationMs / speedRef.current))
      const nextProgress = Math.min(1, progressRef.current + deltaProgress)
      progressRef.current = nextProgress
      setProgress(nextProgress)

      // Auto-pan kamera mengikuti posisi angkot jika fitur 'ikutiKamera' aktif
      if (ikutiKameraRef.current && posisiAngkot) {
        map.panTo(posisiAngkot, { animate: false })
      }

      if (nextProgress >= 1) {
        setIsPlaying(false)
        setSudahTiba(true)
        // Zoom out setelah tiba untuk menampilkan kembali seluruh rute
        setTimeout(() => {
          if (coords.length > 0) {
            const b = L.latLngBounds(coords)
            map.flyToBounds(b, { padding: [60, 60], duration: 1.5 })
          }
        }, 1500)
      } else {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }

    lastTimeRef.current = performance.now()
    animFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying, map, coords, posisiAngkot])

  if (!titikAwal || !titikTujuan) return null

  return (
    <>
      {/* 1. Titik Awal (Asal) dengan Badge & Popup Info */}
      <Marker position={titikAwal} icon={buatIconAwal(p.asal)} ref={(m) => (refs.current.awal = m)}>
        <Popup className="naik-popup">
          <div className="w-[260px] p-4 text-left">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-xs font-bold text-white shadow-sm">
                A
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Titik Awal (Keberangkatan)</p>
                <p className="font-display text-[15px] font-bold text-dark">{p.asal}</p>
              </div>
            </div>
            <div className="mt-2.5 border-t border-slate-100 pt-2 text-[12px] text-dark/70">
              <p>Rute: <b>Trayek {kodeSingkat}</b> ({p.nama_trayek})</p>
              <p className="mt-0.5">Tujuan Akhir: {p.tujuan}</p>
            </div>
            <button
              onClick={() => {
                if (onMulaiSimulasi) onMulaiSimulasi()
                else mulaiJalan()
              }}
              className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-[12px] font-semibold text-white shadow transition hover:bg-emerald-700"
            >
              <IconBus className="h-4 w-4" /> Mulai Jalan dari Sini
            </button>
          </div>
        </Popup>
      </Marker>

      {/* 2. Titik Tujuan (Akhir) dengan Badge & Popup Info */}
      <Marker position={titikTujuan} icon={buatIconTujuan(p.tujuan)} ref={(m) => (refs.current.tujuan = m)}>
        <Popup className="naik-popup">
          <div className="w-[260px] p-4 text-left">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-xs font-bold text-white shadow-sm">
                B
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Titik Tujuan (Kedatangan)</p>
                <p className="font-display text-[15px] font-bold text-dark">{p.tujuan}</p>
              </div>
            </div>
            <div className="mt-2.5 border-t border-slate-100 pt-2 text-[12px] text-dark/70">
              <p>Total Jarak Rute: <b>{(totalJarakM / 1000).toFixed(1)} km</b></p>
              <p className="mt-0.5">Tarif Resmi: <b>{rupiah(p.tarif)}</b></p>
            </div>
          </div>
        </Popup>
      </Marker>

      {/* 3. Titik-titik detail di jalannya (Waypoints) dengan Popup & Tooltip Info */}
      {checkpoints.filter((cp) => !cp.ujung).map((cp) => (
        <CircleMarker
          ref={(m) => (refs.current[cp.id] = m)}
          key={cp.id}
          center={cp.posisi}
          radius={5.5}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: warna,
            fillOpacity: 0.95,
          }}
        >
          <Tooltip
            key={`${cp.id}-${zoom >= 13}`}
            permanent={Boolean(cp.nama) && zoom >= 13}
            direction="right"
            offset={[8, 0]}
            className="naik-tag-jalan"
          >
            <span className="text-[11px] font-semibold">
              {cp.nama ?? `Titik #${cp.urutan} • ${(cp.jarakM / 1000).toFixed(1)} km`}
            </span>
          </Tooltip>
          <Popup className="naik-popup">
            <div className="w-[250px] p-3 text-left">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: warna }}
                >
                  {cp.urutan}
                </span>
                <p className="font-display text-[14px] font-bold leading-tight text-dark">{cp.nama ?? `Titik Jalur #${cp.urutan}`}</p>
              </div>
              <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[12px] text-dark/75">
                <p>Jarak dari awal: <b>{(cp.jarakM / 1000).toFixed(2)} km</b></p>
                <p>Estimasi waktu angkot: <b>± {cp.estimasiMenit} menit</b></p>
                <p className="truncate text-dark/50">Jalur: {p.asal} → {p.tujuan}</p>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* 4. Lintasan Progress yang Menyala saat Angkot Melaju */}
      {simulasiAktif && koordinatDilalui.length > 1 && (
        <Polyline
          positions={koordinatDilalui}
          pathOptions={{
            color: '#FBBF24',
            weight: 7,
            opacity: 0.9,
            lineCap: 'round',
          }}
        />
      )}

      {/* 5. Marker Angkot Bergerak */}
      {simulasiAktif && posisiAngkot && (
        <Marker position={posisiAngkot} icon={buatIconAngkot(kodeSingkat, warna, rotasiAngkot)}>
          <Tooltip permanent direction="top" offset={[0, -26]}>
            <div className="flex items-center gap-1.5 px-0.5 font-sans text-[11px] font-bold text-dark">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500"></span>
              {sudahTiba ? 'Tiba di Tujuan!' : `Melintas: ${Math.round(progress * 100)}%`}
            </div>
          </Tooltip>
        </Marker>
      )}

      {/* 6. Floating Control Panel Simulasi Jalan (Play, Pause, Speed, Progress) */}
      {simulasiAktif && (
        <div className="fixed bottom-20 left-1/2 z-[1001] flex -translate-x-1/2 flex-col items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-[0_12px_36px_rgba(21,30,44,0.2)] backdrop-blur-md sm:bottom-6 sm:px-6">
          <div className="flex w-full items-center justify-between gap-4 text-xs font-semibold text-dark">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: warna }}
              >
                {kodeSingkat}
              </span>
              <span className="truncate max-w-[180px] sm:max-w-none">
                {sudahTiba ? '🎉 Perjalanan Selesai' : `${p.asal} → ${p.tujuan}`}
              </span>
            </div>
            <span className="font-mono text-emerald-600">
              {((progress * totalJarakM) / 1000).toFixed(1)} / {(totalJarakM / 1000).toFixed(1)} km
            </span>
          </div>

          {/* Progress Slider */}
          <div className="w-full">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setProgress(val)
                progressRef.current = val
                setSudahTiba(val >= 1)
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600"
            />
          </div>

          {/* Kontrol Tombol */}
          <div className="flex items-center justify-center gap-2">
            {/* Play / Pause / Replay */}
            {sudahTiba ? (
              <button
                onClick={mulaiJalan}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-700"
              >
                Ulangi
              </button>
            ) : isPlaying ? (
              <button
                onClick={() => setIsPlaying(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 text-xs font-semibold text-white shadow transition hover:bg-amber-600"
              >
                Jeda
              </button>
            ) : (
              <button
                onClick={() => {
                  lastTimeRef.current = performance.now()
                  setIsPlaying(true)
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-700"
              >
                Lanjutkan
              </button>
            )}

            {/* Kecepatan (1x, 2x, 4x) */}
            <button
              onClick={() => {
                const nextSpeed = speed === 1 ? 2 : speed === 2 ? 4 : 1
                setSpeed(nextSpeed)
              }}
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-dark hover:bg-slate-100"
              title="Kecepatan simulasi"
            >
              {speed}x
            </button>

            {/* Toggle Ikuti Kamera */}
            <button
              onClick={() => setIkutiKamera(!ikutiKamera)}
              className={`inline-flex h-9 items-center gap-1 rounded-xl border px-2.5 text-xs font-medium transition ${
                ikutiKamera
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
              title="Kamera otomatis mengikuti angkot"
            >
              Ikuti Kamera
            </button>

            {/* Tutup Simulasi */}
            {onSelesaiSimulasi && (
              <button
                onClick={onSelesaiSimulasi}
                className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                title="Tutup simulasi"
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

