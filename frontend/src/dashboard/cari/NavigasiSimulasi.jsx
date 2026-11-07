import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { jarak, nomor } from '../../utils/format'
import { IconX } from '../icons'

// Hitung jarak Haversine (meter)
export function hitungJarakM(p1, p2) {
  const R = 6371000
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1[0] * Math.PI) / 180) * Math.cos((p2[0] * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Hitung sudut bearing/azimuth arah (0 - 360 derajat)
export function hitungBearing(p1, p2) {
  const lat1 = (p1[0] * Math.PI) / 180
  const lat2 = (p2[0] * Math.PI) / 180
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Interpolasi koordinat garis agar pergerakan halus
function interpolasiGaris(p1, p2, jumlahTitik = 8) {
  const pts = []
  for (let i = 0; i <= jumlahTitik; i++) {
    const f = i / jumlahTitik
    pts.push([p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f])
  }
  return pts
}

function hitungJarakTotal(pts) {
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    d += hitungJarakM(pts[i - 1], pts[i])
  }
  return Math.round(d)
}

// [lat,lng] dari segmen GeoJSON
function ekstrakGaris(opsi) {
  const g = (s) => (s?.coordinates ?? []).map(([x, y]) => [y, x])
  return 'kode_1' in opsi ? [g(opsi.segmen_1), g(opsi.segmen_2)] : [g(opsi.segmen)]
}

// Susun tahapan langkah & rangkaian titik navigasi
export function susunLangkahNavigasi(opsi, asal, tujuan, warna) {
  if (!opsi || !asal || !tujuan) return { langkah: [], pointsLengkap: [], totalJarakM: 0 }

  const transfer = 'kode_1' in opsi
  const [g1, g2] = ekstrakGaris(opsi)
  if (!g1 || g1.length === 0) return { langkah: [], pointsLengkap: [], totalJarakM: 0 }

  const awal = g1[0]
  const akhir = (g2 ?? g1)?.at(-1)
  const tt = transfer && opsi.titik_transfer ? [opsi.titik_transfer.coordinates[1], opsi.titik_transfer.coordinates[0]] : null

  const langkah = []

  // 1. Jalan Kaki Awal
  const ptsAwal = interpolasiGaris([asal.lat, asal.lng], awal, 10)
  const distAwal = opsi.jalan_ke_naik_m || hitungJarakTotal(ptsAwal)
  langkah.push({
    id: 'langkah-1',
    tipe: 'jalan',
    icon: '🚶',
    judul: 'Jalan Kaki ke Titik Tunggu',
    instruksi: `Jalan kaki ${jarak(distAwal)} ke titik naik Angkot ${nomor(transfer ? opsi.kode_1 : opsi.kode_trayek)}`,
    subInstruksi: `Tunggu angkot di tepi jalan / titik pemberhentian`,
    jarakM: distAwal,
    points: ptsAwal,
  })

  // 2. Naik Angkot 1
  const kode1 = transfer ? opsi.kode_1 : opsi.kode_trayek
  const warna1 = warna[kode1] || '#1A936F'
  const arah1 = transfer ? opsi.arah_1 : opsi.arah
  const distAngkot1 = transfer ? opsi.jarak_angkot_1_m : opsi.jarak_angkot_m
  langkah.push({
    id: 'langkah-2',
    tipe: 'angkot',
    kodeTrayek: kode1,
    warna: warna1,
    icon: '🚐',
    judul: `Naik Angkot ${nomor(kode1)}`,
    instruksi: `Naik Angkot ${nomor(kode1)} (arah ${arah1})`,
    subInstruksi: transfer ? `Tetap di angkot sampai titik transit` : `Tetap di angkot mendekati tujuan`,
    jarakM: distAngkot1,
    points: g1,
  })

  // 3 & 4. Jika Transfer: Transit & Naik Angkot 2
  if (transfer && g2 && g2.length > 0) {
    const ptsTransit = tt
      ? [...interpolasiGaris(g1.at(-1), tt, 6), ...interpolasiGaris(tt, g2[0], 6).slice(1)]
      : interpolasiGaris(g1.at(-1), g2[0], 8)
    const distTransit = Math.max(30, hitungJarakTotal(ptsTransit))
    langkah.push({
      id: 'langkah-3',
      tipe: 'transit',
      icon: '🔁',
      judul: 'Transit / Pindah Angkot',
      instruksi: `Turun dari Angkot ${nomor(opsi.kode_1)}, pindah ke Angkot ${nomor(opsi.kode_2)}`,
      subInstruksi: `Jalan kaki ke titik naik Angkot ${nomor(opsi.kode_2)}`,
      jarakM: distTransit,
      points: ptsTransit,
    })

    const kode2 = opsi.kode_2
    const warna2 = warna[kode2] || '#1A936F'
    const arah2 = opsi.arah_2
    const distAngkot2 = opsi.jarak_angkot_2_m
    langkah.push({
      id: 'langkah-4',
      tipe: 'angkot',
      kodeTrayek: kode2,
      warna: warna2,
      icon: '🚐',
      judul: `Naik Angkot ${nomor(kode2)}`,
      instruksi: `Naik Angkot ${nomor(kode2)} (arah ${arah2})`,
      subInstruksi: `Tetap di angkot sampai titik turun terdekat`,
      jarakM: distAngkot2,
      points: g2,
    })
  }

  // 5. Jalan Kaki Akhir ke Tujuan
  const ptsAkhir = interpolasiGaris(akhir, [tujuan.lat, tujuan.lng], 10)
  const distAkhir = opsi.jalan_dari_turun_m || hitungJarakTotal(ptsAkhir)
  langkah.push({
    id: 'langkah-akhir',
    tipe: 'jalan',
    icon: '🚶',
    judul: 'Jalan Kaki ke Tujuan',
    instruksi: `Turun dari angkot, jalan kaki ${jarak(distAkhir)} ke tujuan`,
    subInstruksi: `Tiba di ${tujuan?.nama || 'tujuan akhir'}`,
    jarakM: distAkhir,
    points: ptsAkhir,
  })

  // Bangun lintasan lengkap bersambung
  const pointsLengkap = []
  let distAccum = 0

  langkah.forEach((l, stepIdx) => {
    l.startDistM = distAccum
    l.startIndex = pointsLengkap.length

    l.points.forEach((p) => {
      if (pointsLengkap.length > 0) {
        const prev = pointsLengkap[pointsLengkap.length - 1]
        const d = hitungJarakM([prev.lat, prev.lng], p)
        distAccum += d
      }
      pointsLengkap.push({
        lat: p[0],
        lng: p[1],
        distM: distAccum,
        stepIndex: stepIdx,
      })
    })

    l.endDistM = distAccum
    l.endIndex = pointsLengkap.length - 1
  })

  const totalJarakM = distAccum
  return { langkah, pointsLengkap, totalJarakM }
}

// Icon penanda pengguna bergerak di peta
function buatIconNavigasi(tipe, rotasi, kode, warna) {
  if (tipe === 'angkot') {
    return L.divIcon({
      className: 'naik-icon-nav-angkot',
      html: `
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
          <div style="position:absolute; inset:-4px; border-radius:9999px; background:${warna || '#10B981'}; opacity:0.35; animation:naik-pulse 1.3s ease-out infinite;"></div>
          <div style="width:38px; height:38px; border-radius:9999px; background:#fff; border:3px solid ${warna || '#10B981'}; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; transform:rotate(${rotasi}deg); transition:transform 0.1s ease;">
            <svg style="width:20px; height:20px; color:${warna || '#10B981'};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
              <path d="M8 6v6M15 6v6M2 12h19.6" />
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
              <circle cx="7" cy="18" r="2" />
              <path d="M9 18h5" />
              <circle cx="16" cy="18" r="2" />
            </svg>
          </div>
          <div style="position:absolute; bottom:-7px; background:#0B3B2C; color:#fff; font-size:10px; font-weight:800; padding:1px 6px; border-radius:6px; border:1.5px solid #fff; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            ${kode ? nomor(kode) : 'Angkot'}
          </div>
        </div>
      `,
      iconSize: [0, 0],
    })
  }

  // Tipe 'jalan' atau 'transit': Google Maps blue pulsing dot with directional cone
  return L.divIcon({
    className: 'naik-icon-nav-user',
    html: `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
        <div style="position:absolute; inset:-4px; border-radius:9999px; background:#2563EB; opacity:0.35; animation:naik-pulse 1.3s ease-out infinite;"></div>
        <div style="width:28px; height:28px; border-radius:9999px; background:#fff; border:3px solid #2563EB; box-shadow:0 4px 12px rgba(37,99,235,0.4); display:flex; align-items:center; justify-content:center; transform:rotate(${rotasi}deg); transition:transform 0.1s ease;">
          <svg style="width:16px; height:16px; color:#2563EB;" viewBox="0 0 24 24" fill="currentColor">
            <path d="m3 11 19-9-9 19-2-8z" />
          </svg>
        </div>
      </div>
    `,
    iconSize: [0, 0],
  })
}

export default function NavigasiSimulasi({
  opsi,
  asal,
  tujuan,
  warna,
  onKeluar,
  activeStepIdxExternal,
  setActiveStepIdxExternal,
}) {
  const map = useMap()

  // Susun data lintasan dan langkah
  const { langkah, pointsLengkap, totalJarakM } = useMemo(
    () => susunLangkahNavigasi(opsi, asal, tujuan, warna),
    [opsi, asal, tujuan, warna],
  )

  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0) // 0 .. 1
  const [speed, setSpeed] = useState(1) // 1x, 2x, 4x
  const [ikutiKamera, setIkutiKamera] = useState(true)
  const [suaraAktif, setSuaraAktif] = useState(false)
  const [sudahTiba, setSudahTiba] = useState(false)

  // Sheet state: 'peek' (mini bottom bar yang tidak menutupi peta) vs 'expanded' (detail langkah)
  const [sheetState, setSheetState] = useState('peek')

  const animFrameRef = useRef(null)
  const lastTimeRef = useRef(null)
  const progressRef = useRef(0)
  const isPlayingRef = useRef(true)
  const ikutiKameraRef = useRef(true)
  const speedRef = useRef(1)
  const lastSpokenStepRef = useRef(-1)

  progressRef.current = progress
  isPlayingRef.current = isPlaying
  ikutiKameraRef.current = ikutiKamera
  speedRef.current = speed

  // Deteksi gesture drag user di peta -> nonaktifkan auto-pan kamera agar user bebas geser
  useMapEvents({
    dragstart: () => {
      setIkutiKamera(false)
    },
  })

  // Suara panduan via Web Speech API (opsional)
  const ucapkan = useCallback(
    (teks) => {
      if (!suaraAktif || !('speechSynthesis' in window)) return
      try {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(teks)
        u.lang = 'id-ID'
        u.rate = 1.05
        window.speechSynthesis.speak(u)
      } catch {
        /* abaikan */
      }
    },
    [suaraAktif],
  )

  // Zoom awal ke titik keberangkatan saat navigasi dimulai
  useEffect(() => {
    if (!pointsLengkap.length) return
    const awal = [pointsLengkap[0].lat, pointsLengkap[0].lng]
    map.flyTo(awal, 17, { duration: 1.2 })
    lastSpokenStepRef.current = -1
  }, [map, pointsLengkap])

  // Interpolasi posisi marker, heading bearing, dan active step saat ini
  const { posisi, rotasi, activeStep, activeStepIdx, sisaMeterStep, sisaTotalM, sisaWaktuMenit } = useMemo(() => {
    if (!pointsLengkap.length) {
      return {
        posisi: [asal?.lat || 0, asal?.lng || 0],
        rotasi: 0,
        activeStep: langkah[0] || null,
        activeStepIdx: 0,
        sisaMeterStep: 0,
        sisaTotalM: 0,
        sisaWaktuMenit: 0,
      }
    }

    const targetDist = progress * totalJarakM

    let idx = 0
    while (idx < pointsLengkap.length - 1 && pointsLengkap[idx + 1].distM < targetDist) {
      idx++
    }

    const p1 = pointsLengkap[idx]
    const p2 = pointsLengkap[Math.min(pointsLengkap.length - 1, idx + 1)]
    const segDist = p2.distM - p1.distM
    const frac = segDist > 0 ? (targetDist - p1.distM) / segDist : 0

    const lat = p1.lat + (p2.lat - p1.lat) * frac
    const lng = p1.lng + (p2.lng - p1.lng) * frac
    const rot = hitungBearing([p1.lat, p1.lng], [p2.lat, p2.lng])

    const stepIdx = p1.stepIndex
    const currentStep = langkah[stepIdx] || langkah[0]
    const sisaStep = Math.max(0, Math.round((currentStep?.endDistM ?? 0) - targetDist))
    const sisaTot = Math.max(0, Math.round(totalJarakM - targetDist))

    const sisaMenit = Math.max(1, Math.round((sisaTot / 1000) * 3.5))

    return {
      posisi: [lat, lng],
      rotasi: rot,
      activeStep: currentStep,
      activeStepIdx: stepIdx,
      sisaMeterStep: sisaStep,
      sisaTotalM: sisaTot,
      sisaWaktuMenit: sisaMenit,
    }
  }, [progress, totalJarakM, pointsLengkap, langkah, asal])

  // Sync external active step index
  useEffect(() => {
    if (setActiveStepIdxExternal) {
      setActiveStepIdxExternal(activeStepIdx)
    }
  }, [activeStepIdx, setActiveStepIdxExternal])

  // Ucapkan saat berpindah langkah
  useEffect(() => {
    if (activeStepIdx !== lastSpokenStepRef.current && activeStep) {
      lastSpokenStepRef.current = activeStepIdx
      ucapkan(activeStep.instruksi)
    }
  }, [activeStepIdx, activeStep, ucapkan])

  // Jejak yang sudah dilalui
  const jalurDilalui = useMemo(() => {
    if (!pointsLengkap.length) return []
    const targetDist = progress * totalJarakM
    let idx = 0
    while (idx < pointsLengkap.length - 1 && pointsLengkap[idx + 1].distM < targetDist) {
      idx++
    }
    const pts = pointsLengkap.slice(0, idx + 1).map((p) => [p.lat, p.lng])
    pts.push(posisi)
    return pts
  }, [pointsLengkap, progress, totalJarakM, posisi])

  // Loop animasi requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    const baseDurationMs = 28000 // 28 detik untuk perjalanan penuh pada 1x

    const step = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time
      const delta = time - lastTimeRef.current
      lastTimeRef.current = time

      const deltaProgress = delta / (baseDurationMs / speedRef.current)
      const nextProgress = Math.min(1, progressRef.current + deltaProgress)
      progressRef.current = nextProgress
      setProgress(nextProgress)

      // Pastikan posisi tracking tetap di tengah layar
      if (ikutiKameraRef.current && posisi) {
        map.panTo(posisi, { animate: false })
      }

      if (nextProgress >= 1) {
        setIsPlaying(false)
        setSudahTiba(true)
        if (pointsLengkap.length > 0) {
          setTimeout(() => {
            const b = L.latLngBounds(pointsLengkap.map((p) => [p.lat, p.lng]))
            map.flyToBounds(b, { padding: [80, 80], duration: 1.2 })
          }, 1200)
        }
      } else {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }

    lastTimeRef.current = performance.now()
    animFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying, map, pointsLengkap, posisi])

  // Estimasi jam tiba
  const jamTiba = useMemo(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + sisaWaktuMenit)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }, [sisaWaktuMenit])

  // Tombol loncat ke langkah tertentu
  const lompatKeLangkah = (idx) => {
    const l = langkah[idx]
    if (!l) return
    const newProgress = Math.min(0.999, l.startDistM / (totalJarakM || 1))
    setProgress(newProgress)
    progressRef.current = newProgress
    setIsPlaying(true)
    setSudahTiba(false)
    lastTimeRef.current = performance.now()
    setIkutiKamera(true)
    if (l.points?.[0]) map.panTo(l.points[0], { animate: true })
  }

  // Swipe gesture untuk adjust bottom sheet di HP (swipe up = expand, swipe down = peek)
  const touchStartY = useRef(0)
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY < -40) {
      setSheetState('expanded')
    } else if (deltaY > 40) {
      setSheetState('peek')
    }
  }

  const iconUser = useMemo(() => {
    return buatIconNavigasi(activeStep?.tipe || 'jalan', rotasi, activeStep?.kodeTrayek, activeStep?.warna)
  }, [activeStep, rotasi])

  return (
    <>
      {/* 1. Lintasan jejak yang sudah dilalui */}
      {jalurDilalui.length > 1 && (
        <Polyline
          positions={jalurDilalui}
          pathOptions={{ color: '#059669', weight: 8, opacity: 0.6, lineCap: 'round', lineJoin: 'round' }}
        />
      )}

      {/* 2. Marker tracking pengguna di tengah peta */}
      {posisi && <Marker position={posisi} icon={iconUser} zIndexOffset={1000} />}

      {/* 3. Top Google Maps Navigation HUD (Ringkas & pas di HP) */}
      <div className="fixed top-2.5 left-2.5 right-2.5 z-[1100] mx-auto max-w-lg lg:top-4">
        <div className="flex flex-col overflow-hidden rounded-2xl bg-[#092B21] text-white shadow-[0_12px_40px_rgba(9,43,33,0.45)] ring-1 ring-white/15 backdrop-blur-md">
          {/* Header instruksi utama */}
          <div className="flex items-center gap-2.5 p-2.5 sm:gap-3.5 sm:p-3.5 lg:p-4">
            {/* Box ikon instruksi besar */}
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-[#10B981] text-xl sm:text-2xl text-white shadow-md">
              {activeStep?.icon || '🚶'}
            </div>

            {/* Teks Instruksi & Countdown (Tidak terpotong/patah) */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-display text-base font-black tracking-tight text-white whitespace-nowrap sm:text-lg lg:text-xl">
                  {sisaMeterStep > 0 ? `${sisaMeterStep} m` : 'Sekarang'}
                </span>
                <span className="truncate text-xs font-bold text-emerald-200 sm:text-sm">
                  {activeStep?.instruksi || 'Menuju tujuan'}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-white/70 sm:text-xs">
                {activeStep?.subInstruksi || 'Ikuti jalur panduan peta'}
              </p>
            </div>

            {/* Tombol aksi cepat: Play/Pause, Kecepatan, Keluar */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
                title={isPlaying ? 'Jeda' : 'Lanjutkan'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                onClick={() => {
                  const speeds = [1, 2, 4]
                  const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length]
                  setSpeed(next)
                }}
                className="flex h-8 px-2 sm:h-9 items-center justify-center rounded-lg sm:rounded-xl bg-white/10 text-xs font-bold text-emerald-300 transition hover:bg-white/20 active:scale-95"
                title="Kecepatan simulasi"
              >
                {speed}x
              </button>
              <button
                onClick={onKeluar}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-red-500/85 text-white transition hover:bg-red-600 active:scale-95"
                title="Keluar Navigasi"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Selesai / Tiba Banner */}
          {sudahTiba && (
            <div className="flex items-center justify-between border-t border-emerald-500/30 bg-emerald-700/70 px-3.5 py-2 text-xs font-bold text-white">
              <span>🎉 Anda telah tiba di {tujuan?.nama || 'tujuan'}!</span>
              <button
                onClick={onKeluar}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-emerald-900 shadow-sm hover:bg-emerald-50"
              >
                Selesai
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Sheet UX (Bisa digeser ke atas / ke bawah, tidak menutupi tengah peta) */}
      <div
        className={`fixed left-2.5 right-2.5 z-[1100] mx-auto max-w-lg transition-all duration-300 ease-out lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-full ${
          sheetState === 'expanded' ? 'bottom-2.5' : 'bottom-2 sm:bottom-3'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_16px_48px_rgba(21,30,44,0.28)] ring-1 ring-black/8 transition-all duration-300 ${
            sheetState === 'expanded' ? 'max-h-[68vh]' : 'max-h-[145px]'
          }`}
        >
          {/* Grab handle untuk swipe / adjust tinggi */}
          <div
            onClick={() => setSheetState((s) => (s === 'peek' ? 'expanded' : 'peek'))}
            className="flex cursor-pointer flex-col items-center pt-2 pb-1 hover:bg-mist/30 transition select-none"
            title={sheetState === 'peek' ? 'Geser ke atas untuk rincian' : 'Geser ke bawah untuk memperkecil'}
          >
            <div className="h-1.5 w-12 rounded-full bg-gray-300 hover:bg-gray-400" />
          </div>

          {/* Baris Status Utama (Ringkas & Bersih) */}
          <div className="px-3.5 pb-2.5 pt-0.5 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => setSheetState((s) => (s === 'peek' ? 'expanded' : 'peek'))}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-xl font-black text-emerald-600 sm:text-2xl">
                    {sisaWaktuMenit} mnt
                  </span>
                  <span className="truncate text-xs font-bold text-dark/75">
                    {jarak(sisaTotalM)} · Tiba {jamTiba}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-dark/55">
                  {sudahTiba ? 'Perjalanan selesai' : `${activeStep?.judul || 'Menuju lokasi'} (${activeStepIdx + 1}/${langkah.length})`}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Suara */}
                <button
                  onClick={() => {
                    const s = !suaraAktif
                    setSuaraAktif(s)
                    if (s && activeStep) ucapkan(activeStep.instruksi)
                  }}
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border text-sm transition active:scale-95 ${
                    suaraAktif
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-border-nav text-dark/60 hover:bg-mist'
                  }`}
                  title={suaraAktif ? 'Suara panduan aktif' : 'Aktifkan suara panduan'}
                >
                  {suaraAktif ? '🔊' : '🔇'}
                </button>

                {/* Pusatkan Kamera ke Tracking Tengah */}
                <button
                  onClick={() => {
                    setIkutiKamera(true)
                    if (posisi) map.flyTo(posisi, Math.max(map.getZoom(), 17), { duration: 0.5 })
                  }}
                  className={`flex h-8 items-center gap-1 rounded-xl border px-2 text-xs font-bold transition active:scale-95 sm:h-9 sm:px-2.5 ${
                    ikutiKamera
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-emerald-500 bg-emerald-600 text-white shadow-sm animate-pulse'
                  }`}
                  title="Pusatkan kamera ke posisi saat ini"
                >
                  <span>🎯</span>
                  <span className="text-[11px] sm:text-xs">Pusatkan</span>
                </button>

                {/* Tombol Atur / Adjust Langkah (Naik/Turun) */}
                <button
                  onClick={() => setSheetState((s) => (s === 'peek' ? 'expanded' : 'peek'))}
                  className="flex h-8 items-center gap-1 rounded-xl bg-tentang-dark px-2.5 text-xs font-bold text-white transition hover:bg-tentang-dark/90 active:scale-95 sm:h-9 sm:px-3"
                  title="Buka / Tutup Rincian Langkah"
                >
                  <span>{sheetState === 'expanded' ? '▼' : '▲'}</span>
                  <span className="text-[11px] sm:text-xs">{sheetState === 'expanded' ? 'Perkecil' : 'Rincian'}</span>
                </button>
              </div>
            </div>

            {/* Progress Bar Interaktif */}
            <div className="relative mt-2">
              <div
                className="relative h-2 w-full cursor-pointer overflow-hidden rounded-full bg-gray-100"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickX = e.clientX - rect.left
                  const newProg = Math.max(0, Math.min(1, clickX / rect.width))
                  setProgress(newProg)
                  progressRef.current = newProg
                  setIsPlaying(true)
                  setSudahTiba(false)
                  lastTimeRef.current = performance.now()
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-100"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>

              {/* Titik Checkpoint Langkah */}
              <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1">
                {langkah.map((l) => {
                  const pct = totalJarakM > 0 ? (l.startDistM / totalJarakM) * 100 : 0
                  const isPassed = progress * 100 >= pct
                  return (
                    <span
                      key={l.id}
                      style={{ left: `${pct}%` }}
                      className={`absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white shadow-xs ${
                        isPassed ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Konten Saat Sheet Diperluas (Expanded List of Steps) */}
          {sheetState === 'expanded' && (
            <div className="naik-scroll flex-1 overflow-y-auto border-t border-[#EDF1F2] px-3.5 py-3 sm:px-5">
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="text-[11px] sm:text-xs font-bold tracking-wider text-dark/50 uppercase">
                  Tahapan Rute Perjalanan
                </h4>
                <button
                  onClick={() => setSheetState('peek')}
                  className="rounded-lg bg-mist/60 px-2 py-0.5 text-xs font-bold text-dark/70 hover:bg-mist"
                >
                  ▼ Perkecil
                </button>
              </div>

              {/* Timeline langkah-langkah di dalam sheet */}
              <div className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-[2px] before:bg-[#E3E8EA]">
                {langkah.map((l, idx) => {
                  const isCurrent = activeStepIdx === idx
                  return (
                    <div
                      key={l.id}
                      onClick={() => lompatKeLangkah(idx)}
                      className={`relative flex cursor-pointer items-start gap-3 pl-1 transition-all rounded-xl p-2 -ml-1 ${
                        isCurrent
                          ? 'bg-emerald-50/90 ring-1.5 ring-emerald-500/40 shadow-xs'
                          : 'hover:bg-mist/40'
                      }`}
                    >
                      <span
                        className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm shadow-sm ${
                          isCurrent ? 'bg-emerald-600 text-white' : 'bg-[#EAF4EE] text-dark'
                        }`}
                      >
                        {l.icon}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-dark">{l.judul}</p>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                              Sedang Berjalan
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-dark/75">{l.instruksi}</p>
                        <p className="mt-0.5 text-[11px] text-dark/50">{l.subInstruksi}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="h-5 shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
