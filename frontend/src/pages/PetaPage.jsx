import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GeoJSON } from 'react-leaflet'
import AppShell, { KodeBadge, PanelSection, Status } from '../components/app/AppShell'
import BaseMap, { FitToGeoJSON, MapCard } from '../components/map/BaseMap'
import { api } from '../api/naik'
import useApi from '../hooks/useApi'
import { KEPADATAN, URUTAN_KEPADATAN, esc, jarak, nomor } from '../utils/format'

// Halaman Peta Kepadatan: ruas jalan diwarnai menurut jumlah trayek yang melintas.
export default function PetaPage() {
  const [ulang, setUlang] = useState(0)
  const kepadatan = useApi(() => api.kepadatan(), [ulang])
  const ringkasan = useApi(() => api.ringkasan(), [ulang])
  const trayek = useApi(() => api.trayek(), [ulang])

  const [tampil, setTampil] = useState({ Tinggi: true, Sedang: true, Rendah: true })
  const [kode, setKode] = useState('')
  const rute = useApi(kode ? () => api.rute(kode) : null, [kode])

  const dataTampil = useMemo(() => {
    if (!kepadatan.data) return null
    return {
      ...kepadatan.data,
      features: kepadatan.data.features.filter((f) => tampil[f.properties.tingkat]),
    }
  }, [kepadatan.data, tampil])

  const kelas = Object.fromEntries((ringkasan.data?.kelas ?? []).map((k) => [k.tingkat, k]))
  const totalKm = Object.values(kelas).reduce((s, k) => s + Number(k.km), 0)
  const trayekDipilih = trayek.data?.find((t) => t.kode_trayek === kode)

  const panel = (
    <>
      <PanelSection>
        <h1 className="font-display text-2xl font-bold text-tentang-dark">Peta Kepadatan Trayek</h1>
        <p className="mt-1 text-sm leading-relaxed text-dark/70">
          Ruas jalan diwarnai menurut jumlah trayek angkot yang melintas. Makin banyak trayek bertumpuk, makin
          berpotensi memicu kemacetan.
        </p>
      </PanelSection>

      <Status loading={ringkasan.loading} error={ringkasan.error} onRetry={() => setUlang((x) => x + 1)} />

      {ringkasan.data && (
        <PanelSection title="Tingkat kepadatan" action={<span className="text-xs text-dark/60">klik untuk tampil/sembunyi</span>}>
          <div className="grid grid-cols-3 gap-2">
            {URUTAN_KEPADATAN.map((t) => {
              const k = kelas[t]
              const aktif = tampil[t]
              return (
                <button
                  key={t}
                  onClick={() => setTampil((s) => ({ ...s, [t]: !s[t] }))}
                  aria-pressed={aktif}
                  className={`rounded-xl border p-3 text-left transition ${aktif ? 'border-transparent shadow-sm' : 'border-border-nav opacity-45'}`}
                  style={aktif ? { backgroundColor: KEPADATAN[t].warna + '1F' } : undefined}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-dark/80">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: KEPADATAN[t].warna }} />
                    {t}
                  </span>
                  <span className="mt-1 block font-display text-xl font-bold">{k ? Number(k.km).toLocaleString('id-ID') : '0'}<span className="text-sm font-semibold"> km</span></span>
                  <span className="block text-[11px] text-dark/60">{KEPADATAN[t].ket}</span>
                </button>
              )
            })}
          </div>
          {totalKm > 0 && (
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-mist" aria-hidden="true">
              {URUTAN_KEPADATAN.map((t) => (
                <span key={t} style={{ width: `${(Number(kelas[t]?.km ?? 0) / totalKm) * 100}%`, backgroundColor: KEPADATAN[t].warna }} />
              ))}
            </div>
          )}
        </PanelSection>
      )}

      <PanelSection title="Sorot satu trayek">
        <select
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          className="w-full rounded-xl border border-border-nav bg-white px-3 py-2.5 text-sm focus:outline-2 focus:outline-primary"
        >
          <option value="">— Semua trayek (tanpa sorotan) —</option>
          {trayek.data?.map((t) => (
            <option key={t.kode_trayek} value={t.kode_trayek}>
              {nomor(t.kode_trayek)} · {t.nama_trayek}
            </option>
          ))}
        </select>
        {trayekDipilih && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F4FAF8] p-3">
            <KodeBadge kode={trayekDipilih.kode_trayek} warna={trayekDipilih.warna} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold">{trayekDipilih.nama_trayek}</p>
              <p className="text-dark/60">{rute.data ? `${rute.data.features.length} arah` : 'memuat…'}</p>
            </div>
            <Link to={`/rute/${nomor(trayekDipilih.kode_trayek)}`} className="text-sm font-semibold text-primary hover:underline">
              Detail
            </Link>
          </div>
        )}
      </PanelSection>

      {ringkasan.data?.jalan_terpadat?.length > 0 && (
        <PanelSection title="Jalan paling padat trayek">
          <ol className="space-y-1.5">
            {ringkasan.data.jalan_terpadat.map((j, i) => (
              <li key={j.nama_jalan} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right font-display font-bold text-dark/40">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{j.nama_jalan}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: j.maks_trayek >= 4 ? KEPADATAN.Tinggi.warna : KEPADATAN.Sedang.warna }}
                  title="jumlah trayek maksimum di satu ruas"
                >
                  {j.maks_trayek} trayek
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-dark/50">Diurutkan dari jumlah trayek terbanyak di satu ruas.</p>
        </PanelSection>
      )}

      <p className="px-5 py-4 text-xs leading-relaxed text-dark/50">
        Sumber: Daftar Trayek Angkot Kota Bogor 2025, jaringan jalan OpenStreetMap. Kepadatan dihitung per ruas jalan
        (buffer 5 m, ruas tercakup ≥ 80%).
      </p>
    </>
  )

  const map = (
    <BaseMap>
      {dataTampil && (
        <GeoJSON
          key={`kep-${URUTAN_KEPADATAN.filter((t) => tampil[t]).join()}-${kode ? 'redup' : ''}`}
          data={dataTampil}
          style={(f) => ({
            color: KEPADATAN[f.properties.tingkat]?.warna ?? '#999',
            weight: KEPADATAN[f.properties.tingkat]?.tebal ?? 2,
            opacity: kode ? 0.35 : 0.9,
            lineCap: 'round',
          })}
          onEachFeature={(f, layer) => {
            const p = f.properties
            layer.bindPopup(
              `<div style="font-family:inherit;min-width:180px">
                <strong>${esc(p.nama_jalan)}</strong><br/>
                <span style="color:${KEPADATAN[p.tingkat]?.warna};font-weight:700">${p.tingkat}</span>
                · ${p.jumlah_trayek} trayek · ${jarak(p.panjang_m)}<br/>
                <small>${esc(p.trayek)}</small>
              </div>`,
            )
          }}
        />
      )}
      {rute.data && (
        <>
          <GeoJSON key={`rute-${kode}-putih`} data={rute.data} style={() => ({ color: '#fff', weight: 9, opacity: 0.9 })} interactive={false} />
          <GeoJSON
            key={`rute-${kode}`}
            data={rute.data}
            style={(f) => ({ color: f.properties.warna, weight: 5, opacity: 1 })}
            onEachFeature={(f, layer) =>
              layer.bindPopup(`<strong>${esc(f.properties.kode_trayek)}</strong><br/>${esc(f.properties.arah)} · ${jarak(f.properties.panjang_m)}`)
            }
          />
          <FitToGeoJSON data={rute.data} />
        </>
      )}
      <MapCard>
        <p className="mb-1.5 text-xs font-bold text-dark/80">Kepadatan trayek</p>
        {URUTAN_KEPADATAN.map((t) => (
          <p key={t} className="flex items-center gap-2 text-xs text-dark/80">
            <span className="inline-block w-6 rounded-full" style={{ height: KEPADATAN[t].tebal + 1, backgroundColor: KEPADATAN[t].warna }} />
            {t} <span className="text-dark/50">({KEPADATAN[t].ket})</span>
          </p>
        ))}
      </MapCard>
      {kepadatan.loading && (
        <MapCard position="top-left">
          <p className="text-xs font-semibold">Memuat ruas jalan…</p>
        </MapCard>
      )}
    </BaseMap>
  )

  return <AppShell panel={panel} map={map} />
}
