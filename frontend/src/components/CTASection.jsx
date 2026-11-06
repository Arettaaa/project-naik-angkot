import { useRef } from 'react'
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
      {/* Awan: naik mengikuti scroll (--awan-p 1 -> 0), putih di bawahnya ikut naik sehingga tidak ada celah */}
      <div
        ref={awanRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 [--awan-p:1] will-change-transform"
        style={{
          transform: 'translate3d(0, calc(var(--awan-p) * 14cqw), 0)',
          opacity: 'calc(1 - var(--awan-p) * 0.85)',
        }}
      >
        <img src={awanCta} alt="" className="block h-auto w-full select-none" />
      </div>

      {/* Konten: padding atas mengikuti lebar (cqw) supaya selalu jatuh di area putih di bawah awan */}
      <div className="relative mx-auto flex w-full flex-col items-center px-5 pt-[calc(33cqw+2rem)] pb-24 text-center sm:px-8 sm:pb-28 lg:px-0 lg:pt-[36cqw] lg:pb-[15cqw]">
        <h2
          id="cta-title"
          className="font-display text-[clamp(2rem,8vw,2.5rem)] font-bold leading-none text-[#214B38] sm:text-5xl lg:text-7xl lg:leading-[56.16px]"
        >
          <span className="block">Keliling Kota Bogor,</span>
          <span className="block text-[#35C98B]">tanpa nyasar lagi.</span>
        </h2>

        <p className="mt-5 max-w-[34rem] font-sans text-base font-normal leading-6 text-neutral-500 sm:text-xl sm:leading-7 lg:mt-6 lg:max-w-[58cqw] lg:text-4xl lg:leading-[1.15]">
          Gratis dipakai. Tanpa daftar. Langsung temukan rute angkot terbaik dalam hitungan detik.
        </p>

        <a
          href="/peta"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#2F6B4F] px-7 py-3 font-sans text-base font-semibold text-white shadow-[0_4px_10px_rgba(20,83,45,0.2)] transition-colors hover:bg-[#24583F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F6B4F] lg:mt-[2.5cqw] lg:min-h-[4.1667cqw] lg:gap-[0.8333cqw] lg:px-[2.2222cqw] lg:text-[1.1111cqw]"
        >
          Buka Peta Angkot
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 lg:h-[1.3889cqw] lg:w-[1.3889cqw]" fill="none">
            <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </section>
  )
}
