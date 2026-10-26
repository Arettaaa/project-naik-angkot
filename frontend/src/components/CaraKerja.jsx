import { useRef } from 'react'
import adegan from '../assets/carakerja/adegan.svg'
import jalur from '../assets/carakerja/jalur.svg'
import kilau from '../assets/carakerja/kilau.svg'
import langkah from '../data/langkah'
import useScrollSteps from '../hooks/useScrollSteps'

const JARAK_MUNCUL_PX = 40

const POSISI_KARTU = [
  { left: 9.5833, top: 33.5417 },
  { left: 29.9306, top: 42.7778 },
  { left: 50.2778, top: 33.5417 },
  { left: 72.1528, top: 42.9861 },
]

const POSISI_TITIK = [
  { left: 18.6806, top: 49.6528 },
  { left: 39.0278, top: 58.8194 },
  { left: 59.375, top: 49.6528 },
  { left: 81.25, top: 58.8194 },
]

const SEGMEN_JALUR = [
  { awal: 0.4397, akhir: 33.5433 },
  { awal: 33.5433, akhir: 65.0494 },
  { awal: 65.0494, akhir: 99.5043 },
]

function Sparkles() {
  return (
    <img
      src={kilau}
      aria-hidden="true"
      className="h-6 w-6 lg:h-[1.6667cqw] lg:w-[1.6667cqw]"
    />
  )
}

