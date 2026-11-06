import { useEffect, useRef, useState } from 'react'
import { IconLayers } from '../icons'

const PILIHAN = [
  { key: 'rute', label: 'Rute angkot' },
  { key: 'kepadatan', label: 'Kepadatan' },
]

function Saklar({ checked, onChange, disabled, children }) {
  return (
    <label className={`flex items-center justify-between gap-3 py-1 text-[14px] ${disabled ? 'text-dark/35' : 'cursor-pointer text-dark'}`}>
      {children}
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 ${checked && !disabled ? 'bg-primary' : 'bg-[#D5DEE0]'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked && !disabled ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </label>
  )
}

// Tombol layer (gaya aplikasi peta): pilih tampilan Rute / Kepadatan + jaringan jalan.
export default function TombolLayer({ layers, setLayers, loading, error }) {
  const [buka, setBuka] = useState(false)
  const ref = useRef(null)
  const mode = layers.kepadatan ? 'kepadatan' : 'rute'

  useEffect(() => {
    if (!buka) return
    const tutup = (e) => !ref.current?.contains(e.target) && setBuka(false)
    document.addEventListener('pointerdown', tutup)
    return () => document.removeEventListener('pointerdown', tutup)
  }, [buka])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setBuka((x) => !x)}
        aria-label="Atur tampilan peta"
        aria-expanded={buka}
        className={`flex h-[52px] w-[52px] items-center justify-center rounded-2xl shadow-[0_8px_30px_rgba(21,30,44,0.14)] transition ${buka ? 'bg-primary text-white' : 'bg-white text-dark hover:bg-[#F3F6F6]'}`}
      >
        <IconLayers className="h-5 w-5" />
      </button>
      {buka && (
        <div className="absolute top-[60px] right-0 z-10 w-[260px] rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(21,30,44,0.18)]">
          <p className="mb-2 text-[12px] font-semibold tracking-wide text-dark/50 uppercase">Tampilan peta</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F4F5] p-1">
            {PILIHAN.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={mode === p.key}
                onClick={() => setLayers((l) => ({ ...l, rute: true, kepadatan: p.key === 'kepadatan' }))}
                className={`h-9 rounded-lg text-[13.5px] font-semibold transition ${mode === p.key ? 'bg-white text-primary shadow-sm' : 'text-dark/60 hover:text-dark'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-[#EDF1F2] pt-2">
            <Saklar checked={layers.jalan} disabled={layers.kepadatan} onChange={(v) => setLayers((l) => ({ ...l, jalan: v }))}>
              Jaringan jalan angkot
            </Saklar>
          </div>
          {loading && <p className="mt-2 text-xs text-dark/50">Memuat ruas jalan…</p>}
          {error && <p className="mt-2 text-xs text-red-700">Ruas jalan gagal dimuat.</p>}
        </div>
      )}
    </div>
  )
}
