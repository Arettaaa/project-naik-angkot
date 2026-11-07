import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import data from '../../data/pratinjauPeta.json'
import { warnaTrayek, KEPADATAN } from '../../dashboard/warna'
import { arahPada, buatLintasan, dekatiSudut, halus, ikonAngkot, putarPenanda, titikPada } from '../../dashboard/simulasi'

// Pratinjau peta di landing page. Data asli (disederhanakan) dan tampilan yang sama dengan dashboard NAIK,
// supaya yang dilihat pengunjung di sini persis seperti saat membuka petanya.

const ASAL = '#38BDF8'
const TUJUAN = '#FFAB2E'
const ll = (garis) => garis.map(([x, y]) => [y, x])
const km = (m) => `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`
const menit = (m) => Math.max(1, Math.round(m / 250))

const RUTE = data.rute.map((r) => ({ ...r, warna: warnaTrayek(r.kode), garisLL: r.garis.map(ll) }))
const KEP = KEPADATAN.map((k) => ({ ...k, garis: (data.kepadatan[k.key.toLowerCase()] ?? []).map(ll), km: data.km[k.key.toLowerCase()] ?? 0 }))
const CARI = { ...data.contoh_cari, garisLL: ll(data.contoh_cari.garis ?? []) }
CARI.warna = warnaTrayek(CARI.kode)

function batasSemua() {
  return L.latLngBounds(RUTE.flatMap((r) => r.garisLL.flat()))
}

function Kamera({ tab, rute }) {
  const map = useMap()
  useEffect(() => {
    // ruang untuk kartu yang menutupi peta, supaya garis tidak tertutup
    const { x: w, y: h } = map.getSize()
    const lebar = w >= 560
    const opsi = { animate: true, duration: 0.6 }
    const titikCari = L.latLngBounds([...CARI.garisLL, [CARI.asal.lat, CARI.asal.lng], [CARI.tujuan.lat, CARI.tujuan.lng]])
    if (tab === 'rute' && rute)
      map.flyToBounds(L.latLngBounds(rute.garisLL.flat()), { ...opsi, paddingTopLeft: [lebar ? w * 0.36 : 24, 70], paddingBottomRight: [24, lebar ? 24 : h * 0.42] })
    else if (tab === 'cari')
      map.flyToBounds(titikCari, { ...opsi, paddingTopLeft: [lebar ? w * 0.42 : 30, lebar ? 50 : h * 0.55], paddingBottomRight: [40, 40] })
    else if (tab === 'simulasi') map.flyToBounds(titikCari, { ...opsi, paddingTopLeft: [50, lebar ? 110 : 120], paddingBottomRight: [50, 40] })
    else map.flyToBounds(batasSemua(), { ...opsi, paddingTopLeft: [24, lebar ? 24 : 200], paddingBottomRight: [lebar ? w * 0.36 : 24, 44] })
  }, [tab, rute, map])
  return null
}

// angkot bergerak mulus di sepanjang potongan rute contoh (loop), hanya saat tab ini terlihat
function AngkotSimulasi({ onInfo }) {
  const map = useMap()
  const penanda = useRef(null)
  const lin = useMemo(() => buatLintasan(CARI.garisLL), [])
  const ikon = useMemo(() => ikonAngkot(CARI.kode, CARI.warna), [])
  const sudut = useRef(null)

  useEffect(() => {
    let id
    let t0 = performance.now()
    let tampak = true
    const io = new IntersectionObserver(([e]) => (tampak = e.isIntersecting))
    io.observe(map.getContainer())
    const DURASI = 9000
    let sebelum = t0
    let terakhirInfo = 0
    const frame = (kini) => {
      const dt = kini - sebelum
      sebelum = kini
      if (tampak) {
        const p = ((kini - t0) % (DURASI + 1200)) / DURASI
        const m = halus(Math.min(p, 1)) * lin.total
        const { pos } = titikPada(lin, m)
        const mk = penanda.current
        if (mk) {
          mk.setLatLng(pos)
          const target = arahPada(lin, m)
          if (target != null) sudut.current = dekatiSudut(sudut.current, target, 1 - Math.exp(-dt / 140))
          putarPenanda(mk, sudut.current)
        }
        if (kini - terakhirInfo > 200) {
          terakhirInfo = kini
          onInfo(Math.max(0, lin.total - m))
        }
      } else t0 += dt
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(id)
      io.disconnect()
    }
  }, [lin, map, onInfo])

  return <Marker ref={penanda} position={lin.pts[0]} icon={ikon} interactive={false} zIndexOffset={1000} />
}

