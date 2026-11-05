import awanCta from '../assets/cta/awan-cta.svg'

export default function CTASection() {
  return (
    <section
      aria-labelledby="cta-title"
      className="cta-section relative isolate z-40 -mt-[23cqw] min-h-[clamp(500px,72cqw,620px)] w-full overflow-hidden bg-transparent px-5 pb-16 text-center sm:px-8 lg:min-h-[93.4028cqw] lg:px-0 lg:pb-0 xl:min-h-[66cqw] min-[1920px]:left-1/2 min-[1920px]:-translate-x-1/2 min-[1920px]:w-[calc(100vw-15px)] min-[1920px]:max-w-[2560px]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[23cqw] bottom-0 z-0 bg-white"
      />
      <img
        src={awanCta}
        alt=""
        aria-hidden="true"
        className="cta-clouds pointer-events-none absolute inset-x-0 z-[1] h-auto w-full select-none"
      />

      <div className="cta-content relative z-10 mx-auto flex w-full flex-col items-center">
        <h2
          id="cta-title"
          className="font-display text-[clamp(2rem,5cqw,4.5rem)] font-bold leading-[0.92] text-[#214B38]"
        >
          <span className="block">Keliling Kota Bogor,</span>
          <span className="block text-[#35C98B]">tanpa nyasar lagi.</span>
        </h2>

        <p className="mt-4 max-w-[34rem] font-sans text-[clamp(1rem,2.5cqw,2.25rem)] font-normal leading-[1.15] text-neutral-500 sm:max-w-[58cqw]">
          Gratis dipakai. Tanpa daftar. Langsung temukan rute angkot terbaik dalam hitungan detik.
        </p>

        <a
          href="#peta"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#2F6B4F] px-7 py-3 font-sans text-base font-semibold text-white shadow-[0_4px_10px_rgba(20,83,45,0.2)] transition-colors hover:bg-[#24583F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F6B4F] sm:mt-[2.5cqw] sm:min-h-[clamp(36px,4.1667cqw,60px)] sm:gap-[clamp(8px,0.8333cqw,12px)] sm:px-[clamp(20px,2.2222cqw,32px)] sm:py-0 sm:text-[clamp(10px,1.1111cqw,16px)]"
        >
          Buka Peta Angkot
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 sm:h-[clamp(14px,1.3889cqw,20px)] sm:w-[clamp(14px,1.3889cqw,20px)]" fill="none">
            <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </section>
  )
}