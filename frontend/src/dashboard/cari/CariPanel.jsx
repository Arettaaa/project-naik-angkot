import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, GeoJSON, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../../api/naik'
import KolomTempat from '../components/KolomTempat'
import PinPeta from './PinPeta'
import { tempatSaya, useLayarBesar, useTempatSaya } from '../hooks'
import { jarak, menitAngkot, menitJalan, nomor, rupiah } from '../../utils/format'
import { useDashboard } from '../context'
import { Card, CardHeader, Floating, KodeBadge as Badge } from '../ui'
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
  const semua = [
    ...data.langsung.map((o, i) => ({ jenis: 'langsung', i, menit: o.menit ?? 0 })),
    ...data.transfer.map((o, i) => ({ jenis: 'transfer', i, menit: o.menit ?? 0 })),
  ]
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
    if (p.length === 1) map.setView(p[0], Math.max(map.getZoom(), 15))
    else map.fitBounds(L.latLngBounds(p), { paddingTopLeft: [kiri, 60], paddingBottomRight: [kanan, 120] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, detailBuka, navigasiAktif])
  return null
}

const WARNA_ASAL = '#38BDF8'
const WARNA_TUJUAN = '#FFAB2E'

export default function CariPanel() {
  const { trayek } = useDashboard()
  const warna = useMemo(() => Object.fromEntries((trayek.data ?? []).map((t) => [t.kode_trayek, t.warna])), [trayek.data])

  const [asal, setAsal] = useState(null)
  const [tujuan, setTujuan] = useState(null)
  const [mode, setMode] = useState('asal') // titik mana yang diisi saat peta diklik
  const [hasil, setHasil] = useState({ data: null, loading: false, error: null })
  const [pilih, setPilih] = useState(null) // {jenis:'langsung'|'transfer', i}
  const [detailBuka, setDetailBuka] = useState(true)
  const [panelCariBuka, setPanelCariBuka] = useState(true)
  const [lokasiErr, setLokasiErr] = useState('')
  const [pin, setPin] = useState(null) // 'asal' | 'tujuan' saat memilih lewat pin geser
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
    if (params.get('pin') === 'tujuan' || params.get('pin') === 'asal') setPin(params.get('pin'))
    // asal otomatis = lokasi saya (diam-diam; kalau ditolak, pengguna isi sendiri)
    if (!asal) lokasiSaya({ diam: true })
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

  function klikPeta(latlng) {
    const t = { lat: +latlng.lat.toFixed(6), lng: +latlng.lng.toFixed(6), nama: 'Memuat alamat…' }
    setTitik(mode, t)
    isiAlamat(mode, t)
    if (mode === 'asal' && !tujuan) setMode('tujuan')
  }

  function pilihTempat(jenis, t) {
    setTitik(jenis, t)
    tempatSaya.tambahRiwayat(t)
    if (jenis === 'asal' && !tujuan) setMode('tujuan')
  }

  function lokasiSaya({ diam = false } = {}) {
    setLokasiErr('')
    if (!navigator.geolocation) return !diam && setLokasiErr('Browser tidak mendukung lokasi.')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const t = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), nama: 'Lokasi saya' }
        setTitik('asal', t)
        isiAlamat('asal', t, false)
        setMode('tujuan')
      },
      () => !diam && setLokasiErr('Izin lokasi ditolak / tidak tersedia. Ketik atau pilih lewat peta ya.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
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
        onClose={() => setPanelCariBuka(false)}
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
          onLokasiSaya={() => lokasiSaya()}
          onPilihPeta={() => setPin('asal')}
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
          onPilihPeta={() => setPin('tujuan')}
        />
        {lokasiErr && <p className="mt-2 text-xs text-red-700">{lokasiErr}</p>}

        {hasil.loading && (
          <p className="mt-3 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-primary" role="status">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            Mencari angkot…
          </p>
        )}
        {(!asal || !tujuan) && (
          <p className="mt-2 text-center text-[11px] sm:text-xs text-dark/50 leading-relaxed">
            Ketik nama tempat, pilih lewat peta, atau klik peta untuk mengisi titik <strong>{mode === 'asal' ? 'asal' : 'tujuan'}</strong>.
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
    ? [asal, tujuan].map((t) => [t.lat, t.lng]).concat(garisOpsi(opsi).flat())
    : [asal, tujuan].filter(Boolean).map((t) => [t.lat, t.lng])

  if (pin) {
    const awal = (pin === 'asal' ? asal : tujuan) ?? (pin === 'tujuan' ? asal : tujuan)
    return (
      <>
        {pin !== 'asal' && asal && <Penanda titik={asal} warna={WARNA_ASAL} label="Asal" />}
        {pin !== 'tujuan' && tujuan && <Penanda titik={tujuan} warna={WARNA_TUJUAN} label="Tujuan" />}
        <PinPeta
          label={pin}
          warna={pin === 'asal' ? WARNA_ASAL : WARNA_TUJUAN}
          awal={awal}
          onBatal={() => setPin(null)}
          onPilih={(t) => {
            pilihTempat(pin, t)
            setPin(null)
          }}
        />
      </>
    )
  }

  return (
    <>
      {/* Panel Kiri Pencarian: sembunyikan atau ciutkan saat navigasi aktif atau saat ditutup */}
      {!navigasiAktif && panelCariBuka ? (
        <Floating className="top-3.5 left-3.5 right-3.5 flex max-h-[58vh] flex-col lg:top-3 lg:bottom-auto lg:left-[94px] lg:right-auto lg:max-h-[calc(100%-24px)] lg:w-[365px]">
          {panel}
        </Floating>
      ) : !navigasiAktif && !panelCariBuka ? (
        <Floating className="top-3.5 left-3.5 z-[1000] lg:top-3 lg:left-[94px]">
          <button
            onClick={() => setPanelCariBuka(true)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.18)] ring-1 ring-black/5 hover:bg-mist active:scale-95"
          >
            <IconSearch className="h-4 w-4 text-primary" />
            <span>Cari Rute</span>
            {asal && tujuan && (
              <span className="text-dark/50 font-medium truncate max-w-[140px]">
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
        <Floating className="right-3 bottom-24 left-3 flex max-h-[48%] flex-col lg:top-3 lg:bottom-auto lg:left-auto lg:max-h-[calc(100%-24px)] lg:w-[372px]">
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
            onClick={() => setDetailBuka(true)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-[13px] font-semibold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.16)] transition hover:bg-[#F6F9F9] active:scale-[0.98]"
          >
            <IconList className="h-4 w-4 text-primary" /> Langkah perjalanan
          </button>
        </Floating>
      )}

      {!navigasiAktif && (besar || !(opsi && detailBuka)) && !(!besar && panelCariBuka && hasil.data) && (
        <Floating className="bottom-24 left-1/2 -translate-x-1/2 lg:bottom-4">
          <p className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold whitespace-nowrap shadow-[0_8px_30px_rgba(21,30,44,0.14)]">
            Klik peta untuk mengisi{' '}
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

const menitOpsi = (o) =>
  o.menit ??
  ('kode_1' in o
    ? menitJalan(o.jalan_ke_naik_m + o.jalan_dari_turun_m) + menitAngkot(o.jarak_angkot_1_m + o.jarak_angkot_2_m) + 10
    : menitJalan(o.jalan_ke_naik_m + o.jalan_dari_turun_m) + menitAngkot(o.jarak_angkot_m) + 5)

function Hasil({ data, warna, pilih, onPilihOpsi, onMulaiNavigasi }) {
  const kosong = !data.langsung.length && !data.transfer.length
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
            Tidak ada jalur angkot dalam ±{data.radius_jalan_kaki_m ?? 800} m dari titik asal/tujuan, atau perlu pindah lebih dari sekali.
            Coba geser titiknya ke jalan besar terdekat.
          </p>
        </PanelSection>
      )}
      {[
        ['langsung', 'Langsung · 1 angkot'],
        ['transfer', 'Pindah 1x · 2 angkot'],
      ].map(([jenis, judul]) =>
        data[jenis].length ? (
          <PanelSection key={jenis} title={judul}>
            <div className="space-y-2">
              {data[jenis].map((o, i) => {
                const aktif = pilih?.jenis === jenis && pilih.i === i
                const transfer = jenis === 'transfer'
                const kode = transfer ? [o.kode_1, o.kode_2] : [o.kode_trayek]
                const jalan = o.jalan_ke_naik_m + o.jalan_dari_turun_m + (o.jalan_pindah_m ?? 0)
                const angkot = transfer ? o.jarak_angkot_1_m + o.jarak_angkot_2_m : o.jarak_angkot_m
                return (
                  <KartuOpsi key={kode.join('-')} aktif={aktif} onClick={() => onPilihOpsi({ jenis, i })}>
                    <div className="flex items-center gap-1.5">
                      {kode.map((k, j) => (
                        <span key={k} className="flex items-center gap-1.5">
                          {j > 0 && <IconTransfer className="h-3.5 w-3.5 text-dark/35" />}
                          <KodeBadge kode={k} warna={warna[k]} />
                        </span>
                      ))}
                      <span className="ml-1 min-w-0 flex-1 truncate text-[13px] font-semibold text-dark">
                        {transfer ? `ke ${o.arah_2}` : o.arah}
                      </span>
                      <span className="font-display text-[15px] font-bold text-dark">{menitOpsi(o)} mnt</span>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-dark/55">
                      <span className="inline-flex items-center gap-1">
                        <IconWalk className="h-3.5 w-3.5" />
                        {jarak(jalan)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconBus className="h-3.5 w-3.5" />
                        {jarak(angkot)}
                      </span>
                      <span>{rupiah(o.tarif)}</span>
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
  const transfer = 'kode_1' in opsi
  const totalJalan = opsi.jalan_ke_naik_m + opsi.jalan_dari_turun_m + (opsi.jalan_pindah_m ?? 0)
  const totalAngkot = transfer ? opsi.jarak_angkot_1_m + opsi.jarak_angkot_2_m : opsi.jarak_angkot_m
  const k1 = transfer ? opsi.kode_1 : opsi.kode_trayek
  const sorot = (i) => navigasiAktif && activeStepIdx === i
  const akhir = transfer ? 4 : 2

  return (
    <Card className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader
        title="Langkah Perjalanan"
        onClose={onClose}
        subtitle={transfer ? `Angkot ${nomor(opsi.kode_1)}, pindah ke ${nomor(opsi.kode_2)}` : `Angkot ${nomor(opsi.kode_trayek)} langsung`}
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
              Jalan kaki <strong className="text-dark">{jarak(opsi.jalan_ke_naik_m)}</strong> (±{menitJalan(opsi.jalan_ke_naik_m)} mnt) ke jalur angkot
            </p>
          </Tahap>
          <Tahap ikon={IconBus} warna={warna[k1] ?? '#1A936F'} warnaIkon="#fff" sorot={sorot(1)} label="di angkot">
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-dark">
              Naik angkot <KodeBadge kode={k1} warna={warna[k1]} />
            </p>
            <p className="mt-0.5 text-[12px] text-dark/60">
              Arah {transfer ? opsi.arah_1 : opsi.arah} · {jarak(transfer ? opsi.jarak_angkot_1_m : opsi.jarak_angkot_m)} (±
              {menitAngkot(transfer ? opsi.jarak_angkot_1_m : opsi.jarak_angkot_m)} mnt)
            </p>
          </Tahap>
          {transfer && (
            <>
              <Tahap ikon={IconTransfer} warna="#EFE9FF" warnaIkon="#6D42C7" sorot={sorot(2)} label="pindah">
                <p className="text-[13.5px] font-semibold text-[#5B34B0]">Pindah angkot</p>
                <p className="mt-0.5 text-[12px] text-dark/60">
                  Turun, jalan {opsi.jalan_pindah_m != null ? jarak(opsi.jalan_pindah_m) : 'sebentar'} ke jalur {nomor(opsi.kode_2)}
                </p>
              </Tahap>
              <Tahap ikon={IconBus} warna={warna[opsi.kode_2] ?? '#1A936F'} warnaIkon="#fff" sorot={sorot(3)} label="di angkot">
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-dark">
                  Naik angkot <KodeBadge kode={opsi.kode_2} warna={warna[opsi.kode_2]} />
                </p>
                <p className="mt-0.5 text-[12px] text-dark/60">
                  Arah {opsi.arah_2} · {jarak(opsi.jarak_angkot_2_m)} (±{menitAngkot(opsi.jarak_angkot_2_m)} mnt)
                </p>
              </Tahap>
            </>
          )}
          <Tahap ikon={IconWalk} sorot={sorot(akhir)} label="sekarang">
            <p className="text-[13.5px] text-dark/80">
              Turun, jalan kaki <strong className="text-dark">{jarak(opsi.jalan_dari_turun_m)}</strong> (±{menitJalan(opsi.jalan_dari_turun_m)} mnt)
            </p>
          </Tahap>
          <Tahap ikon="B" warna={WARNA_TUJUAN} warnaIkon="#fff">
            <p className="text-[11.5px] text-dark/50">Sampai di</p>
            <p className="text-[14px] leading-snug font-semibold text-dark">{tujuan?.nama || 'Lokasi tujuan'}</p>
          </Tahap>
        </ol>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#EDF1F2] pt-4">
          {(transfer ? [opsi.kode_1, opsi.kode_2] : [opsi.kode_trayek]).map((k) => (
            <Link
              key={k}
              to={`/rute/${nomor(k)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-nav bg-white px-3 py-1.5 text-xs font-semibold text-dark/75 transition hover:bg-mist hover:text-primary"
            >
              Lihat rute {nomor(k)} <IconChevronRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </div>
    </Card>
  )
}

// [lat,lng] dari segmen (GeoJSON LineString) opsi
function garisOpsi(opsi) {
  const g = (s) => (s?.coordinates ?? []).map(([x, y]) => [y, x])
  return 'kode_1' in opsi ? [g(opsi.segmen_1), g(opsi.segmen_2)] : [g(opsi.segmen)]
}

function RuteOpsi({ opsi, warna, asal, tujuan }) {
  const transfer = 'kode_1' in opsi
  const [g1, g2] = garisOpsi(opsi)
  const kode = transfer ? [opsi.kode_1, opsi.kode_2] : [opsi.kode_trayek]
  const awal = g1?.[0]
  const akhir = (g2 ?? g1)?.at(-1)
  const tt = transfer && opsi.titik_transfer ? [opsi.titik_transfer.coordinates[1], opsi.titik_transfer.coordinates[0]] : null
  return (
    <>
      {awal && <Polyline positions={[[asal.lat, asal.lng], awal]} pathOptions={{ color: '#4C3935', weight: 3, dashArray: '2 8', lineCap: 'round' }} />}
      {akhir && <Polyline positions={[akhir, [tujuan.lat, tujuan.lng]]} pathOptions={{ color: '#4C3935', weight: 3, dashArray: '2 8', lineCap: 'round' }} />}
      {tt && g1?.length > 0 && g2?.length > 0 && (
        // jalan kaki di titik pindah (jalur arah lain bisa beda ruas beberapa puluh meter)
        <Polyline positions={[g1.at(-1), tt, g2[0]]} pathOptions={{ color: '#4C3935', weight: 3, dashArray: '2 8', lineCap: 'round' }} />
      )}
      {[g1, g2].filter(Boolean).map((g, i) => (
        <GeoJSON
          key={`${kode[i]}-${JSON.stringify(g[0])}-${g.length}`}
          data={{ type: 'LineString', coordinates: g.map(([a, b]) => [b, a]) }}
          style={() => ({ color: warna[kode[i]] ?? '#1A936F', weight: 6, opacity: 1 })}
        />
      ))}
      {awal && (
        <CircleMarker center={awal} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: warna[kode[0]] ?? '#1A936F', fillOpacity: 1 }}>
          <Tooltip direction="top">Naik {kode[0]}</Tooltip>
        </CircleMarker>
      )}
      {tt && (
        <CircleMarker center={tt} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#A586FF', fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -8]}>Pindah ke {nomor(kode[1])}</Tooltip>
        </CircleMarker>
      )}
      {akhir && (
        <CircleMarker center={akhir} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: warna[kode.at(-1)] ?? '#1A936F', fillOpacity: 1 }}>
          <Tooltip direction="top">Turun</Tooltip>
        </CircleMarker>
      )}
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