import { KEPADATAN } from '../warna'

// Legenda kepadatan ringkas (hanya muncul saat tampilan Kepadatan aktif).
export default function Legenda({ catatan }) {
  return (
    <div className="inline-flex flex-col gap-1 rounded-2xl bg-white/95 px-3.5 py-2 shadow-[0_6px_20px_rgba(21,30,44,0.14)] backdrop-blur">
      <div className="flex items-center gap-3 text-[12.5px] text-dark">
        <span className="font-semibold text-dark/60">Kepadatan</span>
        {KEPADATAN.map((k) => (
          <span key={k.key} className="inline-flex items-center gap-1.5" title={k.ket}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: k.warna }} />
            {k.key}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-dark/50">Rendah 1 rute · Sedang 2–3 · Tinggi ≥ 4{catatan ? ` · ${catatan}` : ''}</p>
    </div>
  )
}
