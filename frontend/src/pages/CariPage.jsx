import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleMarker, GeoJSON, Polyline, Tooltip } from 'react-leaflet'
import AppShell, { KodeBadge, PanelSection } from '../components/app/AppShell'
import BaseMap, { FitToPoints, MapCard } from '../components/map/BaseMap'
import { api } from '../api/naik'
import useApi from '../hooks/useApi'
import { TEMPAT } from '../data/tempat'
import { jarak, menitAngkot, menitJalan, nomor, rupiah } from '../utils/format'

const WARNA_ASAL = '#38BDF8'
const WARNA_TUJUAN = '#FFAB2E'

// Halaman Cari Rute: pilih asal & tujuan -> rekomendasi angkot langsung / 1x transfer + tarif.
export default function CariPage() {
  const trayek = useApi(() => api.trayek(), [])
  const warna = useMemo(() => Object.fromEntries((trayek.data ?? []).map((t) => [t.kode_trayek, t.warna])), [trayek.data])

  const [asal, setAsal] = useState(null)
  const [tujuan, setTujuan] = useState(null)
  const [mode, setMode] = useState('asal') // titik mana yang diisi saat peta diklik
  const [radius, setRadius] = useState(400)
  const [hasil, setHasil] = useState({ data: null, loading: false, error: null })
  const [pilih, setPilih] = useState(null) // {jenis:'langsung'|'transfer', i}
  const [lokasiErr, setLokasiErr] = useState('')

  function setTitik(jenis, titik) {
    if (jenis === 'asal') setAsal(titik)
    else setTujuan(titik)
    setHasil({ data: null, loading: false, error: null })
    setPilih(null)
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
    try {
      const data = await api.rekomendasi(asal, tujuan, radius)
      setHasil({ data, loading: false, error: null })
      if (data.langsung.length) setPilih({ jenis: 'langsung', i: 0 })
      else if (data.transfer.length) setPilih({ jenis: 'transfer', i: 0 })
    } catch (error) {
      setHasil({ data: null, loading: false, error })
    }
  }

  function tukar() {
    setAsal(tujuan)
    setTujuan(asal)
    setHasil({ data: null, loading: false, error: null })
    setPilih(null)
  }

  const opsi = pilih && hasil.data ? hasil.data[pilih.jenis][pilih.i] : null

  const panel = (
    <>
      <PanelSection>
        <h1 className="font-display text-2xl font-bold text-tentang-dark">Cari Rute Angkot</h1>
        <p className="mt-1 text-sm text-dark/70">Tentukan titik asal dan tujuan, lalu NAIK carikan angkot langsung atau dengan 1x pindah.</p>
      </PanelSection>

      <PanelSection>
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

        <label className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-dark/70">Maks. jalan kaki ke jalur</span>
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="rounded-lg border border-border-nav px-2 py-1.5 text-sm"
          >
            {[200, 400, 600, 800, 1000].map((r) => (
              <option key={r} value={r}>{r} m</option>
            ))}
          </select>
        </label>

        <button
          onClick={cari}
          disabled={!asal || !tujuan || hasil.loading}
          className="mt-4 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {hasil.loading ? 'Mencari…' : 'Cari rute'}
        </button>
        {(!asal || !tujuan) && (
          <p className="mt-2 text-center text-xs text-dark/50">
            Pilih dari daftar, atau klik peta untuk mengisi titik <strong>{mode === 'asal' ? 'asal' : 'tujuan'}</strong>.
          </p>
        )}
      </PanelSection>

      {hasil.error && (
        <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{hasil.error.message}</div>
      )}

      {hasil.data && (
        <Hasil data={hasil.data} warna={warna} pilih={pilih} setPilih={setPilih} radius={radius} />
      )}
    </>
  )

  const titikFit = opsi
    ? [asal, tujuan].map((t) => [t.lat, t.lng]).concat(garisOpsi(opsi).flat())
    : [asal, tujuan].filter(Boolean).map((t) => [t.lat, t.lng])

  const map = (
    <BaseMap onClick={klikPeta} className={mode ? 'cursor-crosshair' : ''}>
      {opsi && <RuteOpsi opsi={opsi} warna={warna} asal={asal} tujuan={tujuan} />}
      {asal && <Penanda titik={asal} warna={WARNA_ASAL} label="Asal" />}
      {tujuan && <Penanda titik={tujuan} warna={WARNA_TUJUAN} label="Tujuan" />}
      <FitToPoints points={titikFit} />
      <MapCard position="top-left">
        <p className="text-xs font-semibold">
          Klik peta untuk mengisi{' '}
          <span style={{ color: mode === 'asal' ? WARNA_ASAL : WARNA_TUJUAN }}>{mode === 'asal' ? 'ASAL' : 'TUJUAN'}</span>
        </p>
      </MapCard>
    </BaseMap>
  )

  return <AppShell panel={panel} map={map} />
}

