import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { jarak, menitAngkot, menitJalan, nomor } from '../../utils/format'
import {
  IconBus, IconChevronDown, IconChevronUp, IconCrosshair, IconFlag, IconPause, IconPlay, IconRotate,
  IconTransfer, IconVolume, IconVolumeOff, IconWalk, IconX,
} from '../icons'
import { Lapisan } from '../ui'
import { nomorLengkap, nomorTampil } from '../nomorWarga'
import { normalOpsi } from './opsi'
import { arahPada, dekatiSudut, halus, ikonAngkot, ikonJalan, ikutiKamera, jarakM, putarPenanda, titikPada, useJam } from '../simulasi'

// Simulasi perjalanan (animasi, BUKAN pelacakan posisi asli): jalan kaki -> naik angkot -> (pindah) -> jalan kaki.
// Lama tiap tahap sebanding perkiraan waktu nyatanya, dipadatkan jadi ±15–45 detik.

const TUNGGU_MS = 1300 // jeda "menunggu angkot" sebelum angkot bergerak
const IKON_TAHAP = { jalan: IconWalk, angkot: IconBus, transit: IconTransfer, tiba: IconFlag }

/** tahapan + lintasan gabungan + pembagian waktu animasi */
function susunLangkahNavigasi(opsi, asal, tujuan, warna) {
  const kosong = { langkah: [], lin: { pts: [], kum: [0], total: 0 }, durasiMs: 1 }
  if (!opsi || !asal || !tujuan) return kosong
  const n = normalOpsi(opsi)
  if (!n.legs[0]?.garis.length || n.legs.some((l) => !l.garis.length)) return kosong
  const A = [asal.lat, asal.lng]
  const B = [tujuan.lat, tujuan.lng]

  const tahap = [
    {
      tipe: 'jalan', titik: [A, n.legs[0].garis[0]], jarakM: n.jalanKeNaik,
      judul: 'Jalan ke titik naik', instruksi: `Jalan ke jalur angkot ${nomorTampil(n.kode[0])}`,
      sub: 'Tunggu angkot di tepi jalan',
    },
  ]
  n.legs.forEach((l, i) => {
    if (i > 0) {
      const sebelum = n.legs[i - 1].garis.at(-1)
      const tt = n.pindah[i - 1]?.titik
      tahap.push({
        tipe: 'transit', titik: tt ? [sebelum, tt, l.garis[0]] : [sebelum, l.garis[0]], jarakM: n.pindah[i - 1]?.jalanM,
        judul: 'Pindah angkot', instruksi: `Turun, pindah ke angkot ${nomorTampil(l.kode)}`, sub: 'Jalan sebentar ke jalur angkot berikutnya',
      })
    }
    const terakhir = i === n.legs.length - 1
    tahap.push({
      tipe: 'angkot', titik: l.garis, kode: l.kode, warna: warna[l.kode], jarakM: l.jarakM,
      judul: `Naik angkot ${nomorLengkap(l.kode)}`, instruksi: `Naik angkot ${nomorLengkap(l.kode)} arah ${l.arah}`,
      sub: terakhir ? 'Turun di dekat tujuan' : `Turun di titik pindah ke ${nomorTampil(n.kode[i + 1])}`,
    })
  })
  tahap.push({
    tipe: 'jalan', titik: [n.legs.at(-1).garis.at(-1), B], jarakM: n.jalanDariTurun,
    judul: 'Jalan ke tujuan', instruksi: `Jalan ke ${tujuan.nama || 'tujuan'}`, sub: 'Hampir sampai',
  })

  // lintasan gabungan + batas jarak tiap tahap
  const pts = []
  const kum = []
  for (const t of tahap) {
    t.mulaiM = kum.length ? kum[kum.length - 1] : 0
    for (const p of t.titik) {
      if (!pts.length) {
        pts.push(p)
        kum.push(0)
        continue
      }
      const d = jarakM(pts[pts.length - 1], p)
      if (d < 0.3) continue
      pts.push(p)
      kum.push(kum[kum.length - 1] + d)
    }
    t.akhirM = kum[kum.length - 1]
    const m = t.jarakM ?? t.akhirM - t.mulaiM
    t.jarakM = Math.round(m)
    t.menit = t.tipe === 'angkot' ? m / 250 : m / 75
  }

  // waktu animasi: sebanding waktu nyata, total 15–45 detik
  const menitTotal = tahap.reduce((s, t) => s + t.menit, 0) || 1
  const msPerMenit = Math.min(Math.max(menitTotal * 1500, 15000), 45000) / menitTotal
  let ms = 0
  tahap.forEach((t, i) => {
    t.id = `tahap-${i}`
    t.mulaiMs = ms
    ms += Math.max(1000, t.menit * msPerMenit) + (t.tipe === 'angkot' ? TUNGGU_MS : 0)
    t.akhirMs = ms
    delete t.titik
  })
  return { langkah: tahap, lin: { pts, kum, total: kum[kum.length - 1] ?? 0 }, durasiMs: ms }
}

