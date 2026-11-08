import { useEffect, useState } from 'react'
import { api } from '../../api/naik'
import { jarak, menitAngkot, rupiah } from '../../utils/format'
import { Card, CardHeader, Floating, KodeBadge, Muat, PilWarga } from '../ui'
import { IconPause, IconPin, IconPlay, IconSwap } from '../icons'
import JalurRute from './JalurRute'

const KATEGORI_KORIDOR = [
  { id: '', label: 'Semua' },
  { id: 'kuliner', label: 'Kuliner' },
  { id: 'wisata', label: 'Wisata' },
  { id: 'belanja', label: 'Belanja' },
  { id: 'pendidikan', label: 'Pendidikan' },
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'transportasi', label: 'Transportasi' },
]

// Panel Detail Rute (kanan): ringkasan, arah, jalur, rekomendasi koridor berdasarkan arah angkot, tombol simulasi & tampilkan di peta.
export default function DetailRute({
  fitur,
  detail,
  bisaBalik,
  onBalik,
  onTampilkan,
  onMulaiSimulasi,
  onHentikanSimulasi,
  onPilihTitik,
  onPilihPoi,
  poiAktifId,
  simulasiAktif,
  onClose,
}) {
  const p = fitur.properties
  const arah = detail.data?.rute.find((r) => r.rute_id === p.rute_id)
  const panjang = Number(arah?.panjang_m ?? p.panjang_m) || null
  const ringkas = [
    ['Panjang', panjang ? jarak(panjang) : '-'],
    ['Waktu', panjang ? `±${menitAngkot(panjang)} mnt` : '-'],
    ['Tarif', rupiah(p.tarif ?? detail.data?.tarif)],
  ]

  const [kategori, setKategori] = useState('')
  const [koridor, setKoridor] = useState({ data: null, loading: false, error: null })

  useEffect(() => {
    if (!p.kode_trayek) return
    let aktif = true
    setKoridor((s) => ({ ...s, loading: true, error: null }))
    api
      .rekomendasiKoridor(p.kode_trayek, {
        rute_id: p.rute_id,
        radius: 300,
        kategori: kategori || undefined,
        limit: 20,
      })
      .then((data) => {
        if (aktif) setKoridor({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (aktif) setKoridor({ data: null, loading: false, error })
      })
    return () => {
      aktif = false
    }
  }, [p.kode_trayek, p.rute_id, kategori])

  return (
    <Floating className="right-3.5 bottom-24 left-3.5 flex max-h-[48%] flex-col lg:top-3 lg:bottom-auto lg:left-auto lg:max-h-[calc(100%-24px)] lg:w-[372px]">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader title="Detail Rute" onClose={onClose} />
        <div className="naik-scroll min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-4 lg:px-6">
          <div className="flex items-center gap-3">
            <KodeBadge kode={p.kode_trayek} warna={p.warna} size="lg" />
            <div className="min-w-0">
              <p className="font-display text-[16.5px] leading-snug font-bold text-dark">
                {p.asal} → {p.tujuan}
              </p>
              <p className="flex items-center gap-1.5 text-[12.5px] text-dark/55">
                {p.arah && <span className="truncate">{p.arah}</span>}
                <PilWarga kode={p.kode_trayek} />
              </p>
            </div>
          </div>

          <dl className="mt-3.5 grid grid-cols-3 gap-1 rounded-2xl bg-[#F6F9F9] px-2 py-2.5 text-center">
            {ringkas.map(([l, v]) => (
              <div key={l}>
                <dt className="text-[11px] text-dark/50">{l}</dt>
                <dd className="mt-0.5 text-[13.5px] font-bold text-dark">{v}</dd>
              </div>
            ))}
          </dl>

          {bisaBalik && (
            <button
              onClick={onBalik}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E3E8EA] px-3 py-1.5 text-[13px] font-semibold text-dark/70 hover:bg-[#F6F9F9]"
            >
              <IconSwap className="h-4 w-4" /> Lihat arah sebaliknya
            </button>
          )}

          <p className="mt-5 text-[14px] font-semibold text-tentang-dark">Jalur yang dilewati</p>
          <p className="text-[12px] text-dark/50">Klik nama jalan untuk melihatnya di peta.</p>
          <Muat loading={detail.loading} error={detail.error} />
          {arah && <JalurRute halte={arah.halte} warna={p.warna} onPilih={onPilihTitik} />}
          {arah?.urutan_jalan?.length > 0 && (
            <details className="mt-4 rounded-2xl bg-[#F6F9F9] px-4 py-3 text-[13px]">
              <summary className="cursor-pointer font-semibold text-dark/80">Semua ruas jalan ({arah.urutan_jalan.length})</summary>
              <p className="mt-2 leading-relaxed text-dark/70">{arah.urutan_jalan.join(' → ')}</p>
            </details>
          )}

          {/* Rekomendasi Tempat Singgah Berdasarkan Arah Angkot (GET /api/rekomendasi/koridor/{kode}) */}
          <div className="mt-5 border-t border-[#EDF1F2] pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-tentang-dark">Rekomendasi tempat di jalur ini</p>
              {koridor.data?.total_poi != null && !koridor.loading && (
                <span className="rounded-full bg-[#EAF4EE] px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {koridor.data.total_poi} tempat
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-dark/50">
              Tempat singgah (±300 m) di sepanjang arah {p.asal} → {p.tujuan}.
            </p>

            <div className="naik-scroll mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
              {KATEGORI_KORIDOR.map((k) => {
                const aktif = kategori === k.id
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKategori(k.id)}
                    className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                      aktif
                        ? 'bg-primary text-white'
                        : 'border border-[#E3E8EA] bg-white text-dark/65 hover:bg-[#F6F9F9]'
                    }`}
                  >
                    {k.label}
                  </button>
                )
              })}
            </div>

            {koridor.loading && (
              <p className="mt-3 text-[12.5px] text-dark/50">Memuat rekomendasi tempat…</p>
            )}
            {koridor.error && (
              <p className="mt-3 text-[12.5px] text-red-700">Gagal memuat rekomendasi tempat.</p>
            )}
            {!koridor.loading && !koridor.error && koridor.data && (
              koridor.data.poi?.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-[#F6F9F9] px-3.5 py-3 text-[12.5px] text-dark/55">
                  Belum ada tempat kategori ini dalam radius 300 m dari arah ini.
                </p>
              ) : (
                <ul className="mt-2.5 space-y-2">
                  {koridor.data.poi?.map((poi) => {
                    const aktif = poiAktifId === poi.poi_id
                    return (
                      <li key={poi.poi_id}>
                        <button
                          type="button"
                          onClick={() => onPilihPoi?.(poi)}
                          className={`flex w-full items-start justify-between gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition ${
                            aktif
                              ? 'border-primary bg-[#EAF4EE]/60'
                              : 'border-[#EDF1F2] bg-[#F6F9F9] hover:border-[#D5E2E4] hover:bg-[#F1F6F6]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-semibold text-dark">
                              {poi.nama}
                            </p>
                            {poi.alamat && (
                              <p className="mt-0.5 truncate text-[11.5px] text-dark/55">
                                {poi.alamat}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] font-medium text-primary">
                              {jarak(poi.jarak_ke_jalur_m)} dari jalur
                            </p>
                          </div>
                          {poi.kategori && (
                            <span className="shrink-0 rounded-full border border-[#E3E8EA] bg-white px-2.5 py-0.5 text-[10.5px] font-semibold capitalize text-dark/65">
                              {poi.kategori}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-[#EDF1F2] bg-white px-5 pt-3 pb-4 lg:px-6">
          <button
            onClick={simulasiAktif ? onHentikanSimulasi : onMulaiSimulasi}
            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[14.5px] font-semibold transition active:scale-[0.98] ${
              simulasiAktif
                ? 'border border-[#E3E8EA] bg-white text-dark/75 hover:bg-[#F6F9F9]'
                : 'bg-primary text-white shadow-[0_6px_16px_rgba(26,147,111,0.25)] hover:bg-[#178563]'
            }`}
          >
            {simulasiAktif ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
            {simulasiAktif ? 'Hentikan simulasi' : 'Simulasi angkot jalan'}
          </button>
          <button
            onClick={onTampilkan}
            title="Tampilkan seluruh rute di peta"
            aria-label="Tampilkan seluruh rute di peta"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E3E8EA] text-dark/70 transition hover:bg-[#F6F9F9]"
          >
            <IconPin className="h-5 w-5" />
          </button>
        </div>
      </Card>
    </Floating>
  )
}