function TitikInput({ label, warna, titik, aktif, onAktif, onPilih, extra }) {
  return (
    <div className={`rounded-xl border p-3 transition ${aktif ? 'border-primary ring-2 ring-primary/15' : 'border-border-nav'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-dark/70">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: warna }} />
          {label}
        </span>
        {extra}
      </div>
      <select
        value={TEMPAT.find((t) => titik && t.lat === titik.lat && t.lng === titik.lng)?.nama ?? ''}
        onFocus={onAktif}
        onChange={(e) => {
          const t = TEMPAT.find((x) => x.nama === e.target.value)
          if (t) onPilih(t)
        }}
        className="w-full rounded-lg border border-border-nav bg-white px-2.5 py-2 text-sm"
      >
        <option value="">{titik ? `${titik.nama} (${titik.lat.toFixed(4)}, ${titik.lng.toFixed(4)})` : 'Pilih tempat…'}</option>
        {TEMPAT.map((t) => (
          <option key={t.nama} value={t.nama}>{t.nama}</option>
        ))}
      </select>
      <button onClick={onAktif} className={`mt-2 text-xs font-semibold ${aktif ? 'text-primary' : 'text-dark/60 hover:text-primary'}`}>
        {aktif ? '● Klik peta untuk memilih titik' : 'Pilih di peta'}
      </button>
    </div>
  )
}

function Hasil({ data, warna, pilih, setPilih, radius }) {
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
            {data.langsung.map((o, i) => (
              <KartuOpsi key={o.rute_id} aktif={pilih?.jenis === 'langsung' && pilih.i === i} onClick={() => setPilih({ jenis: 'langsung', i })}>
                <div className="flex items-center gap-2">
                  <KodeBadge kode={o.kode_trayek} warna={warna[o.kode_trayek]} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{o.arah}</span>
                  <span className="font-display font-bold text-primary">{rupiah(o.tarif)}</span>
                </div>
                <Ringkas jalan={o.jalan_ke_naik_m + o.jalan_dari_turun_m} angkot={o.jarak_angkot_m} />
              </KartuOpsi>
            ))}
          </div>
        </PanelSection>
      )}
      {data.transfer.length > 0 && (
        <PanelSection title="1x pindah · 2 angkot">
          <div className="space-y-2">
            {data.transfer.map((o, i) => (
              <KartuOpsi key={`${o.kode_1}-${o.kode_2}`} aktif={pilih?.jenis === 'transfer' && pilih.i === i} onClick={() => setPilih({ jenis: 'transfer', i })}>
                <div className="flex items-center gap-2">
                  <KodeBadge kode={o.kode_1} warna={warna[o.kode_1]} size="sm" />
                  <span className="text-dark/40">→</span>
                  <KodeBadge kode={o.kode_2} warna={warna[o.kode_2]} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-xs text-dark/60">pindah 1x</span>
                  <span className="font-display font-bold text-primary">{rupiah(o.tarif)}</span>
                </div>
                <Ringkas jalan={o.jalan_ke_naik_m + o.jalan_dari_turun_m} angkot={o.jarak_angkot_1_m + o.jarak_angkot_2_m} />
              </KartuOpsi>
            ))}
          </div>
        </PanelSection>
      )}
      {pilih && <Langkah opsi={data[pilih.jenis][pilih.i]} warna={warna} />}
      <p className="px-5 py-4 text-xs leading-relaxed text-dark/50">
        Tarif asumsi Rp5.000 per angkot. Waktu perkiraan (jalan kaki 4,5 km/jam, angkot 15 km/jam). Jarak jalan kaki = garis lurus ke jalur.
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

function Langkah({ opsi, warna }) {
  const transfer = 'kode_1' in opsi
  const langkah = transfer
    ? [
        { ikon: '🚶', teks: `Jalan kaki ${jarak(opsi.jalan_ke_naik_m)} ke jalur ${nomor(opsi.kode_1)}` },
        { ikon: '🚐', kode: opsi.kode_1, teks: `Naik ${opsi.kode_1} (${opsi.arah_1}), ±${jarak(opsi.jarak_angkot_1_m)}` },
        { ikon: '🔁', teks: `Turun di titik pindah, lanjut naik ${opsi.kode_2}` },
        { ikon: '🚐', kode: opsi.kode_2, teks: `Naik ${opsi.kode_2} (${opsi.arah_2}), ±${jarak(opsi.jarak_angkot_2_m)}` },
        { ikon: '🚶', teks: `Turun, jalan kaki ${jarak(opsi.jalan_dari_turun_m)} ke tujuan` },
      ]
    : [
        { ikon: '🚶', teks: `Jalan kaki ${jarak(opsi.jalan_ke_naik_m)} ke jalur ${nomor(opsi.kode_trayek)}` },
        { ikon: '🚐', kode: opsi.kode_trayek, teks: `Naik ${opsi.kode_trayek} (${opsi.arah}), ±${jarak(opsi.jarak_angkot_m)}` },
        { ikon: '🚶', teks: `Turun, jalan kaki ${jarak(opsi.jalan_dari_turun_m)} ke tujuan` },
      ]
  return (
    <PanelSection title="Langkah perjalanan">
      <ol className="space-y-2.5">
        {langkah.map((l, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm" style={{ backgroundColor: l.kode ? (warna[l.kode] ?? '#1A936F') + '26' : '#EAF4EE' }}>
              {l.ikon}
            </span>
            <span className="pt-1">{l.teks}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm">
        Total ongkos: <strong className="font-display text-primary">{rupiah(opsi.tarif)}</strong>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(transfer ? [opsi.kode_1, opsi.kode_2] : [opsi.kode_trayek]).map((k) => (
          <Link key={k} to={`/rute/${nomor(k)}`} className="rounded-full border border-border-nav px-3 py-1 text-xs font-semibold hover:bg-mist">
            Lihat jalur {nomor(k)}
          </Link>
        ))}
      </div>
    </PanelSection>
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
