import { useEffect, useRef, useState } from 'react'
import kartuTentangData from '../data/kartuTentang'

const deskripsiPerBaris = {
  'rute-presisi': [
    'Temukan titik naik-turun dan',
    'rute paling efisien tanpa takut',
    'salah angkot.',
  ],
  'panduan-transit': [
    'Informasi rute jauh lebih mudah',
    'dipahami ketika ditampilkan',
    'langsung pada peta.',
  ],
  'sulit-menentukan': [
    'Pengguna butuh bantuan',
    'menemukan rute berdasarkan',
    'lokasi asal dan tujuan.',
  ],
}

function CardIcon({ id }) {
  if (id === 'rute-presisi') {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F1] md:h-9 md:w-9 lg:h-[3.3333cqw] lg:w-[3.3333cqw] lg:rounded-[1.1111cqw]">
        <svg
          width="24"
          height="24"
          viewBox="87 80 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="h-4 w-4 md:h-[18px] md:w-[18px] lg:h-[1.6667cqw] lg:w-[1.6667cqw]"
        >
          <circle
            cx="91.75"
            cy="99.25"
            r="3.2"
            stroke="#FF7A85"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M94.97 99.25H104.07C106.13 99.25 107.81 97.57 107.81 95.5C107.81 93.43 106.13 91.76 104.07 91.76H92.29C90.23 91.76 88.55 90.08 88.55 88.01C88.55 85.94 90.23 84.26 92.29 84.26H101.39"
            stroke="#FF7A85"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="104.6"
            cy="84.26"
            r="3.2"
            stroke="#FF7A85"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  if (id === 'panduan-transit') {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EAF6FE] md:h-9 md:w-9 lg:h-[3.3333cqw] lg:w-[3.3333cqw] lg:rounded-[1.1111cqw]">
        <svg
          width="24"
          height="24"
          viewBox="86 83 24 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="h-4 w-4 md:h-[18px] md:w-[18px] lg:h-[1.6667cqw] lg:w-[1.6667cqw]"
        >
          <path
            d="M87.54 91.75C88.41 89.28 93.67 84.26 98.18 84.26C102.69 84.26 107.95 89.28 108.82 91.75C107.95 94.24 102.69 99.25 98.18 99.25C93.67 99.25 88.41 94.24 87.54 91.75Z"
            stroke="#38BDF8"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="98.18"
            cy="91.76"
            r="3.2"
            stroke="#38BDF8"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF6E6] md:h-9 md:w-9 lg:h-[3.3333cqw] lg:w-[3.3333cqw] lg:rounded-[1.1111cqw]">
      <svg
        width="24"
        height="24"
        viewBox="98 89 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="h-4 w-4 md:h-[18px] md:w-[18px] lg:h-[1.6667cqw] lg:w-[1.6667cqw]"
      >
        <circle
          cx="110.11"
          cy="100.93"
          r="10.7"
          stroke="#FFAB2E"
          strokeWidth="2.14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M114.65 96.39L112.72 102.19C112.43 103.02 111.36 103.54 111.36 103.54L105.57 105.47L107.5 99.68C107.78 98.84 108.86 98.32 108.86 98.32L114.65 96.39Z"
          stroke="#FFAB2E"
          strokeWidth="2.14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export default function KartuTumpuk({ kartu = kartuTentangData }) {
  const [activeFrontIndex, setActiveFrontIndex] = useState(0)
  const activeButtonRef = useRef(null)
  const focusNextFrontRef = useRef(false)
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return false
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mediaQuery) return

    const handleChange = (event) => setReducedMotion(event.matches)
    mediaQuery.addEventListener?.('change', handleChange)
    return () => mediaQuery.removeEventListener?.('change', handleChange)
  }, [])

  useEffect(() => {
    if (focusNextFrontRef.current) {
      focusNextFrontRef.current = false
      activeButtonRef.current?.focus({ preventScroll: true })
    }
  }, [activeFrontIndex])

  const handleNext = () => {
    focusNextFrontRef.current = true
    setActiveFrontIndex((previous) => (previous + 1) % kartu.length)
  }

  return (
    <div className="relative aspect-[539.53/320] w-[min(80vw,270px)] sm:w-[280px] md:w-[280px] lg:absolute lg:left-0 lg:top-0 lg:aspect-auto lg:h-[20cqw] lg:w-[37.037cqw] lg:max-w-none">
      {kartu.map((item, index) => {
        const relativeIndex = (index - activeFrontIndex + kartu.length) % kartu.length
        const isFront = relativeIndex === 0
        const slotClass =
          relativeIndex === 0
            ? 'left-0 top-0 rotate-0'
            : relativeIndex === 1
              ? 'left-0 top-0 -translate-x-[1.5%] lg:-translate-x-[9.375%] translate-y-[6.944%] -rotate-[11.72deg]'
              : 'left-0 top-0 translate-x-[1.5%] lg:translate-x-[6.375%] translate-y-[4.514%] rotate-[11.61deg]'

        return (
          <button
            key={item.id}
            type="button"
            onClick={isFront ? handleNext : undefined}
            aria-label={isFront ? `Tampilkan kartu berikutnya, ${item.judul}` : undefined}
            aria-hidden={!isFront}
            tabIndex={isFront ? 0 : -1}
            style={{ backgroundColor: item.warna }}
            ref={isFront ? activeButtonRef : undefined}
            className={`absolute flex h-full w-full flex-col items-start justify-center overflow-hidden rounded-[20px] p-4 text-left shadow-[0_6px_14px_rgba(0,0,0,0.25)] transition-transform duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 select-none sm:rounded-[24px] sm:p-5 lg:justify-start lg:rounded-[2.7715cqw] lg:p-[4.4444cqw] lg:shadow-[0.4403cqw_0.6299cqw_1.2409cqw_rgba(0,0,0,0.25)] lg:focus-visible:ring-[0.2778cqw] ${reducedMotion ? 'motion-reduce:transition-none' : ''} ${slotClass} ${isFront ? 'z-30 cursor-pointer' : 'pointer-events-none z-10'}`}
          >
            <div
              className={`flex items-center gap-2 md:gap-2.5 lg:gap-[1.1111cqw] ${isFront ? 'visible' : 'invisible'}`}
            >
              <div className="lg:scale-100">
                <CardIcon id={item.id} />
              </div>
              <h3 className="whitespace-nowrap font-display text-[clamp(0.875rem,4vw,1.25rem)] font-bold leading-tight text-white md:text-[1.18rem] lg:text-[2.5cqw] lg:leading-[3.491cqw]">
                {item.judul}
              </h3>
            </div>

            <p
              className={`mt-1.5 font-sans text-[clamp(0.72rem,3vw,0.85rem)] font-bold leading-[1.25] text-white md:mt-2 md:text-[0.82rem] md:leading-snug lg:mt-[0.5556cqw] lg:text-[1.9444cqw] lg:leading-[2.7778cqw] lg:tracking-[-0.03em] lg:[font-variation-settings:"wdth"_97] ${isFront ? 'visible' : 'invisible'}`}
            >
              {deskripsiPerBaris[item.id].map((line) => (
                <span key={line} className="inline lg:block lg:whitespace-nowrap">
                  {line}{' '}
                </span>
              ))}
            </p>
          </button>
        )
      })}
    </div>
  )
}
