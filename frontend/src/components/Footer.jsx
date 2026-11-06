import { useRef } from 'react'
import backgroundFooter from '../assets/footer/bg-footer.svg'
import logoNaik from '../assets/logo-naik.svg'
import useAwanParallax from '../hooks/useAwanParallax'

const footerLinks = [
  { label: 'Beranda', href: '#' },
  { label: 'Tentang', href: '#tentang' },
  { label: 'Fitur', href: '#fitur' },
  { label: 'Panduan', href: '#panduan' },
]

export default function Footer() {
  const footerRef = useRef(null)
  const lautRef = useRef(null)
  useAwanParallax(footerRef, lautRef, 0.5)

  return (
    <footer ref={footerRef} className="relative isolate z-20 -mt-[8.5vw] min-h-[calc(660px+8.5vw)] w-full overflow-hidden bg-transparent text-white lg:min-h-[58.5vw]">
      {/* Dasar putih solid penuh di atas ombak: menjamin area di atas ombak selalu putih bersih dan tidak pernah tembus ke latar biru (#E8F6FF) */}
      <div className="pointer-events-none absolute inset-x-0 -top-[25vw] h-[60vw] -z-20 bg-white" />

      {/* Laut: naik dari bawah mengikuti scroll (--awan-p 1 -> 0) + bergoyang pelan terus-menerus */}
      <div
        ref={lautRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 [--awan-p:1] will-change-transform"
        style={{ transform: 'translate3d(0, calc(var(--awan-p) * 9vw), 0)' }}
      >
        <div className="absolute inset-x-0 top-[18vw] bottom-[-12vw] bg-[#1CBDC7]" />
        <img
          src={backgroundFooter}
          alt=""
          className="ombak-goyang absolute top-0 left-[-2%] block h-auto w-[104%] max-w-none select-none"
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1216px] px-6 pb-8 pt-[calc(210px+8.5vw)] sm:px-10 lg:px-0 lg:pb-0 lg:pt-[28.5vw]">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.65fr_1fr] lg:gap-12">
          <section aria-label="Tentang NAIK">
            <a href="#" aria-label="NAIK - Beranda" className="inline-flex">
              <img src={logoNaik} alt="NAIK" className="h-7 w-auto brightness-0 invert" />
            </a>
            <p className="mt-3 max-w-[26rem] font-sans text-base font-medium leading-[1.45] text-white">
              WebGIS kepadatan dan eksplorasi rute angkot Kota Bogor. Dibuat sebagai bagian tugas Manajemen Proyek Teknologi Informasi.
            </p>
          </section>

          <nav aria-label="Akses footer">
            <h2 className="font-sans text-base font-medium text-white">Akses</h2>
            <ul className="mt-5 space-y-1 font-sans text-base font-medium text-white">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a className="transition-opacity hover:opacity-75" href={link.href}>
                    &gt; {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="footer-newsletter-title">
            <h2 id="footer-newsletter-title" className="font-sans text-base font-bold leading-6 text-white">
              Berlangganan kabar terbaru
            </h2>
            <p className="mt-5 font-sans text-base font-medium leading-6 text-white">
              Dapatkan update seputar rute angkot, titik transit, dan fitur terbaru dari aplikasi NAIK.
            </p>
            <form className="mt-6 flex max-w-[22rem] flex-col items-start gap-4" onSubmit={(event) => event.preventDefault()}>
              <label className="sr-only" htmlFor="footer-email">Alamat email</label>
              <input
                id="footer-email"
                name="email"
                type="email"
                placeholder="Masukkan email Anda"
                required
                className="h-14 w-full rounded-[99.34px] border border-zinc-200 bg-white px-6 font-sans text-base text-neutral-700 shadow-sm outline-none placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-cyan-900"
              />
              <button
                type="submit"
                className="inline-flex min-h-14 items-center justify-center rounded-[69.9px] bg-cyan-900 px-6 font-sans text-base font-medium text-white transition-colors hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Berlangganan
              </button>
            </form>
          </section>
        </div>

        <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between lg:mt-[7vw]">
          <p className="font-sans text-xs font-normal uppercase tracking-widest text-white sm:text-sm lg:text-base">
            © 2026 NAIK | KEBIJAKAN PRIVASI | SYARAT LAYANAN
          </p>
          <nav aria-label="Media sosial" className="flex items-center gap-5 text-white">
            <a href="#" aria-label="Facebook" className="transition-opacity hover:opacity-75">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M13.4 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.5 1.6-1.5h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.2v3.2H10V21h3.4Z" />
              </svg>
            </a>
            <a href="#" aria-label="X" className="transition-opacity hover:opacity-75">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.8 5.7 22H2.5l7.3-8.4L1.8 2h6.5l4.5 6.7L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" />
              </svg>
            </a>
            <a href="#" aria-label="Instagram" className="transition-opacity hover:opacity-75">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="18" cy="6" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href="#" aria-label="LinkedIn" className="transition-opacity hover:opacity-75">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M5.2 8.3a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 10h3.4v10H3.5V10Zm5.5 0h3.2v1.4h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.1 3.9 4.8V20h-3.4v-4.9c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6V20H9V10Z" />
              </svg>
            </a>
            <a href="#" aria-label="YouTube" className="transition-opacity hover:opacity-75">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12c0 1.6.2 3.2.5 4.9a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2c.3-1.7.5-3.3.5-4.9s-.2-3.2-.5-4.9ZM9.8 15.6V8.4l6.1 3.6-6.1 3.6Z" />
              </svg>
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}