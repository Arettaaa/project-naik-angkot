import { Link, NavLink } from 'react-router-dom'
import { Floating } from '../ui'
import { IconBus, IconMap, IconRoute, IconSearch } from '../icons'

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
        className="flex h-16 items-center justify-around rounded-[22px] bg-white px-2 shadow-[0_8px_30px_rgba(21,30,44,0.12)] lg:h-full lg:flex-col lg:justify-start lg:gap-2 lg:px-0 lg:py-4"
      >
        <Link to="/" aria-label="Kembali ke beranda NAIK" className="hidden h-10 w-10 items-center justify-center rounded-xl bg-primary !text-white lg:mb-4 lg:flex">
          <IconBus className="h-5 w-5" />
        </Link>
        {MENU.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition lg:w-[52px] ${
                isActive ? 'bg-[#E3F4EC] !text-primary' : '!text-dark/60 hover:bg-[#F3F6F6] hover:!text-dark'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </Floating>
  )
}