function Kartu({ className = '', children }) {
  return (
    <div className={`pointer-events-auto rounded-2xl bg-white p-3.5 shadow-[0_8px_30px_rgba(21,30,44,0.16)] ring-1 ring-black/5 lg:p-[1.1cqw] ${className}`}>
      {children}
    </div>
  )
}

function Badge({ kode, warna, besar }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-display font-bold text-white ${besar ? 'h-10 w-10 rounded-xl text-[16px] lg:h-[2.8cqw] lg:w-[2.8cqw] lg:text-[1.2cqw]' : 'h-7 w-7 rounded-lg text-[12px] lg:h-[2cqw] lg:w-[2cqw] lg:text-[0.9cqw]'}`}
      style={{ backgroundColor: warna }}
    >
      {kode}
    </span>
  )
}

function InfoKepadatan() {
  const total = KEP.reduce((s, k) => s + k.km, 0)
  return (
    <Kartu className="absolute top-3 right-3 w-[min(270px,calc(100%-24px))] lg:top-[1.2cqw] lg:right-[1.2cqw] lg:w-[19cqw]">
      <p className="text-[10.5px] font-bold tracking-wide text-primary uppercase lg:text-[0.75cqw]">Informasi kepadatan</p>
      <p className="font-display text-[15px] font-bold text-tentang-dark lg:text-[1.15cqw]">Jalur angkot Kota Bogor</p>
      <p className="mt-0.5 text-[11.5px] text-dark/60 lg:text-[0.85cqw]">
        {Math.round(total)} km jalan dilewati angkot · <b className="text-dark">{Math.round((KEP[2].km / total) * 100)}%</b> padat (≥ 4 rute)
      </p>
      <div className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full">
        {KEP.map((k) => (
          <span key={k.key} style={{ width: `${(k.km / total) * 100}%`, backgroundColor: k.warna }} />
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {KEP.map((k) => (
          <div key={k.key} className="rounded-xl px-2 py-1.5" style={{ backgroundColor: k.lembut }}>
            <p className="flex items-center gap-1 text-[10.5px] font-semibold lg:text-[0.78cqw]" style={{ color: k.warna }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: k.warna }} />
              {k.key}
            </p>
            <p className="font-display text-[15px] font-bold text-dark lg:text-[1.15cqw]">{Math.round((k.km / total) * 100)}%</p>
          </div>
        ))}
      </div>
      <p className="mt-3 hidden text-[11px] font-semibold text-tentang-dark sm:block lg:text-[0.82cqw]">Jalan paling banyak dilewati</p>
      <ol className="mt-1 hidden space-y-1 sm:block">
        {data.jalan_padat.slice(0, 3).map((j, i) => (
          <li key={j.nama} className="flex items-center gap-2 text-[11.5px] lg:text-[0.85cqw]">
            <span className="w-3 text-dark/40">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-dark">{j.nama}</span>
            <span className="rounded-full bg-[#F8E3DF] px-1.5 py-px text-[10px] font-semibold text-[#C8432E] lg:text-[0.72cqw]">{j.rute} rute</span>
          </li>
        ))}
      </ol>
    </Kartu>
  )
}

function PanelRute({ rute, pilih }) {
  return (
    <>
      <Kartu className="absolute top-3 left-3 right-3 !p-2 lg:top-[1.2cqw] lg:left-[1.2cqw] lg:right-[1.2cqw] lg:!p-[0.6cqw]">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="listbox" aria-label="Pilih nomor angkot">
          {RUTE.map((r) => (
            <button
              key={r.kode}
              type="button"
              role="option"
              aria-selected={r.kode === rute.kode}
              onClick={() => pilih(r.kode)}
              className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 font-display text-[12px] font-bold transition lg:h-[2.2cqw] lg:min-w-[2.2cqw] lg:text-[0.9cqw] ${r.kode === rute.kode ? 'text-white' : 'bg-[#F1F4F5] text-dark/70 hover:bg-[#E6ECEC]'}`}
              style={r.kode === rute.kode ? { backgroundColor: r.warna } : undefined}
            >
              {r.kode}
            </button>
          ))}
        </div>
      </Kartu>
      <Kartu className="absolute bottom-3 left-3 w-[min(300px,calc(100%-24px))] lg:bottom-[1.2cqw] lg:left-[1.2cqw] lg:w-[21cqw]">
        <div className="flex items-center gap-3">
          <Badge kode={rute.kode} warna={rute.warna} besar />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold lg:text-[0.8cqw]" style={{ color: rute.warna }}>
              Rute {rute.kode}
            </p>
            <p className="truncate text-[14px] font-semibold text-dark lg:text-[1.05cqw]">
              {rute.asal} → {rute.tujuan}
            </p>
          </div>
        </div>
        <dl className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl bg-[#F4F7F7] px-2 py-1.5 text-center">
          {[
            ['Panjang', km(rute.panjang_m)],
            ['Waktu', `±${menit(rute.panjang_m)} mnt`],
            ['Tarif', 'Rp5.000'],
          ].map(([l, v]) => (
            <div key={l}>
              <dt className="text-[10.5px] text-dark/50 lg:text-[0.75cqw]">{l}</dt>
              <dd className="text-[12.5px] font-bold text-dark lg:text-[0.95cqw]">{v}</dd>
            </div>
          ))}
        </dl>
        <Link to={`/rute/${rute.kode}`} className="mt-2 inline-flex text-[12px] font-semibold text-primary hover:underline lg:text-[0.88cqw]">
          Buka detail rute →
        </Link>
      </Kartu>
    </>
  )
}

