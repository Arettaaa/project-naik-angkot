import { useRef } from 'react'
import latar from '../assets/carakerja/latar.svg'
import pohon from '../assets/carakerja/pohon.svg'
import rumahKanan from '../assets/carakerja/rumah-kanan.svg'
import rumahKiri from '../assets/carakerja/rumah-kiri.svg'
import langkah from '../data/langkah'
import useScrollSteps from '../hooks/useScrollSteps'

const POHON = [
  { left: 68.75, top: 22.7083 },
  { left: 42.5694, top: 28.3333 },
  { left: 19.3056, top: 57.4306 },
  { left: 73.2639, top: 62.5 },
]

const POSISI_KARTU = [
  { left: 9.5833, top: 33.5417 },
  { left: 29.9306, top: 42.7778 },
  { left: 50.2778, top: 33.5417 },
  { left: 72.1528, top: 42.9861 },
]

const POSISI_TITIK = [
  { left: 18.6806, top: 49.6528 },
  { left: 38.6111, top: 58.8194 },
  { left: 59.375, top: 49.5833 },
  { left: 81.25, top: 58.9583 },
]

const GARIS_DESKTOP = [
  'M 275 721 C 382 721 461 853 568 853',
  'M 568 853 C 675 853 754 720 861 720',
  'M 861 720 C 978 720 1059 855 1176 855',
]

function Sparkles() {
  return (
    <svg
      aria-hidden="true"
      className="h-[1.6667cqw] w-[1.6667cqw] max-lg:h-5 max-lg:w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
      <path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" />
      <path d="M5 2v4M3 4h4" />
    </svg>
  )
}

export default function CaraKerja() {
  const sectionRef = useRef(null)
  const stepRefs = useRef([])
  const visibleCount = useScrollSteps(sectionRef, stepRefs, langkah.length)

  return (
    <section
      ref={sectionRef}
      id="panduan"
      aria-labelledby="cara-kerja-title"
      className="cara-kerja-section relative -mt-[7.5694cqw] min-h-[calc(100vh+160px)] w-full overflow-x-clip pb-40 pt-36 scroll-mt-[123px] max-lg:pt-32 lg:h-[94.0278cqw] lg:min-h-0 lg:overflow-y-hidden lg:pb-0 lg:pt-0 lg:scroll-mt-[8.5417cqw]"
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img
          src={rumahKiri}
          alt=""
          className="absolute left-[-7.0833cqw] top-[3.7986cqw] h-[26.6667cqw] w-[41.3125cqw] max-w-none select-none object-fill max-lg:left-[-12cqw] max-lg:top-[1cqw] max-lg:h-auto max-lg:w-[48cqw]"
        />
        <img
          src={rumahKanan}
          alt=""
          className="absolute left-[65.8333cqw] top-[3.8194cqw] h-[35.1292cqw] w-[44.3889cqw] max-w-none select-none object-fill max-lg:left-[65cqw] max-lg:top-[1cqw] max-lg:h-auto max-lg:w-[48cqw]"
        />
        <img
          src={latar}
          alt=""
          className="absolute left-[-0.1667cqw] top-[23.5417cqw] h-[70.5215cqw] w-[100.4861cqw] max-w-none select-none object-fill max-lg:left-[-50cqw] max-lg:top-auto max-lg:bottom-0 max-lg:h-auto max-lg:w-[200cqw]"
        />
        {POHON.map((tree, index) => (
          <img
            key={index}
            src={pohon}
            alt=""
            className="absolute z-[3] hidden h-[5.1118cqw] w-[2.4472cqw] max-w-none select-none lg:block"
            style={{ left: `${tree.left}cqw`, top: `${tree.top}cqw` }}
          />
        ))}
      </div>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[4] hidden h-full w-full lg:block"
        viewBox="0 0 1440 1354"
        preserveAspectRatio="none"
      >
        {GARIS_DESKTOP.map((path, index) => (
          <path
            key={path}
            d={path}
            className="cara-kerja-line"
            opacity={visibleCount >= index + 2 ? 0.7 : 0}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 z-[5] hidden lg:block" aria-hidden="true">
        {langkah.map((step, index) => {
          return (
            <span
              key={step.nomor}
              className={`cara-kerja-dot absolute h-[0.8333cqw] w-[0.8333cqw] rounded-full border-[0.2083cqw] border-white shadow-[0_0_0_0.2896cqw_#fff] ${visibleCount > index ? 'is-visible' : ''}`}
              style={{
                left: `${POSISI_TITIK[index].left}cqw`,
                top: `${POSISI_TITIK[index].top}cqw`,
                backgroundColor: step.warna,
                opacity: visibleCount > index ? 1 : 0,
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
          className="mt-5 text-center font-display text-[clamp(2.5rem,8vw,4rem)] font-bold leading-none text-[#0D404F] lg:absolute lg:left-[26.8403cqw] lg:top-[16.5278cqw] lg:mt-0 lg:w-[46.3194cqw] lg:text-[5cqw] lg:leading-[4.9396cqw]"
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
                className={`cara-kerja-step relative z-10 flex min-h-[228px] w-[min(88vw,340px)] flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-6 shadow-[0_8px_32px_-18px_rgba(33,75,56,0.5)] ${visibleCount > index ? 'is-visible' : ''} lg:absolute lg:left-[var(--step-left)] lg:top-[var(--step-top)] lg:h-[15.8333cqw] lg:min-h-0 lg:w-[19.0278cqw] lg:rounded-[2.0278cqw] lg:border-[0.0722cqw] lg:p-[1.7361cqw] lg:shadow-[0_0.7243cqw_2.8986cqw_-1.7389cqw_rgba(33,75,56,0.5)]`}
                style={{
                  '--step-left': `${position.left}cqw`,
                  '--step-top': `${position.top}cqw`,
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
                  className="cara-kerja-dot absolute left-1/2 top-[calc(100%+12px)] h-3 w-3 -translate-x-1/2 rounded-full border-[3px] border-white lg:hidden"
                  style={{
                    backgroundColor: step.warna,
                    opacity: visibleCount > index ? 1 : 0,
                  }}
                />
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-[0_12px_27px_-10px_var(--guide-icon-shadow)] lg:h-[4.4444cqw] lg:w-[4.4444cqw] lg:rounded-[1.1111cqw] lg:shadow-[0_0.8694cqw_1.884cqw_-0.7243cqw_var(--guide-icon-shadow)]"
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