/** waktu animasi -> { idx tahap, jarak di lintasan, sedang menunggu?, sisa menit nyata } */
function keadaanPada(langkah, waktu) {
  let i = langkah.findIndex((t) => waktu < t.akhirMs)
  if (i < 0) i = langkah.length - 1
  const t = langkah[i]
  const tunggu = t.tipe === 'angkot' ? TUNGGU_MS : 0
  const lokal = Math.max(0, waktu - t.mulaiMs - tunggu) / Math.max(1, t.akhirMs - t.mulaiMs - tunggu)
  const f = t.tipe === 'angkot' ? halus(lokal) : Math.min(lokal, 1)
  const sisaMenit = langkah.slice(i + 1).reduce((s, x) => s + x.menit, 0) + t.menit * (1 - f)
  return { i, m: t.mulaiM + (t.akhirM - t.mulaiM) * f, menunggu: tunggu > 0 && waktu - t.mulaiMs < tunggu, f, sisaMenit }
}

export default function NavigasiSimulasi({ opsi, asal, tujuan, warna, onKeluar, setActiveStepIdxExternal }) {
  const map = useMap()
  const { langkah, lin, durasiMs } = useMemo(() => susunLangkahNavigasi(opsi, asal, tujuan, warna), [opsi, asal, tujuan, warna])

  const [jalan, setJalan] = useState(false)
  const [kecepatan, setKecepatan] = useState(1)
  const [ikuti, setIkuti] = useState(true)
  const [suara, setSuara] = useState(false)
  const [tiba, setTiba] = useState(false)
  const [lebar, setLebar] = useState(false) // panel bawah diperluas
  const [ui, setUi] = useState(() => ({ waktu: 0, ...keadaanPada(langkah, 0) }))

  const penanda = useRef(null)
  const jejak = useRef(null)
  const sudut = useRef(null)
  const ikonAktif = useRef(null)
  const jejakTitik = useRef({ i: -1, arr: [] })
  const uiTerakhir = useRef(0)
  const ikutiRef = useRef(true)
  useEffect(() => {
    ikutiRef.current = ikuti
  }, [ikuti])

  const ikon = useMemo(() => langkah.map((t) => (t.tipe === 'angkot' ? ikonAngkot(nomor(t.kode), t.warna) : ikonJalan())), [langkah])
  const posAwal = useMemo(() => lin.pts[0] ?? [asal.lat, asal.lng], [lin, asal])
  const jejakKosong = useMemo(() => [], [])

  useMapEvents({ dragstart: () => setIkuti(false) })

  const ucapkan = useCallback(
    (teks) => {
      if (!suara || !('speechSynthesis' in window)) return
      try {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(teks)
        u.lang = 'id-ID'
        window.speechSynthesis.speak(u)
      } catch {
        /* abaikan */
      }
    },
    [suara],
  )

  // gambar satu frame: posisi, arah, ikon tahap, jejak, kamera; teks UI diperbarui ±8x/detik
  const gambar = useCallback(
    (waktu, dt) => {
      if (!lin.pts.length) return
      const k = keadaanPada(langkah, waktu)
      const { pos, i } = titikPada(lin, k.m)
      const m = penanda.current
      if (m) {
        if (ikonAktif.current !== k.i) {
          ikonAktif.current = k.i
          m.setIcon(ikon[k.i])
        }
        m.setLatLng(pos)
        const target = arahPada(lin, k.m)
        if (target != null) sudut.current = dt ? dekatiSudut(sudut.current, target, 1 - Math.exp(-dt / 140)) : target
        putarPenanda(m, sudut.current)
      }
      const j = jejak.current
      if (j) {
        const s = jejakTitik.current
        if (s.i !== i) s.arr = lin.pts.slice(0, i + 1).concat([pos])
        else s.arr[s.arr.length - 1] = pos
        s.i = i
        j.setLatLngs(s.arr)
      }
      if (ikutiRef.current && dt) ikutiKamera(map, pos, dt)
      const kini = performance.now()
      if (!dt || kini - uiTerakhir.current > 120) {
        uiTerakhir.current = kini
        setUi({ waktu, ...k })
      }
    },
    [langkah, lin, ikon, map],
  )

  const jam = useJam({
    durasiMs,
    jalan,
    kecepatan,
    onFrame: gambar,
    onSelesai: () => {
      setJalan(false)
      setTiba(true)
      setUi((u) => ({ ...u, waktu: durasiMs, ...keadaanPada(langkah, durasiMs) }))
      setTimeout(() => map.flyToBounds(L.latLngBounds(lin.pts), { padding: [80, 80], duration: 1 }), 700)
    },
  })

  // mulai: terbang ke titik awal dulu, baru jalan (supaya animasi kamera tidak bentrok)
  useEffect(() => {
    if (!lin.pts.length) return
    jam.setWaktu(0)
    setTiba(false)
    map.flyTo(lin.pts[0], Math.max(map.getZoom(), 17), { duration: 0.9 })
    const t = setTimeout(() => setJalan(true), 950)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lin])

  useEffect(() => {
    setActiveStepIdxExternal?.(ui.i)
    if (langkah[ui.i]) ucapkan(langkah[ui.i].instruksi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.i])

  function lompat(ms) {
    jam.setWaktu(ms)
    setTiba(false)
    setIkuti(true)
    setJalan(true)
  }

  const aktif = langkah[ui.i]
  const IkonAktif = tiba ? IconFlag : IKON_TAHAP[aktif?.tipe] ?? IconWalk
  const sisaTahapM = aktif ? Math.max(0, Math.round(aktif.akhirM - ui.m)) : 0
  const sisaMenit = Math.max(tiba ? 0 : 1, Math.round(ui.sisaMenit))
  const sisaM = Math.max(0, lin.total - ui.m)
  const persen = Math.min(100, (ui.waktu / durasiMs) * 100)
  const jamTiba = useMemo(() => {
    const d = new Date(Date.now() + sisaMenit * 60000)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }, [sisaMenit])

  const judulAtas = tiba
    ? `Sampai di ${tujuan?.nama || 'tujuan'}`
    : ui.menunggu
      ? `Tunggu angkot ${nomorLengkap(aktif?.kode)}`
      : aktif?.instruksi

  return (
    <>
      <Polyline ref={jejak} positions={jejakKosong} pathOptions={{ color: '#0E7C5A', weight: 7, opacity: 0.55, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
      <Marker ref={penanda} position={posAwal} icon={ikon[0] ?? ikonJalan()} zIndexOffset={1000} interactive={false} />

      {/* instruksi atas */}
      <Lapisan className="fixed top-2.5 right-2.5 left-2.5 z-[1100] mx-auto max-w-lg lg:top-4">
        <div className="flex items-center gap-3 rounded-2xl bg-[#0B3B2C] p-3 text-white shadow-[0_12px_36px_rgba(9,43,33,0.4)] sm:p-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: aktif?.tipe === 'angkot' && !tiba ? aktif.warna : '#13A36F' }}
          >
            <IkonAktif className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              {!tiba && !ui.menunggu && (
                <span className="font-display text-[17px] font-bold whitespace-nowrap">{jarak(sisaTahapM)}</span>
              )}
              <span className="truncate text-[13px] font-semibold text-emerald-100">{judulAtas}</span>
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-white/65">
              <span className="mr-1.5 rounded bg-white/15 px-1.5 py-px text-[10px] font-bold tracking-wide uppercase">Simulasi</span>
              {tiba ? 'Perjalanan selesai' : ui.menunggu ? 'Angkot datang sebentar lagi' : aktif?.sub}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {tiba ? (
              <TombolGelap onClick={() => lompat(0)} label="Ulangi simulasi">
                <IconRotate className="h-4 w-4" />
              </TombolGelap>
            ) : (
              <TombolGelap onClick={() => setJalan((j) => !j)} label={jalan ? 'Jeda' : 'Lanjutkan'}>
                {jalan ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
              </TombolGelap>
            )}
            <TombolGelap onClick={() => setKecepatan((k) => (k === 1 ? 2 : k === 2 ? 4 : 1))} label="Kecepatan simulasi">
              <span className="text-[12px] font-bold text-emerald-200">{kecepatan}×</span>
            </TombolGelap>
            <TombolGelap onClick={onKeluar} label="Keluar simulasi" merah>
              <IconX className="h-4 w-4" />
            </TombolGelap>
          </div>
        </div>
      </Lapisan>

      {/* panel bawah: ringkasan, progres, tahapan */}
      <Lapisan className="fixed right-2.5 bottom-2.5 left-2.5 z-[1100] mx-auto max-w-lg lg:bottom-4">
        <div className={`flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_16px_48px_rgba(21,30,44,0.26)] ring-1 ring-black/5 ${lebar ? 'max-h-[64vh]' : ''}`}>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setLebar((l) => !l)} className="min-w-0 flex-1 text-left">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-[22px] font-bold text-primary">{tiba ? 'Tiba' : `${sisaMenit} mnt`}</span>
                  <span className="truncate text-[12.5px] font-semibold text-dark/65">
                    {tiba ? tujuan?.nama : `${jarak(sisaM)} · tiba ±${jamTiba}`}
                  </span>
                </p>
                <p className="truncate text-[11.5px] text-dark/50">
                  Tahap {Math.min(ui.i + 1, langkah.length)} dari {langkah.length} · {aktif?.judul}
                </p>
              </button>
              <TombolTerang
                aktif={suara}
                label={suara ? 'Matikan suara panduan' : 'Nyalakan suara panduan'}
                onClick={() => {
                  setSuara((s) => !s)
                  if (!suara && aktif && 'speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance(aktif.instruksi)
                    u.lang = 'id-ID'
                    window.speechSynthesis.speak(u)
                  }
                }}
              >
                {suara ? <IconVolume className="h-4 w-4" /> : <IconVolumeOff className="h-4 w-4" />}
              </TombolTerang>
              <TombolTerang
                aktif={ikuti}
                label="Ikuti posisi simulasi"
                onClick={() => {
                  setIkuti(true)
                  map.flyTo(titikPada(lin, ui.m).pos, Math.max(map.getZoom(), 16), { duration: 0.5 })
                }}
              >
                <IconCrosshair className="h-4 w-4" />
              </TombolTerang>
              <TombolTerang label={lebar ? 'Perkecil' : 'Lihat tahapan'} onClick={() => setLebar((l) => !l)}>
                {lebar ? <IconChevronDown className="h-4 w-4" /> : <IconChevronUp className="h-4 w-4" />}
              </TombolTerang>
            </div>

            {/* progres: tiap tahap satu potongan, bisa diklik untuk lompat */}
            <div
              className="relative mt-3 flex h-2 cursor-pointer gap-0.5"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                lompat(((e.clientX - r.left) / r.width) * durasiMs)
              }}
              role="slider"
              aria-label="Posisi simulasi"
              aria-valuenow={Math.round(persen)}
            >
              {langkah.map((t) => {
                const w = ((t.akhirMs - t.mulaiMs) / durasiMs) * 100
                const isi = Math.min(1, Math.max(0, (ui.waktu - t.mulaiMs) / (t.akhirMs - t.mulaiMs)))
                return (
                  <span key={t.id} className="relative h-full overflow-hidden rounded-full bg-[#E8EEEE]" style={{ width: `${w}%` }}>
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${isi * 100}%`, backgroundColor: t.tipe === 'angkot' ? t.warna : '#2563EB' }}
                    />
                  </span>
                )
              })}
            </div>
          </div>

          {lebar && (
            <ol className="naik-scroll min-h-0 flex-1 overflow-y-auto border-t border-[#EDF1F2] px-3 py-2">
              {langkah.map((t, idx) => {
                const Ikon = IKON_TAHAP[t.tipe]
                const kini = idx === ui.i && !tiba
                const lewat = idx < ui.i || tiba
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => lompat(t.mulaiMs)}
                      className={`flex w-full items-start gap-3 rounded-xl p-2 text-left transition ${kini ? 'bg-primary/8 ring-1 ring-primary/25' : 'hover:bg-[#F4F7F7]'}`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${lewat ? 'opacity-50' : ''}`}
                        style={{ backgroundColor: t.tipe === 'angkot' ? t.warna : '#E7EEFD', color: t.tipe === 'angkot' ? '#fff' : '#2563EB' }}
                      >
                        <Ikon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`text-[13px] font-semibold ${lewat ? 'text-dark/45' : 'text-dark'}`}>{t.judul}</span>
                          {kini && <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-white">sekarang</span>}
                        </span>
                        <span className="block text-[12px] text-dark/60">
                          {jarak(t.jarakM)} · ±{t.tipe === 'angkot' ? menitAngkot(t.jarakM) : menitJalan(t.jarakM)} mnt
                          {t.tipe === 'angkot' ? ` · ${t.instruksi.replace(/^Naik angkot .*? arah /, 'arah ')}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </Lapisan>
    </>
  )
}

function TombolGelap({ onClick, label, merah, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-white transition active:scale-95 ${merah ? 'bg-[#C8432E] hover:bg-[#B23A27]' : 'bg-white/12 hover:bg-white/20'}`}
    >
      {children}
    </button>
  )
}

function TombolTerang({ onClick, label, aktif, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={aktif}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${aktif ? 'border-primary/40 bg-primary/8 text-primary' : 'border-[#E3E8EA] text-dark/60 hover:bg-[#F4F7F7]'}`}
    >
      {children}
    </button>
  )
}
