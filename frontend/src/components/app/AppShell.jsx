import { Link, NavLink } from 'react-router-dom'
import logoNaik from '../../assets/logo-naik.svg'

const MENU = [
  { to: '/peta', label: 'Peta Kepadatan', pendek: 'Peta' },
  { to: '/rute', label: 'Rute Angkot', pendek: 'Rute' },
  { to: '/cari', label: 'Cari Rute', pendek: 'Cari' },
]

// Kerangka halaman aplikasi: header + panel samping + peta.
// Desktop: panel kiri 400px, peta di kanan. Mobile: peta di atas, panel di bawah.
export default function AppShell({ panel, map }) {
  return (
    <div className="flex h-dvh flex-col bg-[#F4FAF8] font-sans text-dark">
      <header className="z-[1100] flex h-16 shrink-0 items-center gap-3 border-b border-border-nav bg-white px-4 lg:px-6">
        <Link to="/" aria-label="Kembali ke beranda" className="shrink-0">
          <img src={logoNaik} alt="NAIK" className="h-6 w-auto" />
        </Link>
        <nav aria-label="Menu aplikasi" className="ml-auto flex min-w-0 gap-1 overflow-x-auto lg:ml-8">
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors lg:px-4 ${
                  isActive ? 'bg-primary text-white' : 'text-dark/70 hover:bg-mist hover:text-dark'
                }`
              }
            >
              <span className="sm:hidden">{m.pendek}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        <aside className="min-h-0 flex-1 overflow-y-auto border-border-nav bg-white lg:w-[400px] lg:flex-none lg:border-r">
          {panel}
        </aside>
        <section className="relative h-[52vh] shrink-0 lg:h-auto lg:flex-1">{map}</section>
      </div>
    </div>
  )
}

export function PanelSection({ title, action, children, className = '' }) {
  return (
    <section className={`border-b border-border-nav px-5 py-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg font-bold text-tentang-dark">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// warna trayek dari API bisa terang (mis. #b4ff49) -> teks gelap supaya tetap terbaca
function teksKontras(hex) {
  const h = (hex || '#1A936F').replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#151E2C' : '#FFFFFF'
}

export function KodeBadge({ kode, warna, size = 'md' }) {
  const s = size === 'sm' ? 'h-7 min-w-7 text-xs' : 'h-9 min-w-9 text-sm'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg px-1.5 font-display font-bold ${s}`}
      style={{ backgroundColor: warna || '#1A936F', color: teksKontras(warna) }}
    >
      {String(kode).replace(/^Trayek\s*/i, '')}
    </span>
  )
}

export function Status({ loading, error, onRetry }) {
  if (loading) return <p className="px-5 py-4 text-sm text-dark/60">Memuat data…</p>
  if (error)
    return (
      <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Data gagal dimuat.</p>
        <p className="mt-1">{error.message}. Pastikan backend jalan (php artisan serve).</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-3 rounded-full bg-red-600 px-4 py-1.5 font-semibold text-white">
            Coba lagi
          </button>
        )}
      </div>
    )
  return null
}
