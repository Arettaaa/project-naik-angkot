import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { warnaTrayek } from '../warna'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, GeoJSON, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../../api/naik'
import KolomTempat from '../components/KolomTempat'
import PinPeta from './PinPeta'
import { AKURAT_M, ambilLokasi } from './lokasi'
import { JENIS_OPSI, normalOpsi } from './opsi'
import { tempatSaya, useLayarBesar, useTempatSaya } from '../hooks'
import { jarak, menitAngkot, menitJalan, nomor, rupiah } from '../../utils/format'
import { useDashboard } from '../context'
import { Card, CardHeader, Floating, KodeBadge as Badge, PilWarga } from '../ui'
import { nomorLengkap, nomorTampil, nomorWarga } from '../nomorWarga'
import {
  IconArrowLeft, IconBus, IconCap, IconChevronRight, IconHome, IconList, IconMap, IconPlay, IconSearch, IconSwap, IconTransfer, IconWalk,
} from '../icons'
import NavigasiSimulasi from './NavigasiSimulasi'
import { aturToleransiKlik } from '../simulasi'

const KodeBadge = (p) => <Badge size="sm" {...p} />

function PanelSection({ title, children }) {
  return (
    <section className="border-t border-[#EDF1F2] px-5 py-4 lg:px-6">
      {title && <h3 className="mb-3 font-display text-[16px] font-bold text-tentang-dark">{title}</h3>}
      {children}
    </section>
  )
}

function KlikPeta({ onClick }) {
  const map = useMapEvents({ click: (e) => onClick(e.latlng) })
  useEffect(() => aturToleransiKlik(map, 10), [map])
  return null
}

// opsi tercepat dari semua hasil (langsung maupun pindah)
function opsiTercepat(data) {
  const semua = JENIS_OPSI.flatMap(([jenis]) => (data[jenis] ?? []).map((o, i) => ({ jenis, i, menit: o.menit ?? 0 })))
  return semua.sort((a, b) => a.menit - b.menit)[0] ?? null
}

