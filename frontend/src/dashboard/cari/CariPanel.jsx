import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, GeoJSON, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../../api/naik'
import KolomTempat from '../components/KolomTempat'
import { jarak, menitAngkot, menitJalan, nomor, rupiah } from '../../utils/format'
import { useDashboard } from '../context'
import { Card, CardHeader, Floating, KodeBadge as Badge, PrimaryButton } from '../ui'
import { IconSearch } from '../icons'
import NavigasiSimulasi from './NavigasiSimulasi'

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
  useMapEvents({ click: (e) => onClick(e.latlng) })
  return null
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
  const [radius, setRadius] = useState(400)
  const [hasil, setHasil] = useState({ data: null, loading: false, error: null })
  const [pilih, setPilih] = useState(null) // {jenis:'langsung'|'transfer', i}
  const [detailBuka, setDetailBuka] = useState(true)
  const [panelCariBuka, setPanelCariBuka] = useState(true)
  const [lokasiErr, setLokasiErr] = useState('')
  const [navigasiAktif, setNavigasiAktif] = useState(false)
  const [activeStepNav, setActiveStepNav] = useState(0)

  // dari Beranda ("Mau ke mana hari ini?"): /cari?ke=lat,lng&nama=... -> isi tujuan, coba lokasi saya sebagai asal, lalu cari otomatis
  const [params] = useSearchParams()
  const otomatis = useRef(false)
  useEffect(() => {
    const ke = params.get('ke')?.split(',').map(Number)
    if (!ke || ke.length !== 2 || ke.some((x) => !Number.isFinite(x))) return
    setTitik('tujuan', { lat: ke[0], lng: ke[1], nama: params.get('nama') || 'Tujuan' })
    setMode('asal')
    otomatis.current = true
    lokasiSaya()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  useEffect(() => {
    if (otomatis.current && asal && tujuan) {
      otomatis.current = false
      cari()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asal, tujuan])

  function setTitik(jenis, titik) {
    if (jenis === 'asal') setAsal(titik)
    else setTujuan(titik)
    setHasil({ data: null, loading: false, error: null })
    setPilih(null)
    setDetailBuka(false)
    setNavigasiAktif(false)
  }

  function klikPeta(latlng) {
    const t = { lat: +latlng.lat.toFixed(6), lng: +latlng.lng.toFixed(6), nama: 'Titik di peta' }
    setTitik(mode, t)
    if (mode === 'asal' && !tujuan) setMode('tujuan')
  }

  function lokasiSaya() {
    setLokasiErr('')
    if (!navigator.geolocation) return setLokasiErr('Browser tidak mendukung lokasi.')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setTitik('asal', { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), nama: 'Lokasi saya' })
        setMode('tujuan')
      },
      () => setLokasiErr('Izin lokasi ditolak / tidak tersedia.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function cari() {
    if (!asal || !tujuan) return
    setHasil({ data: null, loading: true, error: null })
    setPilih(null)
    setDetailBuka(false)
    setNavigasiAktif(false)
    try {
      const data = await api.rekomendasi(asal, tujuan, radius)
      setHasil({ data, loading: false, error: null })
      if (data.langsung.length) {
        setPilih({ jenis: 'langsung', i: 0 })
        setDetailBuka(true)
      } else if (data.transfer.length) {
        setPilih({ jenis: 'transfer', i: 0 })
        setDetailBuka(true)
      }
    } catch (error) {
      setHasil({ data: null, loading: false, error })
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
          warna={WARNA_ASAL}
          titik={asal}
          aktif={mode === 'asal'}
          onAktif={() => setMode('asal')}
          onPilih={(t) => {
            setTitik('asal', t)
            if (!tujuan) setMode('tujuan')
          }}
          extra={
            <button onClick={lokasiSaya} className="text-xs font-semibold text-primary hover:underline">
              Pakai lokasi saya
            </button>
          }
        />
        <div className="my-2 flex justify-center">
          <button
            onClick={tukar}
            disabled={!asal && !tujuan}
            className="rounded-full border border-border-nav px-3 py-1 text-xs font-semibold text-dark/70 hover:bg-mist disabled:opacity-40"
            aria-label="Tukar asal dan tujuan"
          >
            ⇅ Tukar
          </button>
        </div>
        <TitikInput
          label="Ke"
          warna={WARNA_TUJUAN}
          titik={tujuan}
          aktif={mode === 'tujuan'}
          onAktif={() => setMode('tujuan')}
          onPilih={(t) => setTitik('tujuan', t)}
        />
        {lokasiErr && <p className="mt-2 text-xs text-red-700">{lokasiErr}</p>}

        <label className="mt-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <span className="text-dark/70 font-medium">Maks. jalan kaki ke jalur</span>
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="rounded-lg border border-border-nav px-2.5 py-1.5 text-xs sm:text-sm"
          >
            {[200, 400, 600, 800, 1000].map((r) => (
              <option key={r} value={r}>{r} m</option>
            ))}
          </select>
        </label>

        <PrimaryButton onClick={cari} disabled={!asal || !tujuan || hasil.loading} className="mt-3.5 py-2.5 sm:py-3 text-sm">
          {hasil.loading ? 'Mencari…' : 'Cari rute'}
        </PrimaryButton>
        {(!asal || !tujuan) && (
          <p className="mt-2 text-center text-[11px] sm:text-xs text-dark/50 leading-relaxed">
            Ketik nama tempat, atau klik peta untuk mengisi titik <strong>{mode === 'asal' ? 'asal' : 'tujuan'}</strong>.
          </p>
        )}

        {hasil.error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-800">{hasil.error.message}</div>
        )}

        {hasil.data && (
          <div className="mt-4 border-t border-[#EDF1F2] pt-3">
            <Hasil
              data={hasil.data}
              warna={warna}
              pilih={pilih}
              onPilihOpsi={pilihOpsi}
              onMulaiNavigasi={() => setNavigasiAktif(true)}
              radius={radius}
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
            <span className="text-primary font-bold">🔍</span>
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
            <span>◀</span>
            <span>Ubah Rute / Cari</span>
          </button>
        </Floating>
      )}

      {/* Mode Navigasi Realtime (Simulasi Google Maps) */}
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
            <span className="text-primary font-bold">📋</span> Buka Langkah Perjalanan
          </button>
        </Floating>
      )}

      {!navigasiAktif && (
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

function TitikInput({ label, warna, titik, aktif, onAktif, onPilih, extra }) {
  return (
    <div className={`rounded-xl border p-2.5 sm:p-3 transition ${aktif ? 'border-primary ring-2 ring-primary/15' : 'border-border-nav'}`}>
      <div className="mb-1 sm:mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-dark/70">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: warna }} />
          {label}
        </span>
        {extra}
      </div>
      <KolomTempat titik={titik} onPilih={onPilih} onFocus={onAktif} placeholder={label === 'Dari' ? 'Dari mana? (ketik / klik peta)' : 'Mau ke mana? (ketik / klik peta)'} />
      <button onClick={onAktif} className={`mt-1 sm:mt-1.5 text-[11px] sm:text-xs font-semibold ${aktif ? 'text-primary' : 'text-dark/60 hover:text-primary'}`}>
        {aktif ? '● Klik peta untuk memilih titik' : 'Pilih di peta'}
      </button>
    </div>
  )
}

function Hasil({ data, warna, pilih, onPilihOpsi, onMulaiNavigasi, radius }) {
  const kosong = !data.langsung.length && !data.transfer.length
  return (
    <>
      {kosong && (
        <PanelSection>
          <p className="text-sm font-semibold">Belum ada angkot yang cocok.</p>
          <p className="mt-1 text-sm text-dark/70">
            Tidak ada jalur dalam radius {radius} m dari titik asal/tujuan, atau perlu pindah lebih dari sekali. Coba perbesar jarak jalan
            kaki atau geser titiknya mendekati jalan besar.
          </p>
        </PanelSection>
      )}
      {data.langsung.length > 0 && (
        <PanelSection title="Langsung · 1 angkot">
          <div className="space-y-2">
            {data.langsung.map((o, i) => {
              const aktif = pilih?.jenis === 'langsung' && pilih.i === i
              return (
                <KartuOpsi
                  key={o.rute_id}
                  aktif={aktif}
                  onClick={() => onPilihOpsi({ jenis: 'langsung', i })}
                >
                  <div className="flex items-center gap-2">
                    <KodeBadge kode={o.kode_trayek} warna={warna[o.kode_trayek]} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{o.arah}</span>
                    <span className="font-display font-bold text-primary">{rupiah(o.tarif)}</span>
                  </div>
                  <Ringkas jalan={o.jalan_ke_naik_m + o.jalan_dari_turun_m} angkot={o.jarak_angkot_m} />
                  {aktif && (
                    <div className="mt-2.5 flex items-center justify-between border-t border-primary/10 pt-2 text-[11px] font-semibold text-primary">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onMulaiNavigasi?.()
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95"
                      >
                        <span>▶ Mulai</span>
                      </button>
                      <span className="hidden sm:inline">Lihat rincian →</span>
                    </div>
                  )}
                </KartuOpsi>
              )
            })}
          </div>
        </PanelSection>
      )}
      {data.transfer.length > 0 && (
        <PanelSection title="1x pindah · 2 angkot">
          <div className="space-y-2">
            {data.transfer.map((o, i) => {
              const aktif = pilih?.jenis === 'transfer' && pilih.i === i
              return (
                <KartuOpsi
                  key={`${o.kode_1}-${o.kode_2}`}
                  aktif={aktif}
                  onClick={() => onPilihOpsi({ jenis: 'transfer', i })}
                >
                  <div className="flex items-center gap-2">
                    <KodeBadge kode={o.kode_1} warna={warna[o.kode_1]} size="sm" />
                    <span className="text-dark/40">→</span>
                    <KodeBadge kode={o.kode_2} warna={warna[o.kode_2]} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-xs text-dark/60">pindah 1x</span>
                    <span className="font-display font-bold text-primary">{rupiah(o.tarif)}</span>
                  </div>
                  <Ringkas jalan={o.jalan_ke_naik_m + o.jalan_dari_turun_m} angkot={o.jarak_angkot_1_m + o.jarak_angkot_2_m} />
                  {aktif && (
                    <div className="mt-2.5 flex items-center justify-between border-t border-primary/10 pt-2 text-[11px] font-semibold text-primary">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onMulaiNavigasi?.()
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95"
                      >
                        <span>▶ Mulai</span>
                      </button>
                      <span className="hidden sm:inline">Lihat rincian →</span>
                    </div>
                  )}
                </KartuOpsi>
              )
            })}
          </div>
        </PanelSection>
      )}
      <p className="px-5 py-4 text-xs leading-relaxed text-dark/50">
        Tarif rata-rata Rp5.000 / angkot. Klik salah satu opsi untuk melihat jalur di peta dan rincian langkah perjalanan di panel kanan.
      </p>
    </>
  )
}

function KartuOpsi({ aktif, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition ${aktif ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border-nav hover:bg-[#F4FAF8]'}`}
    >
      {children}
    </button>
  )
}

function Ringkas({ jalan, angkot }) {
  return (
    <p className="mt-2 text-xs text-dark/60">
      ± {menitJalan(jalan) + menitAngkot(angkot)} menit · jalan kaki {jarak(jalan)} · naik angkot {jarak(angkot)}
    </p>
  )
}

function DetailLangkah({
  opsi,
  warna,
  asal,
  tujuan,
  onClose,
  navigasiAktif,
  onMulaiNavigasi,
  onStopNavigasi,
  activeStepIdx = 0,
}) {
  const transfer = 'kode_1' in opsi
  const totalJalan = opsi.jalan_ke_naik_m + opsi.jalan_dari_turun_m
  const totalAngkot = transfer ? opsi.jarak_angkot_1_m + opsi.jarak_angkot_2_m : opsi.jarak_angkot_m
  const totalWaktu = menitJalan(totalJalan) + menitAngkot(totalAngkot)

  const isStep0 = navigasiAktif && activeStepIdx === 0
  const isStep1 = navigasiAktif && activeStepIdx === 1
  const isStep2 = navigasiAktif && transfer && activeStepIdx === 2
  const isStep3 = navigasiAktif && transfer && activeStepIdx === 3
  const isStepAkhir = navigasiAktif && (transfer ? activeStepIdx === 4 : activeStepIdx === 2)

  return (
    <Card className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader
        title="Langkah Perjalanan"
        onClose={onClose}
        subtitle={
          transfer
            ? `Trayek ${nomor(opsi.kode_1)} transit ke ${nomor(opsi.kode_2)}`
            : `Trayek ${nomor(opsi.kode_trayek)} langsung`
        }
      />
      <div className="naik-scroll min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-8 lg:px-6">
        {/* Ringkasan Perjalanan */}
        <div className="rounded-2xl border border-[#E3E8EA]/70 bg-[#F6F9F9] p-3.5">
          <div className="flex items-center justify-between border-b border-[#E3E8EA]/70 pb-2.5">
            <div className="flex items-center gap-2">
              {transfer ? (
                <>
                  <KodeBadge kode={opsi.kode_1} warna={warna[opsi.kode_1]} size="sm" />
                  <span className="font-bold text-dark/40">→</span>
                  <KodeBadge kode={opsi.kode_2} warna={warna[opsi.kode_2]} size="sm" />
                  <span className="text-xs font-medium text-dark/60">pindah 1x</span>
                </>
              ) : (
                <>
                  <KodeBadge kode={opsi.kode_trayek} warna={warna[opsi.kode_trayek]} size="sm" />
                  <span className="text-xs font-medium text-dark/60">langsung</span>
                </>
              )}
            </div>
            <span className="font-display text-base font-bold text-primary">
              {rupiah(opsi.tarif)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2.5 text-center text-xs">
            <div>
              <p className="text-dark/50">Estimasi</p>
              <p className="mt-0.5 font-bold text-dark">± {totalWaktu} mnt</p>
            </div>
            <div>
              <p className="text-dark/50">Jalan Kaki</p>
              <p className="mt-0.5 font-bold text-dark">{jarak(totalJalan)}</p>
            </div>
            <div>
              <p className="text-dark/50">Naik Angkot</p>
              <p className="mt-0.5 font-bold text-dark">{jarak(totalAngkot)}</p>
            </div>
          </div>
        </div>

        {/* Tombol Mulai Navigasi Google Maps Style */}
        <div className="mt-3.5">
          {!navigasiAktif ? (
            <button
              onClick={onMulaiNavigasi}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 px-4 text-sm font-bold text-white shadow-[0_6px_20px_rgba(5,150,105,0.32)] transition hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-xs text-white">
                ▶
              </span>
              <span>Mulai Navigasi Realtime</span>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-50/80 p-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600"></span>
                </span>
                <span className="text-xs font-bold text-emerald-800">Navigasi Sedang Berjalan</span>
              </div>
              <button
                onClick={onStopNavigasi}
                className="rounded-xl border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                Hentikan
              </button>
            </div>
          )}
        </div>

        {/* Timeline Vertikal Langkah-Langkah */}
        <div className="mt-5">
          <h4 className="mb-3.5 text-[12px] font-bold tracking-wider text-dark/50 uppercase">
            Panduan Rute
          </h4>

          <div className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-[2px] before:bg-[#E3E8EA]">
            {/* 1. Titik Asal */}
            <div className="relative flex items-start gap-3.5 pl-1">
              <span
                className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: WARNA_ASAL }}
              >
                A
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-semibold text-dark/50">Titik Awal</p>
                <p className="text-sm font-bold leading-snug text-dark">{asal?.nama || 'Lokasi asal'}</p>
              </div>
            </div>

            {/* 2. Jalan kaki ke titik naik */}
            <div className={`relative flex items-start gap-3.5 pl-1 transition-all ${isStep0 ? 'rounded-xl bg-emerald-50/80 p-2 -ml-1 ring-1 ring-emerald-500/30' : ''}`}>
              <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#EAF4EE] text-sm shadow-sm">
                🚶
              </span>
              <div className="min-w-0 pt-0.5">
                {isStep0 && (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                    Posisi Anda Sekarang
                  </span>
                )}
                <p className="text-sm text-dark/80">
                  Jalan kaki <strong className="text-dark">{jarak(opsi.jalan_ke_naik_m)}</strong> (±{menitJalan(opsi.jalan_ke_naik_m)} mnt) ke jalur angkot
                </p>
              </div>
            </div>

            {/* 3. Naik Angkot 1 */}
            <div className={`relative flex items-start gap-3.5 pl-1 transition-all ${isStep1 ? 'rounded-xl bg-emerald-50/80 p-2 -ml-1 ring-1 ring-emerald-500/30' : ''}`}>
              <span
                className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm shadow-sm"
                style={{ backgroundColor: (warna[transfer ? opsi.kode_1 : opsi.kode_trayek] ?? '#1A936F') + '30' }}
              >
                🚐
              </span>
              <div className="min-w-0 pt-0.5">
                {isStep1 && (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                    Di Dalam Angkot
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-dark">Naik Angkot</span>
                  <KodeBadge kode={transfer ? opsi.kode_1 : opsi.kode_trayek} warna={warna[transfer ? opsi.kode_1 : opsi.kode_trayek]} size="sm" />
                </div>
                <p className="mt-0.5 text-xs text-dark/65">
                  Arah {transfer ? opsi.arah_1 : opsi.arah} · ±{jarak(transfer ? opsi.jarak_angkot_1_m : opsi.jarak_angkot_m)} (±{menitAngkot(transfer ? opsi.jarak_angkot_1_m : opsi.jarak_angkot_m)} mnt)
                </p>
              </div>
            </div>

            {/* Jika Transfer: Titik Pindah & Angkot 2 */}
            {transfer && (
              <>
                <div className={`relative flex items-start gap-3.5 pl-1 transition-all ${isStep2 ? 'rounded-xl bg-emerald-50/80 p-2 -ml-1 ring-1 ring-emerald-500/30' : ''}`}>
                  <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#A586FF]/20 text-sm shadow-sm">
                    🔁
                  </span>
                  <div className="min-w-0 pt-0.5">
                    {isStep2 && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                        Transit di Sini
                      </span>
                    )}
                    <p className="text-sm font-bold text-[#6D42C7]">Titik Transit / Pindah</p>
                    <p className="mt-0.5 text-xs text-dark/65">
                      Turun di halte/titik pindah, lanjut ke angkot berikutnya
                    </p>
                  </div>
                </div>

                <div className={`relative flex items-start gap-3.5 pl-1 transition-all ${isStep3 ? 'rounded-xl bg-emerald-50/80 p-2 -ml-1 ring-1 ring-emerald-500/30' : ''}`}>
                  <span
                    className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm shadow-sm"
                    style={{ backgroundColor: (warna[opsi.kode_2] ?? '#1A936F') + '30' }}
                  >
                    🚐
                  </span>
                  <div className="min-w-0 pt-0.5">
                    {isStep3 && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                        Di Dalam Angkot
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-dark">Naik Angkot</span>
                      <KodeBadge kode={opsi.kode_2} warna={warna[opsi.kode_2]} size="sm" />
                    </div>
                    <p className="mt-0.5 text-xs text-dark/65">
                      Arah {opsi.arah_2} · ±{jarak(opsi.jarak_angkot_2_m)} (±{menitAngkot(opsi.jarak_angkot_2_m)} mnt)
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Jalan kaki ke tujuan */}
            <div className={`relative flex items-start gap-3.5 pl-1 transition-all ${isStepAkhir ? 'rounded-xl bg-emerald-50/80 p-2 -ml-1 ring-1 ring-emerald-500/30' : ''}`}>
              <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#EAF4EE] text-sm shadow-sm">
                🚶
              </span>
              <div className="min-w-0 pt-0.5">
                {isStepAkhir && (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                    Menuju Tujuan
                  </span>
                )}
                <p className="text-sm text-dark/80">
                  Turun dari angkot, jalan kaki <strong className="text-dark">{jarak(opsi.jalan_dari_turun_m)}</strong> (±{menitJalan(opsi.jalan_dari_turun_m)} mnt)
                </p>
              </div>
            </div>

            {/* Titik Tujuan */}
            <div className="relative flex items-start gap-3.5 pl-1">
              <span
                className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: WARNA_TUJUAN }}
              >
                B
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-semibold text-dark/50">Tiba di Tujuan</p>
                <p className="text-sm font-bold leading-snug text-dark">{tujuan?.nama || 'Lokasi tujuan'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tautan Jalur */}
        <div className="mt-5 border-t border-[#EDF1F2] pt-4">
          <p className="mb-2 text-xs font-semibold text-dark/60">Eksplorasi Jalur Angkot:</p>
          <div className="flex flex-wrap gap-2">
            {(transfer ? [opsi.kode_1, opsi.kode_2] : [opsi.kode_trayek]).map((k) => (
              <Link
                key={k}
                to={`/rute/${nomor(k)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-nav bg-white px-3 py-1.5 text-xs font-semibold text-dark/80 transition hover:bg-mist hover:text-primary"
              >
                <span>Lihat rute Trayek {nomor(k)}</span>
                <span className="font-bold text-primary">→</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="h-4 shrink-0" aria-hidden="true" />
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