function HasilCari() {
  return (
    <Kartu className="absolute top-3 left-3 w-[min(290px,calc(100%-24px))] lg:top-[1.2cqw] lg:left-[1.2cqw] lg:w-[20cqw]">
      <div className="space-y-1.5 border-b border-[#EDF1F2] pb-2.5 text-[12.5px] lg:text-[0.92cqw]">
        <p className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASAL }} /> {CARI.asal.nama}
        </p>
        <p className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TUJUAN }} /> {CARI.tujuan.nama}
        </p>
      </div>
      <p className="mt-2.5 text-[11px] font-bold text-tentang-dark lg:text-[0.82cqw]">Langsung · 1 angkot</p>
      <div className="mt-1.5 rounded-xl border border-primary bg-primary/5 p-2.5 ring-2 ring-primary/15">
        <div className="flex items-center gap-2">
          <Badge kode={CARI.kode} warna={CARI.warna} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-dark lg:text-[0.92cqw]">{CARI.arah}</span>
          <span className="font-display text-[14px] font-bold text-dark lg:text-[1.05cqw]">{CARI.menit} mnt</span>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-dark/55 lg:text-[0.8cqw]">
          <span>jalan {CARI.jalan_m} m</span>
          <span>angkot {km(CARI.angkot_m)}</span>
          <span>Rp5.000</span>
          <span className="rounded-full bg-primary/10 px-1.5 font-bold text-primary">tercepat</span>
        </p>
      </div>
      <Link to="/cari" className="mt-2.5 inline-flex text-[12px] font-semibold text-primary hover:underline lg:text-[0.88cqw]">
        Coba cari rutemu →
      </Link>
    </Kartu>
  )
}

function HudSimulasi({ sisa }) {
  return (
    <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-center gap-3 rounded-2xl bg-[#0B3B2C] p-2.5 text-white shadow-[0_12px_36px_rgba(9,43,33,0.35)] lg:top-[1.2cqw] lg:right-auto lg:left-1/2 lg:w-[30cqw] lg:-translate-x-1/2 lg:p-[0.9cqw]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl lg:h-[2.6cqw] lg:w-[2.6cqw]" style={{ backgroundColor: CARI.warna }}>
        <svg viewBox="0 0 24 24" className="h-5 w-5 lg:h-[1.5cqw] lg:w-[1.5cqw]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 6v6M15 6v6M2 12h19.6" />
          <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
          <circle cx="7" cy="18" r="2" />
          <path d="M9 18h5" />
          <circle cx="16" cy="18" r="2" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-[15px] font-bold whitespace-nowrap tabular-nums lg:text-[1.15cqw]">{km(sisa)}</span>
          <span className="truncate text-[12px] font-semibold text-emerald-100 lg:text-[0.9cqw]">Naik angkot {CARI.kode} {CARI.arah}</span>
        </p>
        <p className="text-[11px] text-white/65 lg:text-[0.8cqw]">
          <span className="mr-1.5 rounded bg-white/15 px-1 text-[9.5px] font-bold tracking-wide uppercase lg:text-[0.7cqw]">Simulasi</span>
          Turun di dekat {CARI.tujuan.nama}
        </p>
      </div>
    </div>
  )
}

function Legenda({ tab }) {
  if (tab !== 'kepadatan') return null
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-dark/70 shadow-sm lg:bottom-[1.2cqw] lg:left-[1.2cqw] lg:text-[0.82cqw]">
      {KEP.map((k) => (
        <span key={k.key} className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full" style={{ backgroundColor: k.warna }} />
          {k.key} <span className="hidden text-dark/40 sm:inline">({k.ket})</span>
        </span>
      ))}
    </div>
  )
}

