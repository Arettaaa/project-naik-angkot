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

const DAFTAR_POHON = [
  // 1. Bawah Card 01 / kiri Card 02 (sesuai gambar mockup user)
  { left: 21.6, top: 53.4, tipe: 1, scale: 1.15, delay: '0s' },
  // 2. Tengah atas di antara Card 01 & 03, di atas Card 02 (sesuai gambar mockup user)
  { left: 44.5, top: 27.5, tipe: 2, scale: 1.1, delay: '1.2s' },
  // 3. Kanan atas dekat bangunan & di atas Card 04 (sesuai gambar mockup user)
  { left: 70.8, top: 24.8, tipe: 1, scale: 1.05, delay: '0.6s' },
  // 4. Bawah Card 04 (sesuai gambar mockup user)
  { left: 75.4, top: 61.4, tipe: 1, scale: 1.18, delay: '1.8s' },
  // 5. Lereng bukit kiri jauh (membuat area kiri tidak sepi)
  { left: 5.2, top: 46.8, tipe: 2, scale: 0.95, delay: '2.1s' },
  // 6. Lereng bukit kanan jauh (menyeimbangkan area kanan)
  { left: 93.6, top: 48.8, tipe: 1, scale: 1.02, delay: '0.9s' },
  // 7. Area lereng tengah bawah di antara Card 02 & Card 04
  { left: 49.5, top: 58.2, tipe: 3, scale: 0.92, delay: '1.5s' },
  // 8. Lereng atas kiri di bawah bangunan / pembatas
  { left: 27.2, top: 28.8, tipe: 3, scale: 0.88, delay: '2.4s' },
]

function PohonVektor({ tipe = 1 }) {
  if (tipe === 2) {
    // Tipe 2: Pohon bertingkat 2 bulatan lembut (double-bulb)
    return (
      <svg viewBox="0 0 28 52" fill="none" className="h-full w-full overflow-visible" aria-hidden="true">
        <ellipse cx="14" cy="49" rx="8" ry="2.5" fill="#20583E" opacity="0.32" />
        <rect x="12.5" y="28" width="3" height="21" rx="1.5" fill="#78C6A0" />
        <ellipse cx="14" cy="27" rx="11" ry="11.5" fill="#226144" />
        <ellipse cx="15.5" cy="25.5" rx="9" ry="9" fill="#2A7352" opacity="0.6" />
        <ellipse cx="14" cy="15" rx="8.5" ry="9.5" fill="#266D4C" />
        <ellipse cx="15.2" cy="13.8" rx="6.5" ry="7.5" fill="#32835E" opacity="0.55" />
      </svg>
    )
  }

  if (tipe === 3) {
    // Tipe 3: Pohon ramping minimalis (slender pill)
    return (
      <svg viewBox="0 0 24 48" fill="none" className="h-full w-full overflow-visible" aria-hidden="true">
        <ellipse cx="12" cy="45.5" rx="6.5" ry="2" fill="#20583E" opacity="0.3" />
        <rect x="10.5" y="26" width="3" height="19.5" rx="1.5" fill="#7ECBA5" />
        <rect x="4" y="2" width="16" height="29" rx="8" fill="#236546" />
        <rect x="6" y="4" width="12" height="24" rx="6" fill="#2D7A55" opacity="0.5" />
      </svg>
    )
  }

  // Tipe 1 (Default): Pohon kapsul rounded (persis sketsa mockup user)
  return (
    <svg viewBox="0 0 28 52" fill="none" className="h-full w-full overflow-visible" aria-hidden="true">
      <ellipse cx="14" cy="48.5" rx="7.5" ry="2.5" fill="#20583E" opacity="0.35" />
      <rect x="12.5" y="28" width="3" height="20" rx="1.5" fill="#76C49E" />
      <path
        d="M 14 3 C 21 3, 24.5 9, 24.5 19 C 24.5 29, 21.5 35, 14 35 C 6.5 35, 3.5 29, 3.5 19 C 3.5 9, 7 3, 14 3 Z"
        fill="#246748"
      />
      <path
        d="M 14 5 C 19.5 5, 22 10, 22 18 C 22 26, 19.5 32, 14 32 C 12.5 32, 11 31, 10 29.5 C 14 28, 17 23, 17 17 C 17 11, 14 7, 12 5.5 C 12.6 5.2, 13.3 5, 14 5 Z"
        fill="#2D7B57"
        opacity="0.65"
      />
    </svg>
  )
}

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
  const visibleCount = useScrollSteps(sectionRef, stepRefs, langkah.length)

  return (
    <div
      id="panduan"
      className="relative z-10 -mt-[7.5694cqw] scroll-mt-[96px] lg:scroll-mt-[2cqw] min-[1920px]:-mt-[7.5694vw] min-[1920px]:left-1/2 min-[1920px]:w-[calc(100vw-15px)] min-[1920px]:max-w-[2560px] min-[1920px]:-translate-x-1/2"
    >
    <section
      ref={sectionRef}
      aria-labelledby="cara-kerja-title"
      className="cara-kerja-section relative w-full overflow-x-clip pb-28 pt-36 max-lg:pt-32 lg:h-[71cqw] lg:overflow-clip lg:pb-0 lg:pt-0 min-[1920px]:[container-type:inline-size] min-[1920px]:h-[71vw]"
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

      {/* Vektor pohon dekoratif di lereng bukit agar tidak sepi */}
      <div className="pointer-events-none absolute inset-0 z-[2] hidden lg:block" aria-hidden="true">
        {DAFTAR_POHON.map((pohon, index) => (
          <div
            key={index}
            className="cara-kerja-tree absolute select-none"
            style={{
              left: `${pohon.left}cqw`,
              top: `${pohon.top}cqw`,
              width: `${1.9444 * pohon.scale}cqw`,
              height: `${3.8889 * pohon.scale}cqw`,
              transformOrigin: 'bottom center',
              animation: 'pohonGoyang 5s ease-in-out infinite',
              animationDelay: pohon.delay,
            }}
          >
            <PohonVektor tipe={pohon.tipe} />
          </div>
        ))}
      </div>

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
          Cara Pakai
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
    </div>
  )
}
