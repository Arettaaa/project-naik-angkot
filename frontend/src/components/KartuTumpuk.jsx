import { useEffect, useRef, useState } from 'react'
import kartuTentangData from '../data/kartuTentang'

const deskripsiPerBaris = {
  'rute-presisi': ['Lihat jalur setiap angkot', 'lengkap dengan nama jalan', 'yang dilewati.'],
  'panduan-transit': ['Perlu ganti angkot? NAIK', 'menunjukkan tempat turun', 'dan angkot berikutnya.'],
  'sulit-menentukan': ['Cukup isi asal dan tujuan.', 'Angkot tercepat beserta', 'tarifnya langsung muncul.'],
}

function CardIcon({ id }) {
  if (id === 'rute-presisi') {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] md:h-9 md:w-9 lg:h-[3.3333cqw] lg:w-[3.3333cqw] lg:rounded-[1.1111cqw]">
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
            stroke="#FFF"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M94.97 99.25H104.07C106.13 99.25 107.81 97.57 107.81 95.5C107.81 93.43 106.13 91.76 104.07 91.76H92.29C90.23 91.76 88.55 90.08 88.55 88.01C88.55 85.94 90.23 84.26 92.29 84.26H101.39"
            stroke="#FFF"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="104.6"
            cy="84.26"
            r="3.2"
            stroke="#FFF"
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] md:h-9 md:w-9 lg:h-[3.3333cqw] lg:w-[3.3333cqw] lg:rounded-[1.1111cqw]">
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
            stroke="#FFF"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="98.18"
            cy="91.76"
            r="3.2"
            stroke="#FFF"
            strokeWidth="2.14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] md:h-9 md:w-9 lg:h-[3.3333cqw] lg:w-[3.3333cqw] lg:rounded-[1.1111cqw]">
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
          stroke="#FFF"
          strokeWidth="2.14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M114.65 96.39L112.72 102.19C112.43 103.02 111.36 103.54 111.36 103.54L105.57 105.47L107.5 99.68C107.78 98.84 108.86 98.32 108.86 98.32L114.65 96.39Z"
          stroke="#FFF"
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
  const [swappingCardId, setSwappingCardId] = useState(null)
  const [isHovered, setIsHovered] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const activeButtonRef = useRef(null)
  const focusNextFrontRef = useRef(false)
  const isTransitioningRef = useRef(false)
  const swapTimerRef = useRef(null)

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
    return () => {
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (focusNextFrontRef.current) {
      focusNextFrontRef.current = false
      activeButtonRef.current?.focus({ preventScroll: true })
    }
  }, [activeFrontIndex])

  const handleNext = () => {
    if (isTransitioningRef.current) return

    if (reducedMotion) {
      focusNextFrontRef.current = true
      setActiveFrontIndex((prev) => (prev + 1) % kartu.length)
      return
    }

    isTransitioningRef.current = true
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })

    const currentCard = kartu[activeFrontIndex]
    setSwappingCardId(currentCard.id)
    focusNextFrontRef.current = true

    // Semua kartu bergerak serempak seketika tanpa ada jeda/hitch
    setActiveFrontIndex((prev) => (prev + 1) % kartu.length)

    if (swapTimerRef.current) clearTimeout(swapTimerRef.current)
    swapTimerRef.current = setTimeout(() => {
      setSwappingCardId(null)
      isTransitioningRef.current = false
    }, 750)
  }

  const handleMouseMove = (e) => {
    if (reducedMotion || isTransitioningRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: x * 2, y: y * 2 })
  }

  const handleMouseEnter = () => {
    if (!reducedMotion && !isTransitioningRef.current) {
      setIsHovered(true)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })
  }

  return (
    <div
      className="relative aspect-[539.53/320] w-[min(80vw,270px)] sm:w-[280px] md:w-[280px] lg:absolute lg:left-0 lg:top-0 lg:aspect-auto lg:h-[20cqw] lg:w-[37.037cqw] lg:max-w-none"
      style={{ perspective: '1200px' }}
    >
      <style>{`
        @keyframes cardTuckBack {
          0% {
            transform: translate3d(0, 0, 0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1);
            box-shadow: 0 18px 36px -8px rgba(0, 0, 0, 0.28), 0 6px 14px -3px rgba(0, 0, 0, 0.16);
            z-index: 35;
          }
          42% {
            transform: translate3d(34%, -10%, 48px) rotateX(10deg) rotateY(-12deg) rotateZ(7.5deg) scale(1.02);
            box-shadow: 0 28px 48px -10px rgba(0, 0, 0, 0.35), 0 12px 20px -6px rgba(0, 0, 0, 0.2);
            z-index: 35;
          }
          54% {
            z-index: 8;
          }
          76% {
            transform: translate3d(14%, 2%, -38px) rotateX(3deg) rotateY(-4deg) rotateZ(10.2deg) scale(0.95);
            box-shadow: 0 12px 22px -6px rgba(0, 0, 0, 0.24);
            z-index: 8;
          }
          100% {
            transform: translate3d(4.5%, 4.2%, -65px) rotateX(0deg) rotateY(0deg) rotateZ(11.61deg) scale(0.93);
            box-shadow: 0 8px 16px -6px rgba(0, 0, 0, 0.26);
            z-index: 8;
          }
        }
      `}</style>
      {kartu.map((item, index) => {
        const relativeIndex = (index - activeFrontIndex + kartu.length) % kartu.length
        const isFront = relativeIndex === 0
        const isSwapping = swappingCardId === item.id

        // Koordinat 3D per posisi slot:
        // Slot 0: Depan (rata tegak, terangkat, tajam)
        // Slot 1: Kiri belakang (miring ke kiri, scale mengecil, translateZ mundur)
        // Slot 2: Kanan belakang (miring ke kanan, paling belakang)
        let transformStyle = ''
        let zIndex = 10
        let shadowClass = ''
        let brightnessClass = 'brightness-100'
        let animationStyle = undefined

        if (isSwapping) {
          // Kartu depan yang baru saja diganti: melayang keluar ke kanan lalu menyelip santai & anggun ke belakang slot 2
          animationStyle = 'cardTuckBack 750ms cubic-bezier(0.25, 1, 0.35, 1) forwards'
          zIndex = 35
        } else if (isFront) {
          zIndex = 30
          shadowClass = 'shadow-[0_18px_36px_-8px_rgba(0,0,0,0.28),0_6px_14px_-3px_rgba(0,0,0,0.16)]'
          if (isHovered && !reducedMotion) {
            // Efek 3D tilt responsif saat kursor mouse digerakkan di atas kartu depan
            const rx = -tilt.y * 6
            const ry = tilt.x * 6
            transformStyle = `translate3d(0, -6px, 22px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`
          } else {
            transformStyle = 'translate3d(0, 0, 0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)'
          }
        } else if (relativeIndex === 1) {
          zIndex = 15
          brightnessClass = 'brightness-[0.96]'
          shadowClass = 'shadow-[0_10px_20px_-6px_rgba(0,0,0,0.22)]'
          // Slot kiri belakang
          transformStyle = 'translate3d(-5%, 6.5%, -35px) rotateZ(-11.72deg) scale(0.96)'
        } else {
          // Slot kanan belakang (paling bawah di tumpukan)
          zIndex = 10
          brightnessClass = 'brightness-[0.92]'
          shadowClass = 'shadow-[0_8px_16px_-6px_rgba(0,0,0,0.26)]'
          transformStyle = 'translate3d(4.5%, 4.2%, -65px) rotateZ(11.61deg) scale(0.93)'
        }

        // Posisi kilauan cahaya dinamis (glare sheen) saat di-hover
        const glareX = ((tilt.x + 1) / 2) * 100
        const glareY = ((tilt.y + 1) / 2) * 100

        return (
          <button
            key={item.id}
            type="button"
            onClick={isFront ? handleNext : undefined}
            onMouseMove={isFront ? handleMouseMove : undefined}
            onMouseEnter={isFront ? handleMouseEnter : undefined}
            onMouseLeave={isFront ? handleMouseLeave : undefined}
            aria-label={isFront ? `Tampilkan kartu berikutnya: ${item.judul} (${activeFrontIndex + 1} dari ${kartu.length})` : undefined}
            aria-hidden={!isFront}
            tabIndex={isFront ? 0 : -1}
            ref={isFront ? activeButtonRef : undefined}
            style={{
              backgroundColor: item.warna,
              transform: reducedMotion ? undefined : transformStyle,
              animation: reducedMotion ? undefined : animationStyle,
              zIndex,
              transformStyle: 'preserve-3d',
              transition: reducedMotion
                ? 'none'
                : isSwapping
                  ? 'none'
                  : 'transform 750ms cubic-bezier(0.25, 1, 0.35, 1), box-shadow 750ms ease-out, filter 750ms ease-out',
            }}
            className={`group absolute left-0 top-0 flex h-full w-full flex-col items-start justify-between overflow-hidden rounded-[20px] p-4 text-left select-none sm:rounded-[24px] sm:p-5 lg:rounded-[2.7715cqw] lg:p-[3.6cqw] border border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 lg:focus-visible:ring-[0.2778cqw] active:scale-[0.99] ${brightnessClass} ${shadowClass} ${
              isFront
                ? 'cursor-pointer'
                : 'pointer-events-none'
            }`}
          >
            {/* Kilau pantulan cahaya halus (glass/specular sheen) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
              style={{
                background:
                  isFront && isHovered && !reducedMotion
                    ? `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 45%, transparent 75%)`
                    : 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 45%, transparent 100%)',
              }}
            />

            {/* Bagian Atas: Ikon dan Judul */}
            <div
              className={`relative z-10 flex items-center gap-2 md:gap-2.5 lg:gap-[1.1111cqw] transition-opacity duration-500 ${
                isFront && !isSwapping ? 'opacity-100 delay-200' : 'opacity-0'
              }`}
            >
              <div className="transition-transform duration-300 group-hover:scale-105">
                <CardIcon id={item.id} />
              </div>
              <h3 className="whitespace-nowrap font-display text-[clamp(0.875rem,4vw,1.25rem)] font-bold leading-tight text-white md:text-[1.18rem] lg:text-[2.35cqw] lg:leading-[3.2cqw] drop-shadow-sm">
                {item.judul}
              </h3>
            </div>

            {/* Bagian Tengah: Deskripsi Rute */}
            <p
              className={`relative z-10 mt-1 font-sans text-[clamp(0.72rem,3vw,0.85rem)] font-medium leading-[1.3] text-white/95 md:mt-1.5 md:text-[0.82rem] md:leading-snug lg:mt-[0.4cqw] lg:text-[1.75cqw] lg:leading-[2.5cqw] lg:tracking-[-0.02em] transition-opacity duration-500 ${
                isFront && !isSwapping ? 'opacity-100 delay-200' : 'opacity-0'
              }`}
            >
              {deskripsiPerBaris[item.id].map((line) => (
                <span key={line} className="inline lg:block lg:whitespace-nowrap">
                  {line}{' '}
                </span>
              ))}
            </p>

            {/* Bagian Bawah: Indikator Paginasi 3D & Hint Ganti Kartu */}
            <div
              className={`relative z-10 flex w-full items-center justify-between pt-1 transition-opacity duration-500 ${
                isFront && !isSwapping ? 'opacity-100 delay-200' : 'opacity-0'
              }`}
            >
              <span className="flex items-center gap-1.5 font-sans text-[10px] md:text-xs lg:text-[1cqw] font-semibold tracking-wider text-white/80 uppercase">
                <span>Ganti kartu</span>
                <svg
                  className="h-3 w-3 transition-transform duration-300 group-hover:rotate-45 lg:h-[1.1cqw] lg:w-[1.1cqw]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M4 12v-2a8 8 0 0 1 14.93-4M20 12v2a8 8 0 0 1-14.93 4" strokeLinecap="round" />
                  <path d="M19 4l1 3-3 1M5 20l-1-3 3-1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>

              {/* 3 Pill Titik Indikator kartu */}
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {kartu.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 lg:h-[0.35cqw] ${
                      i === activeFrontIndex
                        ? 'w-5 bg-white shadow-sm lg:w-[1.4cqw]'
                        : 'w-1.5 bg-white/45 lg:w-[0.35cqw]'
                    }`}
                  />
                ))}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
