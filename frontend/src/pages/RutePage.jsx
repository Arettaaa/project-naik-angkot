import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CircleMarker, GeoJSON, Tooltip } from 'react-leaflet'
import AppShell, { KodeBadge, PanelSection, Status } from '../components/app/AppShell'
import BaseMap, { FitToGeoJSON, MapCard } from '../components/map/BaseMap'
import { api } from '../api/naik'
import useApi from '../hooks/useApi'
import { esc, jarak, nomor, rupiah } from '../utils/format'

// Halaman Rute: daftar 30 trayek + detail (arah, halte/lintasan, urutan jalan, tarif).
export default function RutePage() {
  const { kode } = useParams()
  return kode ? <DetailTrayek kode={kode} /> : <DaftarTrayek />
}

function DaftarTrayek() {
  const navigate = useNavigate()
  const [ulang, setUlang] = useState(0)
  const trayek = useApi(() => api.trayek(), [ulang])
  const semua = useApi(() => api.rute(), [ulang])
  const [cari, setCari] = useState('')

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (!trayek.data) return []
    if (!q) return trayek.data
    return trayek.data.filter(
      (t) =>
        t.kode_trayek.toLowerCase().includes(q) ||
        t.nama_trayek.toLowerCase().includes(q) ||
        t.arah.some((a) => `${a.asal} ${a.tujuan}`.toLowerCase().includes(q)),
    )
  }, [trayek.data, cari])

  const panel = (
    <>
      <PanelSection>
        <h1 className="font-display text-2xl font-bold text-tentang-dark">Rute Angkot Kota Bogor</h1>
        <p className="mt-1 text-sm text-dark/70">{trayek.data ? `${trayek.data.length} trayek, masing-masing 2 arah.` : 'Memuat…'} Pilih trayek untuk melihat jalurnya.</p>
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nomor, nama tempat, mis. 08 atau Bubulak"
          className="mt-3 w-full rounded-xl border border-border-nav px-3 py-2.5 text-sm focus:outline-2 focus:outline-primary"
        />
      </PanelSection>
      <Status loading={trayek.loading} error={trayek.error} onRetry={() => setUlang((x) => x + 1)} />
      <ul>
        {hasil.map((t) => (
          <li key={t.kode_trayek}>
            <Link
              to={`/rute/${nomor(t.kode_trayek)}`}
              className="flex items-center gap-3 border-b border-border-nav px-5 py-3 transition-colors hover:bg-[#F4FAF8]"
            >
              <KodeBadge kode={t.kode_trayek} warna={t.warna} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{t.nama_trayek}</span>
                <span className="block text-xs text-dark/60">{rupiah(t.tarif)} · {t.arah.length} arah</span>
              </span>
              <span aria-hidden="true" className="text-dark/30">›</span>
            </Link>
          </li>
        ))}
        {trayek.data && hasil.length === 0 && <li className="px-5 py-6 text-sm text-dark/60">Tidak ada trayek yang cocok dengan “{cari}”.</li>}
      </ul>
    </>
  )

  const map = (
    <BaseMap>
      {semua.data && (
        <GeoJSON
          data={semua.data}
          style={(f) => ({ color: f.properties.warna, weight: 3, opacity: 0.75 })}
          onEachFeature={(f, layer) => {
            layer.bindTooltip(`${esc(f.properties.kode_trayek)} · ${esc(f.properties.arah)}`, { sticky: true })
            layer.on('click', () => navigate(`/rute/${nomor(f.properties.kode_trayek)}`))
          }}
        />
      )}
      <MapCard>
        <p className="text-xs text-dark/70">Klik garis untuk membuka trayek</p>
      </MapCard>
    </BaseMap>
  )

  return <AppShell panel={panel} map={map} />
}

