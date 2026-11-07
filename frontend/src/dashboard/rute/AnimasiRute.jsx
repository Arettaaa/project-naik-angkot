import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, Marker, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { esc, jarak, menitAngkot, rupiah } from '../../utils/format'
import { nomor } from '../lib'
import { IconBus, IconCrosshair, IconPause, IconPlay, IconRotate, IconX } from '../icons'
import { Lapisan } from '../ui'
import { arahPada, buatLintasan, dekatiSudut, halus, ikonAngkot, ikutiKamera, putarPenanda, titikPada, useJam } from '../simulasi'

// Titik awal/tujuan, titik nama jalan, dan simulasi angkot berjalan di sepanjang rute terpilih.

function koordinat(fitur) {
  const g = fitur?.geometry
  if (!g) return []
  const c = g.type === 'MultiLineString' ? g.coordinates.flat(1) : g.type === 'LineString' ? g.coordinates : []
  return c.map(([lng, lat]) => [lat, lng])
}

function ikonUjung(label, warna) {
  return L.divIcon({
    className: 'naik-penanda',
    iconSize: [0, 0],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer">
        <div style="display:flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:9999px;background:#fff;color:#151E2C;font:600 11.5px/16px var(--font-sans,system-ui);white-space:nowrap;box-shadow:0 3px 12px rgba(21,30,44,.2)">
          <span style="width:8px;height:8px;border-radius:9999px;background:${warna}"></span>${esc(label)}
        </div>
        <div style="width:14px;height:14px;margin-top:3px;border-radius:9999px;background:${warna};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
      </div>`,
  })
}

const WARNA_AWAL = '#13A36F'
const WARNA_AKHIR = '#C8432E'

export default function AnimasiRute({ fitur, titikJalan, halte, titikAktif, simulasiAktif, onSelesaiSimulasi, onMulaiSimulasi }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const p = fitur?.properties || {}
  const warna = p.warna || '#1A936F'
  const kode = nomor(p.kode_trayek)

  const coords = useMemo(() => koordinat(fitur), [fitur])
  const lin = useMemo(() => buatLintasan(coords), [coords])

  // titik nama jalan (urutan dari backend); posisi jarak = titik rute terdekat
  const checkpoints = useMemo(() => {
    if (lin.pts.length < 2) return []
    const jarakDari = (pos) => {
      let best = 0
      let bestD = Infinity
      lin.pts.forEach((c, k) => {
        const d = (c[0] - pos[0]) ** 2 + (c[1] - pos[1]) ** 2
        if (d < bestD) {
          bestD = d
          best = k
        }
      })
      return Math.round(lin.kum[best])
    }
    if (halte?.length > 2) {
      const norm = (s) => String(s ?? '').trim().toLowerCase()
      const peta = new Map((titikJalan ?? []).map((t) => [norm(t.nama), t]))
      const n = halte.length
      return halte.map((nama, i) => {
        const t = peta.get(norm(nama))
        const ujung = i === 0 || i === n - 1
        const pos = i === 0 ? lin.pts[0] : i === n - 1 ? lin.pts.at(-1) : t ? [t.lat, t.lng] : titikPada(lin, (i / (n - 1)) * lin.total).pos
        const jarakM = i === 0 ? 0 : i === n - 1 ? Math.round(lin.total) : t ? jarakDari(pos) : Math.round((i / (n - 1)) * lin.total)
        return { id: `hl-${i}`, idx: i, urutan: i + 1, ujung, nama, posisi: pos, jarakM }
      })
    }
    return (titikJalan ?? []).map((t, i) => ({ id: `jl-${i}`, idx: i, urutan: i + 1, nama: t.nama, posisi: [t.lat, t.lng], jarakM: jarakDari([t.lat, t.lng]) }))
  }, [lin, titikJalan, halte])

  // klik nama di daftar "Jalur Rute" -> terbang ke titiknya & buka popup
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

  if (lin.pts.length < 2) return null
  return (
    <>
      <Marker position={lin.pts[0]} icon={ikonUjung(p.asal || 'Awal', WARNA_AWAL)} ref={(m) => (refs.current.awal = m)}>
        <Popup className="naik-popup">
          <div className="w-[248px] p-4">
            <p className="text-[11px] font-semibold tracking-wide text-[#0E7C5A] uppercase">Titik awal</p>
            <p className="font-display text-[15px] font-bold text-dark">{p.asal}</p>
            <p className="mt-1 text-[12px] text-dark/60">
              Angkot {kode} menuju {p.tujuan}
            </p>
            {onMulaiSimulasi && (
              <button
                onClick={onMulaiSimulasi}
                className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold text-white hover:brightness-95"
                style={{ backgroundColor: warna }}
              >
                <IconPlay className="h-3.5 w-3.5" /> Simulasikan dari sini
              </button>
            )}
          </div>
        </Popup>
      </Marker>
      <Marker position={lin.pts.at(-1)} icon={ikonUjung(p.tujuan || 'Tujuan', WARNA_AKHIR)} ref={(m) => (refs.current.tujuan = m)}>
        <Popup className="naik-popup">
          <div className="w-[248px] p-4">
            <p className="text-[11px] font-semibold tracking-wide text-[#B23A27] uppercase">Titik akhir</p>
            <p className="font-display text-[15px] font-bold text-dark">{p.tujuan}</p>
            <p className="mt-1 text-[12px] text-dark/60">
              {jarak(lin.total)} dari {p.asal} · ±{menitAngkot(lin.total)} mnt · {rupiah(p.tarif)}
            </p>
          </div>
        </Popup>
      </Marker>

      {checkpoints
        .filter((cp) => !cp.ujung)
        .map((cp) => (
          <CircleMarker
            ref={(m) => (refs.current[cp.id] = m)}
            key={cp.id}
            center={cp.posisi}
            radius={5}
            pathOptions={{ color: '#fff', weight: 2, fillColor: warna, fillOpacity: 1 }}
          >
            {/* label nama jalan permanen hanya saat cukup dekat, supaya peta tidak penuh tulisan */}
            <Tooltip key={`${cp.id}-${zoom >= 15}`} permanent={zoom >= 15} direction="right" offset={[8, 0]} className="naik-tag-jalan">
              <span className="text-[11px] font-semibold">{cp.nama}</span>
            </Tooltip>
            <Popup className="naik-popup">
              <div className="w-[230px] p-3.5">
                <p className="font-display text-[14px] leading-tight font-bold text-dark">{cp.nama}</p>
                <p className="mt-1 text-[12px] text-dark/60">
                  {jarak(cp.jarakM)} dari {p.asal} · ±{menitAngkot(cp.jarakM)} mnt naik angkot {kode}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

      {simulasiAktif && <SimulasiAngkot lin={lin} kode={kode} warna={warna} p={p} onTutup={onSelesaiSimulasi} />}
    </>
  )
}

// Angkot berjalan dari awal ke akhir rute. Lama animasi sebanding panjang rute (15–40 detik pada 1×).
function SimulasiAngkot({ lin, kode, warna, p, onTutup }) {
  const map = useMap()
  const durasiMs = useMemo(() => Math.min(Math.max(menitAngkot(lin.total) * 1000, 15000), 40000), [lin])
  const [jalan, setJalan] = useState(false)
  const [kecepatan, setKecepatan] = useState(1)
  const [ikuti, setIkuti] = useState(true)
  const [tiba, setTiba] = useState(false)
  const [info, setInfo] = useState({ waktu: 0, m: 0 })

  const penanda = useRef(null)
  const jejak = useRef(null)
  const sudut = useRef(null)
  const jejakTitik = useRef({ i: -1, arr: [] })
  const uiTerakhir = useRef(0)
  const ikutiRef = useRef(true)
  useEffect(() => {
    ikutiRef.current = ikuti
  }, [ikuti])

  const ikon = useMemo(() => ikonAngkot(kode, warna), [kode, warna])
  const kosong = useMemo(() => [], [])
  useMapEvents({ dragstart: () => setIkuti(false) })

  const gambar = useCallback(
    (waktu, dt) => {
      const m = halus(waktu / durasiMs) * lin.total
      const { pos, i } = titikPada(lin, m)
      const mk = penanda.current
      if (mk) {
        mk.setLatLng(pos)
        const target = arahPada(lin, m)
        if (target != null) sudut.current = dt ? dekatiSudut(sudut.current, target, 1 - Math.exp(-dt / 140)) : target
        putarPenanda(mk, sudut.current)
      }
      const s = jejakTitik.current
      if (s.i !== i) s.arr = lin.pts.slice(0, i + 1).concat([pos])
      else s.arr[s.arr.length - 1] = pos
      s.i = i
      jejak.current?.setLatLngs(s.arr)
      if (ikutiRef.current && dt) ikutiKamera(map, pos, dt)
      const kini = performance.now()
      if (!dt || kini - uiTerakhir.current > 120) {
        uiTerakhir.current = kini
        setInfo({ waktu, m })
      }
    },
    [lin, durasiMs, map],
  )

  const jam = useJam({
    durasiMs,
    jalan,
    kecepatan,
    onFrame: gambar,
    onSelesai: () => {
      setJalan(false)
      setTiba(true)
      setInfo({ waktu: durasiMs, m: lin.total })
      setTimeout(() => map.flyToBounds(L.latLngBounds(lin.pts), { padding: [60, 60], duration: 1 }), 700)
    },
  })

  // mulai: kamera ke titik awal dulu, baru angkot bergerak
  const mulai = useCallback(() => {
    jam.setWaktu(0)
    setTiba(false)
    setIkuti(true)
    setJalan(false)
    map.flyTo(lin.pts[0], Math.max(map.getZoom(), 16), { duration: 0.9 })
    return setTimeout(() => setJalan(true), 950)
  }, [jam, map, lin])

  useEffect(() => {
    const t = mulai()
    return () => clearTimeout(t)
  }, [mulai])

  const persen = (info.waktu / durasiMs) * 100

  return (
    <>
      <Polyline ref={jejak} positions={kosong} pathOptions={{ color: '#151E2C', weight: 7, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
      <Marker ref={penanda} position={lin.pts[0]} icon={ikon} zIndexOffset={1000} interactive={false} />

      <Lapisan className="fixed bottom-24 left-1/2 z-[1001] w-[min(440px,calc(100%-24px))] -translate-x-1/2 rounded-2xl bg-white p-3.5 shadow-[0_12px_36px_rgba(21,30,44,0.22)] ring-1 ring-black/5 lg:bottom-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: warna }}>
            <IconBus className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-dark">{tiba ? `Sampai di ${p.tujuan}` : `${p.asal} → ${p.tujuan}`}</p>
            <p className="text-[11.5px] text-dark/55">
              <span className="mr-1.5 rounded bg-[#EEF3F3] px-1.5 py-px text-[10px] font-bold tracking-wide text-dark/60 uppercase">Simulasi</span>
              {jarak(info.m)} / {jarak(lin.total)} · sisa ±{menitAngkot(Math.max(0, lin.total - info.m))} mnt
            </p>
          </div>
          <TombolKecil onClick={onTutup} label="Tutup simulasi">
            <IconX className="h-4 w-4" />
          </TombolKecil>
        </div>

        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round(persen * 10)}
          onChange={(e) => {
            jam.setWaktu((Number(e.target.value) / 1000) * durasiMs)
            setTiba(false)
          }}
          aria-label="Posisi simulasi"
          className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full"
          style={{ background: `linear-gradient(to right, ${warna} ${persen}%, #E5EBEB ${persen}%)`, accentColor: warna }}
        />

        <div className="mt-2.5 flex items-center gap-1.5">
          {tiba ? (
            <button onClick={mulai} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#178563]">
              <IconRotate className="h-4 w-4" /> Ulangi
            </button>
          ) : (
            <button
              onClick={() => setJalan((j) => !j)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#178563]"
            >
              {jalan ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />} {jalan ? 'Jeda' : 'Lanjut'}
            </button>
          )}
          <button
            onClick={() => setKecepatan((k) => (k === 1 ? 2 : k === 2 ? 4 : 1))}
            className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-[#E3E8EA] px-2.5 text-[12.5px] font-bold text-dark/75 hover:bg-[#F4F7F7]"
            title="Kecepatan simulasi"
          >
            {kecepatan}×
          </button>
          <button
            onClick={() => {
              setIkuti(true)
              map.panTo(titikPada(lin, info.m).pos)
            }}
            aria-pressed={ikuti}
            className={`ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] font-semibold transition ${ikuti ? 'border-primary/40 bg-primary/8 text-primary' : 'border-[#E3E8EA] text-dark/60 hover:bg-[#F4F7F7]'}`}
          >
            <IconCrosshair className="h-4 w-4" /> Ikuti angkot
          </button>
        </div>
      </Lapisan>
    </>
  )
}

function TombolKecil({ onClick, label, children }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dark/50 hover:bg-[#F1F4F5]">
      {children}
    </button>
  )
}