function FitToPoints({ points, detailBuka, navigasiAktif }) {
  const map = useMap()
  const key = JSON.stringify(points) + (detailBuka ? '1' : '0')
  useEffect(() => {
    if (navigasiAktif) return
    const p = points.filter(Boolean)
    if (!p.length) return
    const isDesktop = window.innerWidth >= 1024
    const kiri = isDesktop ? 460 : 30
    const kanan = isDesktop && detailBuka ? 400 : 30
    const bawah = !isDesktop && detailBuka ? Math.round(window.innerHeight * 0.46) : 120
    const atas = !isDesktop ? 70 : 60
    if (p.length === 1) map.setView(p[0], Math.max(map.getZoom(), 15))
    else map.fitBounds(L.latLngBounds(p), { paddingTopLeft: [kiri, atas], paddingBottomRight: [kanan, bawah] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, detailBuka, navigasiAktif])
  return null
}

const WARNA_ASAL = '#38BDF8'
const WARNA_TUJUAN = '#FFAB2E'

export default function CariPanel() {
  const { trayek } = useDashboard()
  // warna per kode; trayek yang belum ada di daftar (mis. cache /api/trayek masih lama) tetap dapat warna dari palet
  const warna = useMemo(() => {
    const peta = Object.fromEntries((trayek.data ?? []).map((t) => [t.kode_trayek, t.warna]))
    return new Proxy(peta, { get: (o, k) => (typeof k === 'string' ? (o[k] ?? warnaTrayek(k)) : o[k]) })
  }, [trayek.data])

  const [asal, setAsal] = useState(null)
  const [tujuan, setTujuan] = useState(null)
  const [mode, setMode] = useState('asal') // titik mana yang diisi saat peta diklik
  const [hasil, setHasil] = useState({ data: null, loading: false, error: null })
  const [pilih, setPilih] = useState(null) // {jenis:'langsung'|'transfer'|'transfer2', i}
  const [detailBuka, setDetailBuka] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  const [panelCariBuka, setPanelCariBuka] = useState(true)
  const [lokasiErr, setLokasiErr] = useState('')
  const [pin, setPin] = useState(null) // { jenis: 'asal'|'tujuan', awal?, gps? } saat memilih lewat pin
  const [cariLokasi, setCariLokasi] = useState(false)
  const [lokasiKurang, setLokasiKurang] = useState(null) // { jenis, akurasi } kalau GPS otomatis kurang tepat
  const [navigasiAktif, setNavigasiAktif] = useState(false)
  const [activeStepNav, setActiveStepNav] = useState(0)
  const besar = useLayarBesar()
  const hasilRef = useRef(null)

  // dari Beranda ("Mau ke mana hari ini?"): /cari?ke=lat,lng&nama=... -> isi tujuan, coba lokasi saya sebagai asal, lalu cari otomatis
  const [params] = useSearchParams()
  const otomatis = useRef(false)
  useEffect(() => {
    const ke = params.get('ke')?.split(',').map(Number)
    if (ke && ke.length === 2 && ke.every(Number.isFinite)) {
      setTitik('tujuan', { lat: ke[0], lng: ke[1], nama: params.get('nama') || 'Tujuan', ket: params.get('ket') })
      setMode('asal')
      otomatis.current = true
      lokasiSaya()
      return
    }
    if (params.get('pin') === 'tujuan' || params.get('pin') === 'asal') bukaPin(params.get('pin'))
    // asal otomatis = lokasi saya (diam-diam; kalau ditolak, pengguna isi sendiri)
    if (!asal) lokasiSaya('asal', { diam: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  // sekali pilih langsung dicari: begitu asal & tujuan terisi, tanpa perlu tekan tombol
  const permintaan = useRef(0)
  useEffect(() => {
    otomatis.current = false
    if (!asal || !tujuan) return
    const t = setTimeout(cari, 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asal?.lat, asal?.lng, tujuan?.lat, tujuan?.lng])

  function setTitik(jenis, titik) {
    if (jenis === 'asal') setAsal(titik)
    else setTujuan(titik)
    setHasil({ data: null, loading: false, error: null })
    setPilih(null)
    setDetailBuka(false)
    setNavigasiAktif(false)
  }

  // isi nama & alamat titik dari server (reverse geocoding), hanya kalau titiknya belum diganti
  function isiAlamat(jenis, t, ganti = true) {
    api
      .alamat(t.lat, t.lng)
      .then((a) => {
        const set = jenis === 'asal' ? setAsal : setTujuan
        set((cur) => (cur && cur.lat === t.lat && cur.lng === t.lng ? { ...cur, nama: ganti ? a.nama : cur.nama, ket: a.ket } : cur))
      })
      .catch(() => {})
  }

  function bukaPin(jenis, awal = null, gps = null) {
    setLokasiErr('')
    setPin({ jenis, awal, gps })
  }

  // ketuk peta tidak langsung mengganti titik (sering tidak sengaja): buka pin di titik itu untuk dicek dulu
  function klikPeta(latlng) {
    bukaPin(mode, { lat: latlng.lat, lng: latlng.lng })
  }

  function pilihTempat(jenis, t) {
    setTitik(jenis, t)
    tempatSaya.tambahRiwayat(t)
    if (jenis === 'asal' && !tujuan) setMode('tujuan')
  }

  // GPS akurasi tinggi. Kalau kurang tepat dan pengguna sendiri yang minta, langsung buka pin
  // di posisi GPS supaya bisa digeser ke tempat yang sebenarnya.
  function lokasiSaya(jenis = 'asal', { diam = false } = {}) {
    setLokasiErr('')
    setLokasiKurang(null)
    setCariLokasi(true)
    ambilLokasi({ maksMs: diam ? 5000 : 8000 })
      .then((g) => {
        if (!diam && g.akurasi > AKURAT_M) return bukaPin(jenis, g, g)
        const t = { lat: g.lat, lng: g.lng, nama: 'Lokasi saya' }
        setTitik(jenis, t)
        isiAlamat(jenis, t, false)
        if (g.akurasi > AKURAT_M) setLokasiKurang({ jenis, akurasi: g.akurasi, g })
        if (jenis === 'asal') setMode('tujuan')
      })
      .catch((e) => !diam && setLokasiErr(e.message))
      .finally(() => setCariLokasi(false))
  }

  async function cari() {
    if (!asal || !tujuan) return
    const id = ++permintaan.current
    setHasil((h) => ({ data: h.data, loading: true, error: null }))
    setNavigasiAktif(false)
    try {
      const data = await api.rekomendasi(asal, tujuan)
      if (id !== permintaan.current) return // sudah ada pencarian yang lebih baru
      setHasil({ data, loading: false, error: null })
      const best = opsiTercepat(data)
      setPilih(best ? { jenis: best.jenis, i: best.i } : null)
      // layar lebar: langsung tampilkan langkah opsi tercepat. HP: tetap di daftar hasil (panel langkah menutupi peta)
      setDetailBuka(Boolean(best) && window.innerWidth >= 1024)
      if (window.innerWidth < 1024) setTimeout(() => hasilRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (error) {
      if (id === permintaan.current) setHasil({ data: null, loading: false, error })
    }
  }

  function tukar() {
    setAsal(tujuan)
    setTujuan(asal)
    setHasil({ data: null, loading: false, error: null })
    setPilih(null)
    setDetailBuka(false)
    setNavigasiAktif(false)
  }

  const opsi = pilih && hasil.data ? hasil.data[pilih.jenis][pilih.i] : null

  function pilihOpsi(p) {
    setPilih(p)
    setDetailBuka(true)
    setNavigasiAktif(false)
    if (!besar) setPanelCariBuka(false) // HP: daftar diciutkan supaya peta & langkah kelihatan
  }

  const panel = (
    <Card className="flex max-h-full flex-col overflow-hidden">
      <CardHeader
        title="Cari Rute"
        icon={<IconSearch className="h-5 w-5" />}
        subtitle={<span className="hidden sm:inline">Tentukan asal & tujuan, NAIK carikan angkot langsung atau 1x pindah.</span>}
        onClose={() => {
          setPanelCariBuka(false)
          if (opsi && !besar) setDetailBuka(true)
        }}
      />
      <div className="naik-scroll min-h-0 flex-1 overflow-y-auto px-4.5 pt-3 pb-5 sm:px-5 lg:px-6">
        <TitikInput
          label="Dari"
          slot="asal"
          warna={WARNA_ASAL}
          titik={asal}
          aktif={mode === 'asal'}
          onAktif={() => setMode('asal')}
          onPilih={(t) => pilihTempat('asal', t)}
          onLokasiSaya={() => lokasiSaya('asal')}
          onPilihPeta={() => bukaPin('asal')}
        />
        <div className="my-2 flex justify-center">
          <button
            onClick={tukar}
            disabled={!asal && !tujuan}
            className="rounded-full border border-border-nav px-3 py-1 text-xs font-semibold text-dark/70 hover:bg-mist disabled:opacity-40"
            aria-label="Tukar asal dan tujuan"
          >
            <span className="inline-flex items-center gap-1">
              <IconSwap className="h-3.5 w-3.5" /> Tukar
            </span>
          </button>
        </div>
        <TitikInput
          label="Ke"
          slot="tujuan"
          warna={WARNA_TUJUAN}
          titik={tujuan}
          aktif={mode === 'tujuan'}
          onAktif={() => setMode('tujuan')}
          onPilih={(t) => pilihTempat('tujuan', t)}
          onLokasiSaya={() => lokasiSaya('tujuan')}
          onPilihPeta={() => bukaPin('tujuan')}
        />
        {cariLokasi && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#2F80ED]" role="status">
            <span className="h-2 w-2 animate-ping rounded-full bg-[#2F80ED]" /> Mencari lokasi kamu…
          </p>
        )}
        {lokasiErr && <p className="mt-2 text-xs text-red-700">{lokasiErr}</p>}
        {lokasiKurang && !cariLokasi && (
          <p className="mt-2 rounded-lg bg-[#EEF3FE] px-2.5 py-1.5 text-[12px] leading-snug text-[#1E3A8A]">
            Lokasi kamu kurang tepat (±{lokasiKurang.akurasi} m).{' '}
            <button
              onClick={() => {
                const t = lokasiKurang.jenis === 'asal' ? asal : tujuan
                bukaPin(lokasiKurang.jenis, t, lokasiKurang.g)
                setLokasiKurang(null)
              }}
              className="font-semibold underline"
            >
              Betulkan di peta
            </button>
          </p>
        )}

        {hasil.loading && (
          <p className="mt-3 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-primary" role="status">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            Mencari angkot…
          </p>
        )}
        {(!asal || !tujuan) && (
          <p className="mt-2 text-center text-[11px] sm:text-xs text-dark/50 leading-relaxed">
            Ketik nama tempat, pilih lewat peta, atau ketuk peta untuk memilih titik <strong>{mode === 'asal' ? 'asal' : 'tujuan'}</strong>.
          </p>
        )}

        {hasil.error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-800">{hasil.error.message}</div>
        )}

        {hasil.data && (
          <div ref={hasilRef} className={`mt-4 scroll-mt-2 border-t border-[#EDF1F2] pt-3 transition-opacity ${hasil.loading ? 'opacity-50' : ''}`}>
            <Hasil
              data={hasil.data}
              warna={warna}
              pilih={pilih}
              onPilihOpsi={pilihOpsi}
              onMulaiNavigasi={() => setNavigasiAktif(true)}
            />
          </div>
        )}

        {/* Spacer bawah agar tidak terpotong sudut kartu */}
        <div className="h-5 shrink-0" aria-hidden="true" />
      </div>
    </Card>
  )

  const titikFit = opsi
    ? [asal, tujuan].map((t) => [t.lat, t.lng]).concat(normalOpsi(opsi).legs.flatMap((l) => l.garis))
    : [asal, tujuan].filter(Boolean).map((t) => [t.lat, t.lng])

  if (pin) {
    const j = pin.jenis
    const awal = pin.awal ?? (j === 'asal' ? asal : tujuan) ?? (j === 'tujuan' ? asal : tujuan)
    return (
      <>
        {j !== 'asal' && asal && <Penanda titik={asal} warna={WARNA_ASAL} label="Asal" />}
        {j !== 'tujuan' && tujuan && <Penanda titik={tujuan} warna={WARNA_TUJUAN} label="Tujuan" />}
        <PinPeta
          key={`${j}-${awal?.lat}-${awal?.lng}`}
          label={j}
          warna={j === 'asal' ? WARNA_ASAL : WARNA_TUJUAN}
          awal={awal}
          gps={pin.gps}
          onBatal={() => setPin(null)}
          onPilih={(t) => {
            pilihTempat(j, t)
            setLokasiKurang(null)
            setPin(null)
          }}
        />
      </>
    )
  }

  return (
    <>
      {/* Panel Kiri Pencarian: sembunyikan atau ciutkan saat navigasi aktif, saat ditutup, atau di HP saat detail langkah dibuka */}
      {!navigasiAktif && panelCariBuka && (besar || !(opsi && detailBuka)) ? (
        <Floating className="top-3.5 left-3.5 right-3.5 flex max-h-[75vh] flex-col lg:top-3 lg:bottom-auto lg:left-[94px] lg:right-auto lg:max-h-[calc(100%-24px)] lg:w-[365px]">
          {panel}
        </Floating>
      ) : !navigasiAktif && (!panelCariBuka || (!besar && opsi && detailBuka)) ? (
        <Floating className="top-3.5 left-3.5 z-[1000] lg:top-3 lg:left-[94px]">
          <button
            onClick={() => {
              setPanelCariBuka(true)
              if (!besar) setDetailBuka(false)
            }}
            className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-xs font-bold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.18)] ring-1 ring-black/5 hover:bg-mist active:scale-95"
          >
            <IconSearch className="h-4 w-4 text-primary" />
            <span>Ubah rute</span>
            {asal && tujuan && (
              <span className="text-dark/50 font-medium truncate max-w-[150px]">
                • {asal.nama.slice(0, 10)} → {tujuan.nama.slice(0, 10)}
              </span>
            )}
          </button>
        </Floating>
      ) : (
        <Floating className="top-3.5 left-3.5 lg:top-4 lg:left-[94px] z-[1050]">
          <button
            onClick={() => setNavigasiAktif(false)}
            className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-xs font-bold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.18)] ring-1 ring-black/5 hover:bg-mist active:scale-95"
          >
            <IconArrowLeft className="h-4 w-4" />
            <span>Ubah rute</span>
          </button>
        </Floating>
      )}

      {/* Simulasi perjalanan (animasi, bukan pelacakan posisi asli) */}
      {navigasiAktif && opsi && (
        <NavigasiSimulasi
          opsi={opsi}
          asal={asal}
          tujuan={tujuan}
          warna={warna}
          onKeluar={() => setNavigasiAktif(false)}
          activeStepIdxExternal={activeStepNav}
          setActiveStepIdxExternal={setActiveStepNav}
        />
      )}

      {/* Floating Panel Kanan: Detail Langkah Perjalanan (Sebelum Navigasi) */}
      {opsi && detailBuka && !navigasiAktif && (
        <Floating className="right-3 bottom-24 left-3 flex max-h-[50vh] flex-col lg:top-3 lg:bottom-auto lg:left-auto lg:max-h-[calc(100%-24px)] lg:w-[372px]">
          <DetailLangkah
            opsi={opsi}
            warna={warna}
            asal={asal}
            tujuan={tujuan}
            onClose={() => setDetailBuka(false)}
            navigasiAktif={false}
            onMulaiNavigasi={() => setNavigasiAktif(true)}
          />
        </Floating>
      )}

      {/* Floating Panel Kanan (Hanya di Desktop lg: saat navigasi aktif) */}
      {opsi && detailBuka && navigasiAktif && (
        <Floating className="hidden lg:flex lg:top-24 lg:right-4 lg:w-[372px] lg:max-h-[calc(100%-120px)] lg:flex-col z-[1050]">
          <DetailLangkah
            opsi={opsi}
            warna={warna}
            asal={asal}
            tujuan={tujuan}
            onClose={() => setDetailBuka(false)}
            navigasiAktif={true}
            onStopNavigasi={() => setNavigasiAktif(false)}
            activeStepIdx={activeStepNav}
          />
        </Floating>
      )}

      {/* Tombol buka detail jika ditutup */}
      {opsi && !detailBuka && !navigasiAktif && (
        <Floating className="bottom-24 right-3 lg:bottom-4 lg:right-4">
          <button
            onClick={() => {
              setDetailBuka(true)
              if (!besar) setPanelCariBuka(false)
            }}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-[13px] font-semibold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.16)] transition hover:bg-[#F6F9F9] active:scale-[0.98]"
          >
            <IconList className="h-4 w-4 text-primary" /> Langkah perjalanan
          </button>
        </Floating>
      )}

      {!navigasiAktif && (besar || !(opsi && detailBuka)) && !(!besar && panelCariBuka && hasil.data) && (
        <Floating className="bottom-24 left-1/2 -translate-x-1/2 lg:bottom-4">
          <p className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold whitespace-nowrap shadow-[0_8px_30px_rgba(21,30,44,0.14)]">
            Ketuk peta untuk memilih{' '}
            <span style={{ color: mode === 'asal' ? WARNA_ASAL : WARNA_TUJUAN }}>{mode === 'asal' ? 'ASAL' : 'TUJUAN'}</span>
          </p>
        </Floating>
      )}
      <KlikPeta onClick={klikPeta} />
      {opsi && <RuteOpsi opsi={opsi} warna={warna} asal={asal} tujuan={tujuan} />}
      {asal && <Penanda titik={asal} warna={WARNA_ASAL} label="Asal" />}
      {tujuan && <Penanda titik={tujuan} warna={WARNA_TUJUAN} label="Tujuan" />}
      <FitToPoints points={titikFit} detailBuka={detailBuka && !navigasiAktif && !!opsi} navigasiAktif={navigasiAktif} />
    </>
  )

}

const SLOT_SIMPAN = [
  { key: 'rumah', label: 'Rumah', Ikon: IconHome },
  { key: 'kampus', label: 'Kampus', Ikon: IconCap },
]

function TitikInput({ label, warna, titik, aktif, onAktif, onPilih, onLokasiSaya, onPilihPeta }) {
  const saya = useTempatSaya()
  const bisaSimpan = titik && titik.nama !== 'Memuat alamat…'
  return (
    <div className={`rounded-xl border p-2.5 sm:p-3 transition ${aktif ? 'border-primary ring-2 ring-primary/15' : 'border-border-nav'}`}>
      <div className="mb-1 sm:mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-dark/70">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: warna }} />
          {label}
        </span>
        <button onClick={onPilihPeta} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <IconMap className="h-3.5 w-3.5" /> Pilih lewat peta
        </button>
      </div>
      <KolomTempat
        titik={titik}
        onPilih={onPilih}
        onFocus={onAktif}
        onLokasiSaya={onLokasiSaya}
        onPilihPeta={onPilihPeta}
        placeholder={label === 'Dari' ? 'Dari mana?' : 'Mau ke mana?'}
      />
      {bisaSimpan && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-dark/45">Simpan sebagai</span>
          {SLOT_SIMPAN.map(({ key, label: l, Ikon }) => {
            const tersimpan = tempatSaya.sama(saya[key], titik)
            return (
              <button
                key={key}
                onClick={() => tempatSaya.atur(key, tersimpan ? null : titik)}
                aria-pressed={tersimpan}
                className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold transition ${tersimpan ? 'bg-primary text-white' : 'bg-[#F1F4F5] text-dark/65 hover:bg-mist'}`}
              >
                <Ikon className="h-3.5 w-3.5" /> {l}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const menitOpsi = (o) => normalOpsi(o).menit

function Hasil({ data, warna, pilih, onPilihOpsi, onMulaiNavigasi }) {
  const kosong = JENIS_OPSI.every(([jenis]) => !data[jenis]?.length)
  const dekat = data.jarak_lurus_m != null && data.jarak_lurus_m <= 1200
  const tercepat = opsiTercepat(data)
  return (
    <>
      {dekat && (
        <div className="mx-5 mb-1 flex items-center gap-3 rounded-xl bg-[#EEF3FE] px-3 py-2.5 text-[12.5px] text-[#1E3A8A]">
          <IconWalk className="h-5 w-5 shrink-0" />
          <span>
            Dekat — jalan kaki saja sekitar <strong>{menitJalan(data.jarak_lurus_m * 1.25)} menit</strong> ({jarak(data.jarak_lurus_m * 1.25)}).
          </span>
        </div>
      )}
      {kosong && (
        <PanelSection>
          <p className="text-sm font-semibold">Belum ada angkot yang cocok.</p>
          <p className="mt-1 text-sm text-dark/70">
            Tidak ada jalur angkot dalam ±{data.radius_jalan_kaki_m ?? 800} m dari titik asal/tujuan, atau perlu pindah lebih dari dua kali.
            Coba geser titiknya ke jalan besar terdekat.
          </p>
        </PanelSection>
      )}
      {JENIS_OPSI.map(([jenis, judul]) =>
        data[jenis]?.length ? (
          <PanelSection key={jenis} title={judul}>
            <div className="space-y-2">
              {data[jenis].map((o, i) => {
                const aktif = pilih?.jenis === jenis && pilih.i === i
                const n = normalOpsi(o)
                const kode = n.kode
                const jalan = n.jalan
                const angkot = n.jarakAngkot
                return (
                  <KartuOpsi key={kode.join('-')} aktif={aktif} onClick={() => onPilihOpsi({ jenis, i })}>
                    <div className="flex items-center gap-1.5">
                      {kode.map((k, j) => (
                        <span key={k} className="flex shrink-0 items-center gap-1.5">
                          {j > 0 && <IconTransfer className="h-3.5 w-3.5 text-dark/35" />}
                          <KodeBadge kode={k} warna={warna[k]} />
                        </span>
                      ))}
                      <span className="min-w-0 flex-1" />
                      <span className="shrink-0 font-display text-[17px] leading-none font-bold whitespace-nowrap text-dark">
                        {menitOpsi(o)}
                        <span className="ml-0.5 text-[12px] font-semibold text-dark/55">mnt</span>
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[13px] font-semibold text-dark">
                      {n.legs.length > 1
                        ? `Oper ke ${n.legs.slice(1).map((l) => nomorTampil(l.kode)).join(', lalu ')} arah ${String(n.legs.at(-1).arah).replace(/^ke /, '')}`
                        : `Arah ${String(n.legs[0].arah).replace(/^ke /, '')}`}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-dark/55">
                      <span className="inline-flex items-center gap-1">
                        <IconWalk className="h-3.5 w-3.5" />
                        {jarak(jalan)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconBus className="h-3.5 w-3.5" />
                        {jarak(angkot)}
                      </span>
                      <span>{rupiah(o.tarif)}</span>
                      {kode.some((k) => nomorWarga(k)) && (
                        <span
                          title="Nomor yang masih dipakai warga & Moovit"
                          className="rounded-full bg-[#FFF3D6] px-1.5 py-px text-[10.5px] font-semibold whitespace-nowrap text-[#8A5A00]"
                        >
                          warga: {kode.map((k) => nomorWarga(k) ?? nomorTampil(k)).join(' → ')}
                        </span>
                      )}
                      {tercepat?.jenis === jenis && tercepat.i === i && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10.5px] font-bold text-primary">tercepat</span>
                      )}
                    </p>
                    {aktif && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          onMulaiNavigasi?.()
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && onMulaiNavigasi?.()}
                        className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-white hover:bg-[#178563]"
                      >
                        <IconPlay className="h-3.5 w-3.5" /> Mulai simulasi
                      </span>
                    )}
                  </KartuOpsi>
                )
              })}
            </div>
          </PanelSection>
        ) : null,
      )}
      <p className="px-5 py-3 text-[11.5px] leading-relaxed text-dark/45">
        Urut dari perkiraan waktu (jalan kaki, naik angkot, dan ±5 menit menunggu tiap angkot). Tarif Rp5.000 per angkot.
      </p>
    </>
  )
}

function KartuOpsi({ aktif, onClick, children }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`w-full cursor-pointer rounded-xl border p-3 text-left transition ${aktif ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border-nav hover:bg-[#F4FAF8]'}`}
    >
      {children}
    </div>
  )
}

function Tahap({ ikon: Ikon, warna = '#E7EEFD', warnaIkon = '#2563EB', sorot, label, children }) {
  return (
    <li className={`relative flex items-start gap-3 rounded-xl p-1.5 transition ${sorot ? 'bg-primary/8 ring-1 ring-primary/25' : ''}`}>
      <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: warna, color: warnaIkon }}>
        {typeof Ikon === 'string' ? <span className="text-[12px] font-bold">{Ikon}</span> : <Ikon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 pt-0.5">
        {sorot && <span className="mb-0.5 inline-block rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-white">{label}</span>}
        {children}
      </div>
    </li>
  )
}

function DetailLangkah({ opsi, warna, asal, tujuan, onClose, navigasiAktif, onMulaiNavigasi, onStopNavigasi, activeStepIdx = 0 }) {
  const n = normalOpsi(opsi)
  const totalJalan = n.jalan
  const totalAngkot = n.jarakAngkot
  // urutan tahap simulasi: jalan(0), angkot ke-i (2i+1), pindah setelah angkot ke-i (2i+2), jalan terakhir (2n)
  const sorot = (i) => navigasiAktif && activeStepIdx === i
  const akhir = 2 * n.legs.length

  return (
    <Card className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader
        title="Langkah Perjalanan"
        onClose={onClose}
        subtitle={n.legs.length > 1 ? `Angkot ${n.kode.map((k) => nomorLengkap(k)).join(' → ')}` : `Angkot ${nomorLengkap(n.kode[0])} langsung`}
      />
      <div className="naik-scroll min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-6 lg:px-6">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[#F6F9F9] p-3 text-center">
          {[
            ['Waktu', `±${menitOpsi(opsi)} mnt`],
            ['Jalan', jarak(totalJalan)],
            ['Angkot', jarak(totalAngkot)],
            ['Tarif', rupiah(opsi.tarif)],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-[11px] text-dark/50">{l}</p>
              <p className="mt-0.5 text-[13px] font-bold text-dark">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-3">
          {!navigasiAktif ? (
            <button
              onClick={onMulaiNavigasi}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[14.5px] font-semibold text-white shadow-[0_6px_16px_rgba(26,147,111,0.25)] transition hover:bg-[#178563] active:scale-[0.98]"
            >
              <IconPlay className="h-4 w-4" /> Mulai simulasi perjalanan
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/5 p-3">
              <span className="text-[13px] font-semibold text-primary">Simulasi sedang berjalan</span>
              <button onClick={onStopNavigasi} className="rounded-lg border border-[#E3E8EA] bg-white px-2.5 py-1 text-xs font-semibold text-dark/70 hover:bg-[#F4F7F7]">
                Hentikan
              </button>
            </div>
          )}
        </div>

        <h4 className="mt-5 mb-2 text-[11.5px] font-bold tracking-wider text-dark/45 uppercase">Panduan rute</h4>
        <ol className="relative space-y-1.5 before:absolute before:top-4 before:bottom-4 before:left-[21.5px] before:w-0.5 before:bg-[#E3E8EA]">
          <Tahap ikon="A" warna={WARNA_ASAL} warnaIkon="#fff">
            <p className="text-[11.5px] text-dark/50">Berangkat dari</p>
            <p className="text-[14px] leading-snug font-semibold text-dark">{asal?.nama || 'Lokasi asal'}</p>
          </Tahap>
          <Tahap ikon={IconWalk} sorot={sorot(0)} label="sekarang">
            <p className="text-[13.5px] text-dark/80">
              Jalan kaki <strong className="text-dark">{jarak(n.jalanKeNaik)}</strong> (±{menitJalan(n.jalanKeNaik)} mnt) ke jalur angkot
            </p>
          </Tahap>
          {n.legs.map((l, i) => (
            <Fragment key={`${l.kode}-${i}`}>
              {i > 0 && (
                <Tahap ikon={IconTransfer} warna="#EFE9FF" warnaIkon="#6D42C7" sorot={sorot(2 * i)} label="pindah">
                  <p className="text-[13.5px] font-semibold text-[#5B34B0]">Pindah angkot</p>
                  <p className="mt-0.5 text-[12px] text-dark/60">
                    Turun, jalan {n.pindah[i - 1]?.jalanM != null ? jarak(n.pindah[i - 1].jalanM) : 'sebentar'} ke jalur {nomorLengkap(l.kode)}
                  </p>
                </Tahap>
              )}
              <Tahap ikon={IconBus} warna={warna[l.kode] ?? '#1A936F'} warnaIkon="#fff" sorot={sorot(2 * i + 1)} label="di angkot">
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-dark">
                  Naik angkot <KodeBadge kode={l.kode} warna={warna[l.kode]} />
                  <PilWarga kode={l.kode} />
                </p>
                <p className="mt-0.5 text-[12px] text-dark/60">
                  Arah {l.arah} · {jarak(l.jarakM)} (±{menitAngkot(l.jarakM)} mnt)
                </p>
              </Tahap>
            </Fragment>
          ))}
          <Tahap ikon={IconWalk} sorot={sorot(akhir)} label="sekarang">
            <p className="text-[13.5px] text-dark/80">
              Turun, jalan kaki <strong className="text-dark">{jarak(n.jalanDariTurun)}</strong> (±{menitJalan(n.jalanDariTurun)} mnt)
            </p>
          </Tahap>
          <Tahap ikon="B" warna={WARNA_TUJUAN} warnaIkon="#fff">
            <p className="text-[11.5px] text-dark/50">Sampai di</p>
            <p className="text-[14px] leading-snug font-semibold text-dark">{tujuan?.nama || 'Lokasi tujuan'}</p>
          </Tahap>
        </ol>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#EDF1F2] pt-4">
          {[...new Set(n.kode)].map((k) => (
            <Link
              key={k}
              to={`/rute/${nomor(k)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-nav bg-white px-3 py-1.5 text-xs font-semibold text-dark/75 transition hover:bg-mist hover:text-primary"
            >
              Lihat rute {nomorLengkap(k)} <IconChevronRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </div>
    </Card>
  )
}

const GARIS_JALAN = { color: '#4C3935', weight: 3, dashArray: '2 8', lineCap: 'round' }

function RuteOpsi({ opsi, warna, asal, tujuan }) {
  const n = normalOpsi(opsi)
  const garis = n.legs.map((l) => l.garis).filter((g) => g.length)
  if (!garis.length) return null
  const awal = garis[0][0]
  const akhir = garis.at(-1).at(-1)
  return (
    <>
      <Polyline positions={[[asal.lat, asal.lng], awal]} pathOptions={GARIS_JALAN} />
      <Polyline positions={[akhir, [tujuan.lat, tujuan.lng]]} pathOptions={GARIS_JALAN} />
      {n.pindah.map((p, i) => {
        const g1 = n.legs[i]?.garis
        const g2 = n.legs[i + 1]?.garis
        if (!g1?.length || !g2?.length) return null
        // jalan kaki di titik pindah (jalur arah lain bisa beda ruas beberapa puluh meter)
        return <Polyline key={`jp-${i}`} positions={p.titik ? [g1.at(-1), p.titik, g2[0]] : [g1.at(-1), g2[0]]} pathOptions={GARIS_JALAN} />
      })}
      {n.legs.map((l, i) =>
        l.garis.length ? (
          <GeoJSON
            key={`${l.kode}-${i}-${JSON.stringify(l.garis[0])}-${l.garis.length}`}
            data={{ type: 'LineString', coordinates: l.garis.map(([a, b]) => [b, a]) }}
            style={() => ({ color: warna[l.kode] ?? '#1A936F', weight: 6, opacity: 1 })}
          />
        ) : null,
      )}
      <CircleMarker center={awal} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: warna[n.kode[0]] ?? '#1A936F', fillOpacity: 1 }}>
        <Tooltip direction="top">Naik {nomorTampil(n.kode[0])}</Tooltip>
      </CircleMarker>
      {n.pindah.map((p, i) =>
        p.titik ? (
          <CircleMarker key={`tp-${i}`} center={p.titik} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#A586FF', fillOpacity: 1 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>
              Pindah ke {nomorLengkap(n.kode[i + 1])}
            </Tooltip>
          </CircleMarker>
        ) : null,
      )}
      <CircleMarker center={akhir} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: warna[n.kode.at(-1)] ?? '#1A936F', fillOpacity: 1 }}>
        <Tooltip direction="top">Turun</Tooltip>
      </CircleMarker>
    </>
  )
}

function Penanda({ titik, warna, label }) {
  return (
    <CircleMarker center={[titik.lat, titik.lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: warna, fillOpacity: 1 }}>
      <Tooltip permanent direction="top" offset={[0, -10]}>
        {label}
      </Tooltip>
    </CircleMarker>
  )
}