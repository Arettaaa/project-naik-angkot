import { useRef } from 'react'
import { Link } from 'react-router-dom'
import awanCta from '../assets/cta/awan-cta.svg'
import useAwanParallax from '../hooks/useAwanParallax'

export default function CTASection() {
  const sectionRef = useRef(null)
  const awanRef = useRef(null)
  useAwanParallax(sectionRef, awanRef)

  return (
    <section
      ref={sectionRef}
      aria-labelledby="cta-title"
      className="relative isolate z-10 -mt-[10cqw] w-full overflow-hidden bg-guide-hill min-[1920px]:left-1/2 min-[1920px]:w-[calc(100vw-15px)] min-[1920px]:max-w-[2560px] min-[1920px]:-translate-x-1/2 min-[1920px]:[container-type:inline-size]"
    >
      {/* Dasar putih solid penuh di separuh bawah CTASection agar sambungan ke footer selalu putih murni */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[26cqw] -z-20 bg-white" />

      {/* Awan: naik anggun mengikuti scroll (--awan-p 1 -> 0), 100% solid, bersih & tanpa garis potong horizontal */}
      <div
        ref={awanRef}
        aria-hidden="true"
        data-geser="8cqw"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 will-change-transform"
        style={{ transform: 'translate3d(0, 8cqw, 0)' }}
      >
        <img src={awanCta} alt="" className="block h-auto w-full select-none" />
        {/* Bidang putih mulus yang menyambung di dasar awan dan bergerak sinkron bersama awan */}
        <div className="h-[120cqw] w-full bg-white -mt-[1px]" />
      </div>

      {/* Konten: padding atas mengikuti lebar (cqw) supaya selalu jatuh di area putih di bawah awan */}
      <div className="relative mx-auto flex w-full flex-col items-center px-5 pt-[calc(33cqw+2rem)] pb-28 text-center sm:px-8 sm:pb-32 lg:px-0 lg:pt-[36cqw] lg:pb-[9cqw]">
        <h2
          id="cta-title"
          data-muncul="0"
          className="font-display text-[clamp(2rem,8vw,2.5rem)] font-bold leading-[1.05] text-[#214B38] sm:text-5xl lg:text-[4.4cqw] lg:leading-[1.05]"
        >
          <span className="block">Keliling Kota Bogor,</span>
          <span className="block text-[#35C98B]">tanpa nyasar lagi.</span>
        </h2>

        <p
          data-muncul="1"
          className="mt-5 max-w-[34rem] font-sans text-base font-normal leading-relaxed text-neutral-500 sm:text-xl lg:mt-[1.6cqw] lg:max-w-[52cqw] lg:text-[2cqw] lg:leading-[1.4]"
        >
          Gratis dan tanpa perlu daftar. Temukan angkot yang tepat untuk perjalananmu dalam hitungan detik.
        </p>

        <div data-muncul="2" className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-[2.5cqw]">
          <Link
            to="/cari"
            className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-[#2F6B4F] px-7 py-3 font-sans text-base font-semibold text-white shadow-[0_4px_10px_rgba(20,83,45,0.2)] transition-colors hover:bg-[#24583F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F6B4F] lg:min-h-[3.9cqw] lg:px-[2.2cqw] lg:text-[1.15cqw]"
          >
            Cari rute sekarang
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 lg:h-[1.3cqw] lg:w-[1.3cqw]" fill="none">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link
            to="/peta"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#2F6B4F]/25 bg-white px-7 py-3 font-sans text-base font-semibold text-[#2F6B4F] transition-colors hover:bg-[#EEF6F1] lg:min-h-[3.9cqw] lg:px-[2.2cqw] lg:text-[1.15cqw]"
          >
            Lihat peta angkot
          </Link>
        </div>
      </div>
    </section>
  )
}
