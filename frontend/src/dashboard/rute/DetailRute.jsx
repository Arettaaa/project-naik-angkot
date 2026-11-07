import { rupiah } from '../../utils/format'
import { Card, CardHeader, Floating, KodeBadge, Muat, PrimaryButton } from '../ui'
import { IconBus, IconPin, IconSwap } from '../icons'
import PetaMini from './PetaMini'
import JalurRute from './JalurRute'

// Panel Detail Rute (kanan): ringkasan, peta mini, arah, jalur, tombol Mulai Simulasi & Tampilkan di Peta.
export default function DetailRute({
  fitur,
  detail,
  bisaBalik,
  onBalik,
  onTampilkan,
  onMulaiSimulasi,
  onPilihTitik,
  simulasiAktif,
  onClose,
}) {
  const p = fitur.properties
  const arah = detail.data?.rute.find((r) => r.rute_id === p.rute_id)
  return (
    <Floating className="right-3.5 bottom-24 left-3.5 flex max-h-[48%] flex-col lg:top-3 lg:bottom-auto lg:left-auto lg:max-h-[calc(100%-250px)] lg:w-[372px]">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader title="Detail Rute" onClose={onClose} />
        <div className="naik-scroll min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-4 lg:px-6">
          <div className="flex items-center gap-3">
            <KodeBadge kode={p.kode_trayek} warna={p.warna} size="lg" />
            <div className="min-w-0">
              <p className="font-display text-[17px] leading-snug font-bold text-dark">
                {p.asal} → {p.tujuan}
              </p>
              <p className="text-[13px] text-dark/60">Tarif: {rupiah(p.tarif)}</p>
            </div>
          </div>

          <PetaMini fitur={fitur} />

          {bisaBalik && (
            <button
              onClick={onBalik}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E3E8EA] px-3 py-1.5 text-[13px] font-semibold text-dark/70 hover:bg-[#F6F9F9]"
            >
              <IconSwap className="h-4 w-4" /> Arah sebaliknya
            </button>
          )}

          <p className="mt-5 text-[14px] font-semibold text-tentang-dark">Jalur Rute</p>
          <Muat loading={detail.loading} error={detail.error} />
          {arah && <JalurRute halte={arah.halte} onPilih={onPilihTitik} />}
          {arah?.urutan_jalan?.length > 0 && (
            <details className="mt-4 rounded-2xl bg-[#F6F9F9] px-4 py-3 text-[13px]">
              <summary className="cursor-pointer font-semibold text-dark/80">Jalan yang dilewati ({arah.urutan_jalan.length})</summary>
              <p className="mt-2 leading-relaxed text-dark/70">{arah.urutan_jalan.join(' → ')}</p>
            </details>
          )}
        </div>
        <div className="shrink-0 border-t border-[#EDF1F2] bg-white/95 px-5 pt-2.5 pb-5 backdrop-blur lg:px-6">
          <button
            onClick={onMulaiSimulasi}
            className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white shadow-md transition active:scale-[0.98] ${
              simulasiAktif
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-[#09B58D] hover:bg-[#079977]'
            }`}
          >
            <IconBus className="h-5 w-5" />
            {simulasiAktif ? 'Sedang Simulasi Jalan...' : 'Mulai Simulasi Jalan'}
          </button>
          <PrimaryButton onClick={onTampilkan}>
            <IconPin className="h-5 w-5" /> Tampilkan di Peta
          </PrimaryButton>
        </div>
      </Card>
    </Floating>
  )
}
