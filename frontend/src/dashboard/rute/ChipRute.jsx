import { Floating, KodeBadge } from '../ui'

// Chip rute terpilih (bawah tengah).
export default function ChipRute({ rute }) {
  return (
    <Floating className="bottom-24 left-1/2 hidden -translate-x-1/2 sm:block lg:bottom-4">
      <div className="flex items-center gap-2.5 rounded-2xl bg-white py-2 pr-4 pl-2 shadow-[0_8px_30px_rgba(21,30,44,0.14)]">
        <KodeBadge kode={rute.kode_trayek} warna={rute.warna} size="sm" />
        <span className="text-[14px] font-semibold whitespace-nowrap text-dark">
          {rute.asal} → {rute.tujuan}
        </span>
      </div>
    </Floating>
  )
}