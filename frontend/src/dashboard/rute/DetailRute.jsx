import { jarak, menitAngkot, rupiah } from '../../utils/format'
import { Card, CardHeader, Floating, KodeBadge, Muat, PilWarga } from '../ui'
import { IconPause, IconPin, IconPlay, IconSwap } from '../icons'
import JalurRute from './JalurRute'

// Panel Detail Rute (kanan): ringkasan, arah, jalur, tombol simulasi & tampilkan di peta.
export default function DetailRute({
  fitur,
  detail,
  bisaBalik,
  onBalik,
  onTampilkan,
  onMulaiSimulasi,
  onHentikanSimulasi,
  onPilihTitik,
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
