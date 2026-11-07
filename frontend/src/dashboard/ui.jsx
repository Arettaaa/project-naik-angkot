import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { IconChevronDown, IconX } from './icons'
import { nomorWarga, trayekLama } from './nomorWarga'

// Panel melayang di atas peta. Klik/scroll di dalam panel tidak menggerakkan peta.
export function Floating({ className = '', children, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    L.DomEvent.disableClickPropagation(ref.current)
    L.DomEvent.disableScrollPropagation(ref.current)
  }, [])
  return (
    <div ref={ref} className={`absolute z-[1000] cursor-auto ${className}`} {...rest}>
      {children}
    </div>
  )
}

// Lapisan bebas posisi (mis. `fixed`) di atas peta; klik/scroll di dalamnya tidak tembus ke peta.
export function Lapisan({ className = '', children }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    L.DomEvent.disableClickPropagation(ref.current)
    L.DomEvent.disableScrollPropagation(ref.current)
  }, [])
  return (
    <div ref={ref} className={`cursor-auto ${className}`}>
      {children}
    </div>
  )
}

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-[28px] border border-white/70 bg-white/95 shadow-[0_8px_30px_rgba(21,30,44,0.12)] backdrop-blur ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, icon, onClose }) {
  return (
    <div className="flex items-start gap-3 px-5 pt-5 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 font-display text-[19px] sm:text-[22px] font-bold leading-snug text-tentang-dark">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <span>{title}</span>
        </h2>
        {subtitle && <p className="mt-1 text-xs text-dark/65 sm:mt-1.5 sm:text-[13px] leading-relaxed">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-[#F1F4F5] text-dark/60 transition hover:bg-mist hover:text-dark active:scale-95"
        >
          <IconX className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function Select({ label, value, onChange, children }) {
  return (
    <label className="block">
      {label && <span className="mb-2 block text-[13px] font-semibold text-tentang-dark">{label}</span>}
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full appearance-none rounded-2xl border border-[#E3E8EA] bg-white pr-10 pl-4 text-[15px] text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          {children}
        </select>
        <IconChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-dark/50" />
      </span>
    </label>
  )
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[15px] text-dark">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-[6px] border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 ${
          checked ? 'border-primary bg-primary text-white' : 'border-[#CFD8DB] bg-white'
        }`}
      >
        {checked && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {children}
    </label>
  )
}

export function PrimaryButton({ className = '', children, ...p }) {
  return (
    <button
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(26,147,111,0.25)] transition hover:bg-[#178563] disabled:opacity-40 ${className}`}
      {...p}
    >
      {children}
    </button>
  )
}

export function OutlineButton({ className = '', children, ...p }) {
  return (
    <button
      className={`inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[#E3E8EA] bg-white text-[15px] font-medium text-dark/70 transition hover:bg-[#F6F9F9] ${className}`}
      {...p}
    >
      {children}
    </button>
  )
}

// Kotak nomor trayek berwarna (01, 03, ...).
export function KodeBadge({ kode, warna, size = 'md' }) {
  const s = { sm: 'h-7 w-7 rounded-lg text-xs', md: 'h-11 w-11 rounded-xl text-[17px]', lg: 'h-12 w-12 rounded-2xl text-xl' }[size]
  return (
    <span className={`inline-flex shrink-0 items-center justify-center font-display font-bold text-white ${s}`} style={{ backgroundColor: warna }}>
      {trayekLama(kode) ? (
        <span className="flex flex-col items-center leading-none">
          {String(kode).replace(/^Trayek\s*/i, '').replace(/AK$/i, '')}
          <span className="mt-0.5 text-[8.5px] font-semibold tracking-wide uppercase opacity-85">lama</span>
        </span>
      ) : (
        String(kode).replace(/^Trayek\s*/i, '')
      )}
    </span>
  )
}

// Pil kecil "dulu 05": nomor lama yang masih dipakai warga & Moovit untuk trayek ini.
export function PilWarga({ kode, className = '' }) {
  if (trayekLama(kode))
    return (
      <span
        title="Trayek lama di luar SK 2017 yang masih beroperasi (Moovit & keterangan warga)"
        className={`inline-flex shrink-0 items-center rounded-full bg-[#EEF0F3] px-1.5 py-px text-[11px] font-semibold whitespace-nowrap text-[#4A5563] ${className}`}
      >
        trayek lama
      </span>
    )
  const w = nomorWarga(kode)
  if (!w) return null
  return (
    <span
      title={`Warga & Moovit masih menyebutnya angkot ${w} (nomor sebelum rerouting 2017)`}
      className={`inline-flex shrink-0 items-center rounded-full bg-[#FFF3D6] px-1.5 py-px text-[11px] font-semibold whitespace-nowrap text-[#8A5A00] ${className}`}
    >
      dulu {w}
    </span>
  )
}

export function Muat({ loading, error, onRetry }) {
  if (loading) return <p className="px-6 py-4 text-sm text-dark/60">Memuat data…</p>
  if (!error) return null
  return (
    <div className="mx-5 my-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">Data gagal dimuat</p>
      <p className="mt-1">{error.message}. Pastikan backend jalan (php artisan serve).</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
          Coba lagi
        </button>
      )}
    </div>
  )
}

// Bottom sheet (khusus HP): ketuk / geser pegangan ke atas untuk membuka, ke bawah untuk menutup.
export function BottomSheet({ terbuka, setTerbuka, atas, children, className = '' }) {
  const y0 = useRef(null)
  const turun = (e) => (y0.current = e.clientY)
  const naik = (e) => {
    if (y0.current == null) return
    const dy = e.clientY - y0.current
    y0.current = null
    if (dy < -24) setTerbuka(true)
    else if (dy > 24) setTerbuka(false)
    else setTerbuka(!terbuka)
  }
  return (
    <Floating className={`right-0 bottom-0 left-0 !z-[999] ${className}`}>
      {atas && <div className="pointer-events-none absolute right-3 -top-[60px] [&>*]:pointer-events-auto">{atas}</div>}
      <div className="rounded-t-[26px] bg-white pb-[calc(84px+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(21,30,44,0.14)]">
        <button
          type="button"
          aria-label={terbuka ? 'Ciutkan panel' : 'Buka panel'}
          aria-expanded={terbuka}
          onPointerDown={turun}
          onPointerUp={naik}
          className="flex w-full touch-none justify-center pt-2.5 pb-1.5"
        >
          <span className="h-1.5 w-10 rounded-full bg-[#D5DEE0]" />
        </button>
        {children}
      </div>
    </Floating>
  )
}