export default function CaraKerja() {
  const sectionRef = useRef(null)
  const stepRefs = useRef([])
  const { visibleCount, isResetting } = useScrollSteps(sectionRef, stepRefs, langkah.length)

  return (
    <section
      ref={sectionRef}
      id="panduan"
      aria-labelledby="cara-kerja-title"
      className={`cara-kerja-section relative -mt-[7.5694cqw] min-h-[calc(100vh+160px)] w-full overflow-x-clip pb-40 pt-36 scroll-mt-[123px] max-lg:pt-32 lg:h-[94.0278cqw] lg:min-h-0 lg:overflow-clip lg:pb-0 lg:pt-0 lg:scroll-mt-[8.5417cqw] min-[1920px]:-mt-[7.5694vw] min-[1920px]:left-1/2 min-[1920px]:-translate-x-1/2 min-[1920px]:w-[calc(100vw-15px)] min-[1920px]:max-w-[2560px] min-[1920px]:[container-type:inline-size] min-[1920px]:h-[94.0278vw]${isResetting ? ' is-resetting' : ''}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-[53cqw] bottom-0 z-0 bg-guide-hill lg:hidden"
        aria-hidden="true"
      />
      <img
        src={adegan}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-[1] h-auto w-full max-w-none select-none"
      />

      <div className="pointer-events-none absolute inset-0 z-[4] hidden lg:block" aria-hidden="true">
        {SEGMEN_JALUR.map((segment, index) => {
          const revealed = visibleCount >= index + 2
          const visibleEnd = revealed ? segment.akhir : segment.awal
          return (
            <img
              key={index}
              src={jalur}
              alt=""
              className="cara-kerja-route absolute left-[18.2292cqw] top-[49.375cqw] h-[10.1389cqw] w-[64.1667cqw] max-w-none"
              style={{
                clipPath: `inset(0 ${100 - visibleEnd}% 0 ${segment.awal}%)`,
              }}
            />
          )
        })}
      </div>
      <div className="pointer-events-none absolute inset-0 z-[5] hidden lg:block" aria-hidden="true">
        {langkah.map((step, index) => {
          return (
            <span
              key={step.nomor}
              className={`cara-kerja-dot absolute h-[0.8333cqw] w-[0.8333cqw] rounded-full shadow-[0_0_0_0.2896cqw_#fff] ${visibleCount > index ? 'is-visible' : ''}`}
              style={{
                left: `${POSISI_TITIK[index].left}cqw`,
                top: `${POSISI_TITIK[index].top}cqw`,
                backgroundColor: step.warna,
                opacity: visibleCount > index ? 0.88 : 0,
              }}
            />
          )
        })}
      </div>

      <div className="relative z-20 mx-auto flex w-full flex-col items-center lg:absolute lg:inset-0">
        <div className="flex h-11 items-center gap-2 rounded-full bg-guide-badge px-5 text-guide-green lg:absolute lg:left-[40cqw] lg:top-[10.9722cqw] lg:h-[3.0556cqw] lg:w-[20cqw] lg:justify-center lg:gap-[0.8333cqw] lg:px-[1.6667cqw]">
          <Sparkles />
          <span className="whitespace-nowrap font-sans text-sm font-bold leading-5 lg:text-[1.25cqw] lg:leading-[1.9444cqw]">
            Empat langkah mudah
          </span>
        </div>

        <h2
          id="cara-kerja-title"
          className="mt-5 text-center font-display text-[clamp(2.5rem,8vw,4rem)] font-bold leading-none text-[#0D404F] lg:absolute lg:left-[26.8403cqw] lg:top-[16.5278cqw] lg:mt-0 lg:w-[46.3194cqw] lg:text-[5cqw] lg:leading-[4.9396cqw] lg:font-optical-sizing-auto lg:tracking-[-0.03em]"
        >
          Cara Kerja
        </h2>

        <ol className="relative z-10 mt-10 flex w-full flex-col items-center gap-12 px-4 lg:absolute lg:inset-0 lg:mt-0 lg:block lg:p-0">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-0 h-[calc(100%+18px)] w-full lg:hidden"
            viewBox="0 0 100 1074"
            preserveAspectRatio="none"
          >
            {Array.from({ length: langkah.length - 1 }, (_, index) => (
              <path
                key={index}
                d={`M 50 ${246 + index * 276} V ${522 + index * 276}`}
                className="cara-kerja-line"
                opacity={visibleCount >= index + 2 ? 0.7 : 0}
              />
            ))}
          </svg>
          {langkah.map((step, index) => {
            const position = POSISI_KARTU[index]
            return (
              <li
                key={step.nomor}
                ref={(element) => {
                  stepRefs.current[index] = element
                }}
                className={`cara-kerja-step relative z-10 flex min-h-[228px] w-[min(88vw,340px)] flex-col rounded-[24px] border border-transparent bg-white p-6 shadow-[0_10.43px_41.74px_-25.04px_rgba(33,75,56,0.5),inset_0_0_0_1.04px_#E5E5E5] ${visibleCount > index ? 'is-visible' : ''} lg:absolute lg:left-[var(--step-left)] lg:top-[var(--step-top)] lg:h-[15.8333cqw] lg:min-h-0 lg:w-[19.0278cqw] lg:rounded-[2.0278cqw] lg:border-[0.0722cqw] lg:p-[1.7361cqw] lg:shadow-[0_0.7243cqw_2.8986cqw_-1.7389cqw_rgba(33,75,56,0.5),inset_0_0_0_0.0722cqw_#E5E5E5]`}
                style={{
                  '--step-left': `${position.left}cqw`,
                  '--step-top': `${position.top}cqw`,
                  '--cara-step-offset': `${JARAK_MUNCUL_PX}px`,
                  opacity: visibleCount > index ? 1 : 0,
                  transform: visibleCount > index ? 'translateY(0)' : 'translateY(var(--cara-step-offset))',
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute left-[14.0278cqw] top-[1.8056cqw] hidden font-display text-[3.3333cqw] font-bold leading-[3.3333cqw] text-[rgba(24,24,27,0.05)] lg:block"
                >
                  {step.nomor}
                </span>
                <span
                  aria-hidden="true"
                  className="cara-kerja-dot absolute left-1/2 top-[calc(100%+12px)] h-3 w-3 -translate-x-1/2 rounded-full shadow-[0_0_0_4.17px_#fff] lg:hidden"
                  style={{
                    backgroundColor: step.warna,
                    opacity: visibleCount > index ? 0.88 : 0,
                  }}
                />
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-[0_12.52px_27.13px_-10.43px_var(--guide-icon-shadow)] lg:h-[4.4444cqw] lg:w-[4.4444cqw] lg:rounded-[1.1111cqw] lg:shadow-[0_0.8694cqw_1.884cqw_-0.7243cqw_var(--guide-icon-shadow)]"
                  style={{ backgroundColor: step.warna, '--guide-icon-shadow': step.warna }}
                >
                  <img src={step.ikon} alt="" className="h-7 w-7 select-none lg:h-[1.9444cqw] lg:w-[1.9444cqw]" />
                </div>
                <h3 className="mt-5 whitespace-nowrap font-display text-xl font-semibold leading-8 text-[#14532D] lg:mt-[1.3889cqw] lg:text-[1.3889cqw] lg:leading-[2.2222cqw] lg:tracking-[-0.02em]">
                  {step.judul}
                </h3>
                <p className="mt-1.5 max-w-[222px] font-sans text-base font-normal leading-6 text-[#737373] lg:mt-[0.4167cqw] lg:max-w-none lg:text-[1.1111cqw] lg:leading-[1.6667cqw]">
                  {step.deskripsi}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