export default function PetaFitur({ activeTab }) {
  const [kode, setKode] = useState('03')
  const [sisa, setSisa] = useState(CARI.angkot_m)
  const rute = RUTE.find((r) => r.kode === kode) ?? RUTE[0]
  const onInfo = useCallback((m) => setSisa(m), [])
  const tab = activeTab

  return (
    <div className="fitur-map relative isolate h-full w-full overflow-hidden rounded-[18px] max-lg:h-[440px] lg:rounded-[1.875cqw]">
      <MapContainer
        bounds={batasSemua()}
        boundsOptions={{ padding: [28, 28] }}
        preferCanvas
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full bg-[#E8F6F8]"
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <Kamera tab={tab} rute={tab === 'rute' ? rute : null} />

        {tab === 'kepadatan' &&
          KEP.map((k) => (
            <Polyline key={k.key} positions={k.garis} pathOptions={{ color: k.warna, weight: k.tebal, opacity: 0.95, lineCap: 'round' }} interactive={false} />
          ))}

        {tab === 'rute' && (
          <>
            {RUTE.filter((r) => r.kode !== rute.kode).map((r) => (
              <Polyline
                key={r.kode}
                positions={r.garisLL}
                pathOptions={{ color: r.warna, weight: 2.5, opacity: 0.35 }}
                eventHandlers={{ click: () => setKode(r.kode) }}
              />
            ))}
            <Polyline key={`l-${rute.kode}`} positions={rute.garisLL} pathOptions={{ color: '#fff', weight: 9, opacity: 0.95 }} interactive={false} />
            <Polyline key={`d-${rute.kode}`} positions={rute.garisLL} pathOptions={{ color: rute.warna, weight: 5 }} interactive={false} />
          </>
        )}

        {(tab === 'cari' || tab === 'simulasi') && (
          <>
            <Polyline positions={CARI.garisLL} pathOptions={{ color: '#fff', weight: 10, opacity: 0.95 }} interactive={false} />
            <Polyline positions={CARI.garisLL} pathOptions={{ color: CARI.warna, weight: 6 }} interactive={false} />
            <Polyline positions={[[CARI.asal.lat, CARI.asal.lng], CARI.garisLL[0]]} pathOptions={{ color: '#4C3935', weight: 3, dashArray: '2 8' }} interactive={false} />
            <Polyline positions={[CARI.garisLL.at(-1), [CARI.tujuan.lat, CARI.tujuan.lng]]} pathOptions={{ color: '#4C3935', weight: 3, dashArray: '2 8' }} interactive={false} />
            {[
              [CARI.asal, ASAL, 'Asal'],
              [CARI.tujuan, TUJUAN, 'Tujuan'],
            ].map(([t, w, label]) => (
              <CircleMarker key={label} center={[t.lat, t.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: w, fillOpacity: 1 }}>
                <Tooltip permanent direction="top" offset={[0, -9]}>
                  {label}
                </Tooltip>
              </CircleMarker>
            ))}
            {tab === 'simulasi' && <AngkotSimulasi onInfo={onInfo} />}
          </>
        )}
      </MapContainer>

      <div key={tab} className="fitur-tab-enter pointer-events-none absolute inset-0 z-[500]">
        {tab === 'kepadatan' && <InfoKepadatan />}
        {tab === 'rute' && <PanelRute rute={rute} pilih={setKode} />}
        {tab === 'cari' && <HasilCari />}
        {tab === 'simulasi' && <HudSimulasi sisa={sisa} />}
        <Legenda tab={tab} />
      </div>
      <p className="pointer-events-none absolute right-2 bottom-1.5 z-[500] text-[9.5px] text-dark/45">© OpenStreetMap</p>
    </div>
  )
}
