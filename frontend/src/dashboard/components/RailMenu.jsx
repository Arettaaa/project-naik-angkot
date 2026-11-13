import { Link, NavLink } from 'react-router-dom'
import { Floating } from '../ui'
import { IconBus, IconMap, IconRoute, IconSearch } from '../icons'
import TombolTema from '../../components/TombolTema'

const MENU = [
  { to: '/peta', label: 'Beranda', Icon: IconMap },
  { to: '/rute', label: 'Rute', Icon: IconRoute },
  { to: '/cari', label: 'Cari', Icon: IconSearch },
]

export default function RailMenu() {
  return (
    <Floating className="bottom-3 left-3 right-3 lg:top-3 lg:right-auto lg:bottom-3 lg:w-[68px]">
      <nav
        aria-label="Menu dashboard"
        className="flex h-16 items-center justify-between gap-1 rounded-full border border-white/80 bg-white/95 px-2 shadow-[0_10px_34px_rgba(21,30,44,0.18)] backdrop-blur lg:h-full lg:flex-col lg:justify-start lg:gap-2 lg:rounded-[22px] lg:border-0 lg:bg-white lg:px-0 lg:py-4 lg:shadow-[0_8px_30px_rgba(21,30,44,0.12)]"
      >
        {/* logo = kembali ke landing page (HP: paling kiri di menu bawah, desktop: paling atas) */}
        <Link to="/" aria-label="Kembali ke halaman utama NAIK" title="Halaman utama" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary !text-white shadow-[0_4px_12px_rgba(26,147,111,0.3)] active:scale-95 lg:mb-4 lg:h-10 lg:w-10 lg:rounded-xl lg:shadow-none">
          <IconBus className="h-5 w-5" />
        </Link>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-[#E3E8EA] lg:hidden" />
        {/* HP: menu aktif melebar jadi pil hijau (ikon + nama), lainnya ikon saja. Desktop: ikon di atas label. */}
        {MENU.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              `flex items-center justify-center transition-all duration-200 active:scale-95 max-lg:h-12 max-lg:rounded-full lg:w-[52px] lg:flex-col lg:gap-1 lg:rounded-xl lg:py-2 lg:text-[11px] lg:font-medium ${
                isActive
                  ? 'max-lg:gap-2 max-lg:bg-primary max-lg:px-4 max-lg:text-[13.5px] max-lg:font-semibold max-lg:!text-white max-lg:shadow-[0_6px_16px_rgba(26,147,111,0.3)] lg:bg-[#E3F4EC] lg:!text-primary'
                  : 'max-lg:w-12 !text-dark/55 hover:bg-[#F3F6F6] hover:!text-dark'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-5 w-5 shrink-0" />
                {/* HP: nama hanya tampil di menu aktif (yang lain tetap terbaca screen reader) */}
                <span className={isActive ? '' : 'max-lg:sr-only'}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {/* tema terang/gelap: HP = tombol bulat di ujung kanan menu, desktop = saklar di dasar rail */}
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-[#E3E8EA] lg:hidden" />
        <TombolTema variant="ikon" className="lg:hidden" />
        <div className="hidden lg:mt-auto lg:flex lg:flex-col lg:items-center lg:gap-1.5">
          <TombolTema ukuran="sm" />
          <span className="text-[10px] font-medium text-dark/45">Tema</span>
        </div>
      </nav>
    </Floating>
  )
}