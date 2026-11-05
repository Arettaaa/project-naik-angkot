import { rupiah } from '../../utils/format'
import { KodeBadge } from '../ui'
import { IconArrowRight, IconChevronRight } from '../icons'

// Satu kartu di Daftar Rute Angkot.
export default function KartuRute({ trayek, aktif, onClick }) {
  const a = trayek.arah[0]
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
        aktif ? 'border-primary bg-[#F1FAF6] ring-2 ring-primary/10' : 'border-[#E8EDEE] bg-white hover:bg-[#F8FAFA]'
      }`}
    >
      <KodeBadge kode={trayek.kode_trayek} warna={trayek.warna} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-dark">
          <span className="truncate">{a?.asal}</span>
          <IconArrowRight className="h-3.5 w-3.5 shrink-0 text-dark/50" />
          <span className="truncate">{a?.tujuan}</span>
        </span>
        <span className="text-[13px] text-dark/60">Tarif: {rupiah(trayek.tarif)}</span>
      </span>
      <IconChevronRight className="h-5 w-5 shrink-0 text-dark/40" />
    </button>
  )
}