import { useEffect, useRef, useState } from 'react'
import { Lottie } from 'lottie-react'
import heroAnimation from '../assets/hero/hero-animasi.json'

// Kecepatan animasi (dapat diubah sesuai preferensi)
const KECEPATAN_ANIMASI = 1

export default function Hero() {
  const lottieRef = useRef(null)
  const [selectedRoute, setSelectedRoute] = useState(1)
  const [hasError, setHasError] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return false
  })

  // Cek preferensi prefers-reduced-motion: reduce
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mediaQuery) return

    const handleMotionChange = (e) => {
      setReducedMotion(e.matches)
      if (lottieRef.current) {
        if (e.matches) {
          lottieRef.current.goToAndStop(0, true)
        } else {
          lottieRef.current.setSpeed(KECEPATAN_ANIMASI)
          lottieRef.current.play()
        }
      }
    }

    mediaQuery.addEventListener?.('change', handleMotionChange)
    return () => mediaQuery.removeEventListener?.('change', handleMotionChange)
  }, [])

  // Terapkan kecepatan animasi dan status play/pause saat komponen dimuat
  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(KECEPATAN_ANIMASI)
      if (reducedMotion) {
        lottieRef.current.goToAndStop(0, true)
      }
    }
  }, [reducedMotion])

  const handlePrevRoute = () => {
    setSelectedRoute((prev) => (prev <= 1 ? 30 : prev - 1))
  }

  const handleNextRoute = () => {
    setSelectedRoute((prev) => (prev >= 30 ? 1 : prev + 1))
  }

  return (
    <section
      aria-label="Hero Section"
      className="relative h-auto min-h-[79.8611cqw] w-full overflow-hidden bg-gradient-to-b from-[#E8F6FF] to-white lg:h-[84.3056cqw] lg:min-h-0"
    >
      {/* ===== ILUSTRASI ANIMASI LOTTIE (LATAR BELAKANG) ===== */}
      <div
        className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
        aria-hidden="true"
      >
        {!hasError && heroAnimation ? (
          <Lottie
            lottieRef={lottieRef}
            src={heroAnimation}
            animationData={heroAnimation}
            autoplay={!reducedMotion}
            loop={!reducedMotion}
            speed={KECEPATAN_ANIMASI}
            rendererSettings={{
              preserveAspectRatio: 'xMidYMid meet',
            }}
            className="absolute left-[-0.8333cqw] top-[-20cqw] aspect-[1464/1438] h-[99.8611cqw] w-[101.6667cqw] max-w-none lg:top-[-15.5556cqw]"
            onError={() => setHasError(true)}
          />
        ) : (
          /* Cadangan gradien biru muda ke putih jika file animasi gagal dimuat */
          <div className="w-full h-full bg-gradient-to-b from-[#E8F6FF] to-white" />
        )}
      </div>

      {/* ===== KONTEN TEKS & TOMBOL PEMILIH (LAPISAN DEPAN) ===== */}
      <div className="relative z-10 mx-auto flex w-[min(1201px,calc(100%-32px))] flex-col items-start pt-[4cqw] pb-[4.4444cqw] sm:pt-[11.8056cqw] lg:pb-0 lg:pt-[14.5833cqw]">
        {/* Judul Utama */}
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[60px] font-extrabold leading-tight tracking-tight text-hero-brown lg:leading-[3.78125cqw] lg:whitespace-nowrap">
          NAIK Angkot, Anti Nyasar.
        </h1>

        {/* Subjudul */}
        <p className="mt-2.5 lg:mt-2 max-w-[753px] font-sans text-xl sm:text-2xl lg:text-[36px] font-medium leading-snug lg:leading-[54.45px] text-hero-brown">
          Eksplorasi rute, cek titik transit, dan pantau{' '}
          <br className="hidden lg:inline" />
          perjalanan keliling Kota Bogor dari satu layar.
        </p>

        {/* Tombol Pemilih Angkot (Pill) */}
        <div className="mt-6 lg:mt-5 inline-flex items-center gap-[10px] h-[56px] px-5 min-w-[320px] w-fit rounded-full bg-hero-pill border-[1.28px] border-white/30 backdrop-blur-[10px] shadow-sm">
          {/* Ikon Pin + Label Cari Rute Sekarang */}
          <a
            href="#rute"
            className="inline-flex items-center gap-[10px] text-hero-brown hover:opacity-85 transition-opacity"
          >
            {/* Ikon Pin Lokasi (SVG Inline 16px, garis tanpa isi, stroke 1.7px) */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 17 17"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
              aria-hidden="true"
            >
              <path
                d="M14.509 6.90888C14.509 11.7452 8.2909 15.8907 8.2909 15.8907C8.2909 15.8907 2.07275 11.7452 2.07275 6.90888C2.07275 5.25973 2.72788 3.67812 3.89401 2.51199C5.06014 1.34586 6.64175 0.690735 8.2909 0.690735C9.94006 0.690735 11.5217 1.34586 12.6878 2.51199C13.8539 3.67812 14.509 5.25973 14.509 6.90888Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.3642 6.90899C10.3642 8.05372 9.4362 8.98171 8.29147 8.98171C7.14674 8.98171 6.21875 8.05372 6.21875 6.90899C6.21875 5.76426 7.14674 4.83627 8.29147 4.83627C9.4362 4.83627 10.3642 5.76426 10.3642 6.90899Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-inter text-[18px] font-semibold leading-[24px] whitespace-nowrap">
              Cari Rute Sekarang
            </span>
          </a>

          {/* Garis Pemisah Vertikal */}
          <span className="h-5 w-[1.28px] bg-hero-brown/25 mx-1" aria-hidden="true" />

          {/* Navigasi Rute Angkot (< 01 >) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevRoute}
              className="flex h-7 w-7 items-center justify-center rounded-full text-hero-brown hover:bg-black/5 active:scale-95 transition-all"
              aria-label="Pilih rute sebelumnya"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 17 17"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M10.3632 12.4361L6.21777 8.2907L10.3632 4.14526"
                  stroke="currentColor"
                  strokeWidth="1.38"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <span className="font-inter text-[18px] font-semibold leading-[24px] text-hero-brown select-none min-w-[24px] text-center">
              {String(selectedRoute).padStart(2, '0')}
            </span>

            <button
              type="button"
              onClick={handleNextRoute}
              className="flex h-7 w-7 items-center justify-center rounded-full text-hero-brown hover:bg-black/5 active:scale-95 transition-all"
              aria-label="Pilih rute berikutnya"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 17 17"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M6.21826 12.4361L10.3637 8.2907L6.21826 4.14526"
                  stroke="currentColor"
                  strokeWidth="1.38"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
