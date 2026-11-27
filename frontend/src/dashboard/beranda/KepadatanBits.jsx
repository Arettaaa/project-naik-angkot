import { KEPADATAN, kepadatanOf, warnaTrayek } from '../warna'
import { nomorTampil } from '../nomorWarga'
import { IconArrowLeft } from '../icons'

// Potongan tampilan yang dipakai bersama oleh ringkasan, daftar semua ruas, dan detail ruas.

// Bar bertumpuk Rendah | Sedang | Tinggi (persen panjang jalan).
export function BarKepadatan({ pct, tinggi = 'h-2.5' }) {
  return (
    <div className={`flex w-full gap-[3px] overflow-hidden rounded-full ${tinggi}`}>
      {KEPADATAN.map((k) =>
        pct[k.key] > 0 ? <span key={k.key} className="h-full rounded-full" style={{ width: `${pct[k.key]}%`, backgroundColor: k.warna }} /> : null,
      )}
    </div>
  )
}

export function LegendaMini({ pct }) {
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-dark/55">
      {KEPADATAN.map((k) => (
        <span key={k.key} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.warna }} />
          {k.key} {Math.round(pct[k.key])}%
        </span>
      ))}
    </p>
  )
}

export function Pil({ tingkat, children }) {
  const k = kepadatanOf(tingkat)
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: k.lembut, color: k.warna }}>
      {children}
    </span>
  )
}

// Nomor trayek yang bisa diketuk untuk menampilkan jalurnya di peta.
export function ChipTrayek({ kode, aktif, onClick }) {
  const warna = warnaTrayek(kode)
  return (
    <button
      type="button"
      onClick={onClick}
      title={aktif ? `Sembunyikan jalur ${nomorTampil(kode)}` : `Tampilkan jalur ${nomorTampil(kode)} di peta`}
      className="inline-flex h-7 min-w-[30px] items-center justify-center rounded-lg px-2 font-display text-[12.5px] leading-none font-bold transition"
      style={aktif ? { backgroundColor: warna, color: '#fff' } : { backgroundColor: warna + '1A', color: warna, boxShadow: `inset 0 0 0 1px ${warna}59` }}
    >
      {nomorTampil(kode)}
    </button>
  )
}

// Judul tiap tampilan. `onKembali` memunculkan tombol kembali (beda fungsi dari tombol tutup panel).
export function Judul({ eyebrow, onKembali, labelKembali = 'Kembali', children }) {
  return (
    <div className="pr-[76px]">
      {onKembali && (
        <button
          type="button"
          onClick={onKembali}
          className="-ml-1.5 mb-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12.5px] font-semibold text-dark/60 transition hover:bg-[#F1F4F5] hover:text-dark"
        >
          <IconArrowLeft className="h-4 w-4" /> {labelKembali}
        </button>
      )}
      <p className="text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-0.5 font-display text-[18px] leading-tight font-bold text-tentang-dark">{children}</h2>
    </div>
  )
}
