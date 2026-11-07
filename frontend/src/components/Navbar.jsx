import { useState } from 'react'
import { Link } from 'react-router-dom'
import logoNaik from '../assets/logo-naik.webp'

const navLinks = [
  { label: 'Tentang', href: '#tentang' },
  { label: 'Fitur', href: '#fitur' },
  { label: 'Panduan', href: '#panduan' },
]

function HamburgerIcon({ open }) {
  if (open) {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M6 6l12 12M6 18L18 6" />
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <>
      {/* ===== DESKTOP NAVBAR (>= 1024px) ===== */}
      <nav
        aria-label="Navigasi utama"
        className="fixed top-[53px] left-1/2 z-50 -translate-x-1/2
          w-[min(1201px,calc(100%-32px))] h-[70px]
          rounded-[55px] border border-border-nav bg-white/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.06)]
          px-[26px]
          hidden lg:flex items-center"
      >
        {/* Logo */}
        <a href="#top" aria-label="NAIK — kembali ke atas">
          <img src={logoNaik} alt="NAIK" width="67" height="28" className="h-7 w-auto" />
        </a>

        {/* Spacer kiri */}
        <div className="flex-1" />

        {/* Menu links */}
        <div className="flex items-center gap-9">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[18px] font-medium leading-5 text-dark transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Spacer kanan */}
        <div className="flex-1" />

        {/* Tombol CTA */}
        <Link
          to="/peta"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-[18px] font-semibold leading-5 text-white transition-colors hover:bg-[#178563]"
        >
          Buka Peta
        </Link>
      </nav>

      {/* ===== MOBILE NAVBAR (< 1024px) ===== */}
      <nav
        aria-label="Navigasi utama"
        className="fixed top-3 left-4 right-4 z-50
          rounded-[55px] border border-border-nav bg-white/80 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)]
          px-4 h-12 sm:top-4 sm:px-5 sm:h-[52px]
          flex lg:hidden items-center"
      >
        {/* Logo */}
        <a href="#top" aria-label="NAIK — kembali ke atas">
          <img src={logoNaik} alt="NAIK" width="48" height="20" className="h-5 w-auto sm:h-[22px]" />
        </a>

        <div className="flex-1" />

        {/* Hamburger button */}
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          className="flex h-9 w-9 items-center justify-center rounded-full text-dark"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </nav>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <div
          className="fixed top-[68px] left-4 right-4 z-50 max-h-[calc(100dvh-80px)] overflow-y-auto sm:top-[76px]
            rounded-[20px] border border-border-nav bg-white
            p-4 flex flex-col gap-2
            lg:hidden"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-xl px-4 py-2.5 text-base font-medium text-dark hover:bg-primary/10 transition-colors"
              onClick={closeMenu}
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/peta"
            className="mt-1 inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#178563]"
            onClick={closeMenu}
          >
            Buka Peta
          </Link>
        </div>
      )}
    </>
  )
}
