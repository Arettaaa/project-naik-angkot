import { useRef } from 'react'
import { Link } from 'react-router-dom'
import backgroundFooter from '../assets/footer/bg-footer.svg'
import logoNaik from '../assets/logo-naik.webp'
import useAwanParallax from '../hooks/useAwanParallax'

const JELAJAHI = [
  { label: 'Peta kepadatan', to: '/peta' },
  { label: 'Daftar rute angkot', to: '/rute' },
  { label: 'Cari rute', to: '/cari' },
]

const HALAMAN = [
  { label: 'Tentang NAIK', href: '#tentang' },
  { label: 'Fitur utama', href: '#fitur' },
  { label: 'Panduan', href: '#panduan' },
]

function Kolom({ judul, children }) {
  return (
    <nav aria-label={judul}>
      <h2 className="font-sans text-sm font-semibold tracking-wide text-white/70 uppercase">{judul}</h2>
      <ul className="mt-4 space-y-2.5 font-sans text-base font-medium text-white">{children}</ul>
    </nav>
  )
}

const kelasTautan = 'inline-block transition-opacity hover:opacity-75 focus-visible:underline'

export default function Footer() {
  const footerRef = useRef(null)
  const lautRef = useRef(null)
  useAwanParallax(footerRef, lautRef, 0.5)

  return (
    <footer ref={footerRef} className="relative isolate z-20 -mt-[8.5vw] w-full overflow-hidden bg-transparent text-white">
      {/* dasar putih di atas ombak supaya sambungan dari bagian sebelumnya bersih */}
      <div className="pointer-events-none absolute inset-x-0 -top-[25vw] -z-20 h-[60vw] bg-white" />

      {/* laut: naik pelan mengikuti scroll + bergoyang halus */}
      <div ref={lautRef} aria-hidden="true" data-geser="9vw" className="pointer-events-none absolute inset-0 z-0 will-change-transform" style={{ transform: 'translate3d(0, 9vw, 0)' }}>
        <div className="absolute inset-x-0 top-[18vw] bottom-[-12vw] bg-[#1CBDC7]" />
        <img src={backgroundFooter} alt="" className="ombak-goyang absolute top-0 left-[-2%] block h-auto w-[104%] max-w-none select-none" />
      </div>

      <div className="relative z-10 mx-auto w-[min(1201px,calc(100%-48px))] pt-[calc(130px+8.5vw)] pb-10 lg:pt-[20vw] lg:pb-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr] lg:gap-16">
          <section aria-label="Tentang NAIK" className="sm:col-span-2 lg:col-span-1">
            <Link to="/" aria-label="NAIK — beranda" className="inline-flex">
              <img src={logoNaik} alt="NAIK" width="72" height="30" className="h-[30px] w-auto brightness-0 invert" />
            </Link>
            <p className="mt-4 max-w-[30rem] font-sans text-base leading-relaxed text-white/90">
              NAIK membantu kamu menemukan angkot yang tepat di Kota Bogor. Cek rute, titik pindah, dan kepadatan jalur angkot
              dalam satu peta.
            </p>
            <p className="mt-4 max-w-[30rem] font-sans text-sm leading-relaxed text-white/70">
              Dibuat oleh Kelompok 9 B2 untuk tugas mata kuliah Sistem Informasi Geografis dan Manajemen Proyek Teknologi Informasi.
            </p>
          </section>

          <Kolom judul="Jelajahi">
            {JELAJAHI.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className={kelasTautan}>
                  {l.label}
                </Link>
              </li>
            ))}
          </Kolom>

          <Kolom judul="Halaman ini">
            {HALAMAN.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={kelasTautan}>
                  {l.label}
                </a>
              </li>
            ))}
          </Kolom>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/25 pt-6 font-sans text-sm text-white/80 sm:flex-row sm:items-center sm:justify-between lg:mt-16">
          <p>© 2026 NAIK · Kelompok 9 B2</p>
          <p>
            Data jalan dan peta ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              kontributor OpenStreetMap
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