function DetailTrayek({ kode }) {
  const [ulang, setUlang] = useState(0)
  const detail = useApi(() => api.detailTrayek(kode), [kode, ulang])
  const rute = useApi(() => api.rute(kode), [kode, ulang])
  const [pilih, setPilih] = useState(0)

  const d = detail.data
  const idx = d && pilih < d.rute.length ? pilih : 0
  const r = d?.rute[idx]
  const fitur = rute.data?.features.find((f) => f.properties.rute_id === r?.rute_id)
  const ujung = useMemo(() => {
    const c = fitur?.geometry?.coordinates
    if (!c?.length) return null
    const garis = fitur.geometry.type === 'MultiLineString' ? c.flat() : c
    return { awal: [garis[0][1], garis[0][0]], akhir: [garis.at(-1)[1], garis.at(-1)[0]] }
  }, [fitur])

  const panel = (
    <>
      <div className="border-b border-border-nav px-5 py-3">
        <Link to="/rute" className="text-sm font-semibold text-primary hover:underline">‹ Semua trayek</Link>
      </div>
      <Status loading={detail.loading} error={detail.error} onRetry={() => setUlang((x) => x + 1)} />
      {d && r && (
        <>
          <PanelSection>
            <div className="flex items-start gap-3">
              <KodeBadge kode={d.kode_trayek} warna={d.warna} />
              <div className="min-w-0">
                <h1 className="font-display text-xl font-bold leading-tight text-tentang-dark">{r.nama_trayek}</h1>
                <p className="mt-1 text-sm text-dark/60">{d.kode_trayek}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Info label="Tarif" value={rupiah(d.tarif)} />
              <Info label="Panjang" value={jarak(r.panjang_m)} />
              <Info label="Arah" value={d.rute.length} />
            </div>
            {d.keterangan_tarif && <p className="mt-2 text-xs text-dark/50">Tarif: {d.keterangan_tarif}</p>}
          </PanelSection>

          <PanelSection title="Pilih arah">
            <div className="flex flex-col gap-2">
              {d.rute.map((x, i) => (
                <button
                  key={x.rute_id}
                  onClick={() => setPilih(i)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    i === idx ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border-nav hover:bg-[#F4FAF8]'
                  }`}
                >
                  {x.asal} → {x.tujuan}
                </button>
              ))}
            </div>
          </PanelSection>

          <PanelSection title="Lintasan (sesuai daftar trayek)">
            <ol className="relative ml-2 border-l-2 border-dashed border-primary/40">
              {r.halte.map((h, i) => (
                <li key={i} className="relative pb-2.5 pl-5 text-sm last:pb-0">
                  <span
                    className={`absolute top-1 -left-[7px] h-3 w-3 rounded-full border-2 border-white ${
                      i === 0 ? 'bg-primary' : i === r.halte.length - 1 ? 'bg-[#E5484D]' : 'bg-primary/50'
                    }`}
                  />
                  <span className={i === 0 || i === r.halte.length - 1 ? 'font-semibold' : ''}>{h}</span>
                </li>
              ))}
            </ol>
          </PanelSection>

          {r.urutan_jalan?.length > 0 && (
            <PanelSection title="Jalan yang dilewati">
              <p className="text-sm leading-relaxed text-dark/80">{r.urutan_jalan.join(' → ')}</p>
              <p className="mt-2 text-xs text-dark/50">Dari jaringan jalan OpenStreetMap, ruas pendek &lt; 40 m tidak ditampilkan.</p>
            </PanelSection>
          )}

          <div className="px-5 py-4">
            <Link
              to="/cari"
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Cari rute dari/ke lokasimu
            </Link>
            <p className="mt-3 text-xs text-dark/50">Sumber: {r.sumber}</p>
          </div>
        </>
      )}
    </>
  )

  const map = (
    <BaseMap>
      {rute.data && (
        <>
          <GeoJSON
            key={`lain-${kode}-${idx}`}
            data={{ ...rute.data, features: rute.data.features.filter((f) => f !== fitur) }}
            style={(f) => ({ color: f.properties.warna, weight: 3, opacity: 0.35, dashArray: '6 6' })}
            interactive={false}
          />
          {fitur && (
            <>
              <GeoJSON key={`p-${kode}-${idx}-w`} data={fitur} style={() => ({ color: '#fff', weight: 9 })} interactive={false} />
              <GeoJSON key={`p-${kode}-${idx}`} data={fitur} style={() => ({ color: fitur.properties.warna, weight: 5 })} interactive={false} />
            </>
          )}
          <FitToGeoJSON data={rute.data} />
        </>
      )}
      {ujung && r && (
        <>
          <CircleMarker center={ujung.awal} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1A936F', fillOpacity: 1 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>{r.asal}</Tooltip>
          </CircleMarker>
          <CircleMarker center={ujung.akhir} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#E5484D', fillOpacity: 1 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>{r.tujuan}</Tooltip>
          </CircleMarker>
        </>
      )}
      <MapCard>
        <p className="flex items-center gap-2 text-xs"><span className="inline-block h-1 w-6 rounded-full" style={{ backgroundColor: d?.warna }} /> arah dipilih</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-dark/60"><span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: d?.warna }} /> arah sebaliknya</p>
      </MapCard>
    </BaseMap>
  )

  return <AppShell panel={panel} map={map} />
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F4FAF8] px-2 py-2.5">
      <p className="text-[11px] text-dark/60">{label}</p>
      <p className="font-display text-base font-bold">{value}</p>
    </div>
  )
}
