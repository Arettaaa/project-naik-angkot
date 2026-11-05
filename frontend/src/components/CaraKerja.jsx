import { useLayoutEffect, useRef, useState } from 'react'
import latarCaraKerja from '../assets/carakerja/latar-carakerja.svg'
import jalur from '../assets/carakerja/jalur.svg'
import kilau from '../assets/carakerja/kilau.svg'
import pohon from '../assets/carakerja/pohon.svg'
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
  { left: 18.0556, top: 49.2014 },
  { left: 39.3753, top: 58.7932 },
  { left: 59.5512, top: 49.2014 },
  { left: 81.7017, top: 58.7932 },
]

const POSISI_POHON = [
  { left: 19.2, top: 57.3 },
  { left: 42.6, top: 28.4 },
  { left: 68.8, top: 22.8 },
  { left: 73.4, top: 62.4 },
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
      className="h-6 w-6 xl:h-[1.6667cqw] xl:w-[1.6667cqw]"
    />
  )
}

function getResponsiveRoute(section, steps) {
  const sectionBounds = section.getBoundingClientRect()
  const isMobile = window.matchMedia('(max-width: 639px)').matches
  const markerSelector = isMobile
    ? '.cara-kerja-mobile-dot'
    : '.cara-kerja-tablet-dot'
  const points = steps.map((step) => {
    const marker = step?.querySelector(markerSelector)
    if (!marker) return null

    const markerBounds = marker.getBoundingClientRect()
    return markerBounds.width && markerBounds.height
      ? {
        x: markerBounds.left + markerBounds.width / 2 - sectionBounds.left,
        y: markerBounds.top + markerBounds.height / 2 - sectionBounds.top,
      }
      : null
  })

  if (points.some((point) => !point)) return ''

  const d = points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const deltaX = point.x - previous.x
    const deltaY = point.y - previous.y
    const bend = Math.min(56, Math.abs(deltaY) * 0.22) * (index === 2 ? -1 : 1)
    const control1 = `${previous.x + deltaX / 3 + bend} ${previous.y + deltaY / 3}`
    const control2 = `${previous.x + deltaX * 2 / 3 + bend} ${previous.y + deltaY * 2 / 3}`
    return `${path} C${control1} ${control2} ${point.x} ${point.y}`
  }, `M${points[0].x} ${points[0].y}`)

  return d
}

export default function CaraKerja() {
  const sectionRef = useRef(null)
  const stepRefs = useRef([])
  const [responsiveRoute, setResponsiveRoute] = useState({ d: '', width: 1, height: 1 })
  const { visibleCount, isResetting } = useScrollSteps(sectionRef, stepRefs, langkah.length)

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined

    let frame = 0
    const updateRoute = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const bounds = section.getBoundingClientRect()
        setResponsiveRoute({
          d: getResponsiveRoute(section, stepRefs.current),
          width: bounds.width,
          height: bounds.height,
        })
      })
    }

    const resizeObserver = new ResizeObserver(updateRoute)
    resizeObserver.observe(section)
    stepRefs.current.forEach((step) => {
      if (step) resizeObserver.observe(step)
    })
    window.addEventListener('resize', updateRoute)
    updateRoute()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateRoute)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="panduan"
      aria-labelledby="cara-kerja-title"
      className={`cara-kerja-section relative z-0 isolate -mt-[7.5694cqw] min-h-[calc(100vh+160px)] w-full overflow-x-clip pb-40 pt-36 scroll-mt-[123px] max-xl:mt-0 max-xl:pt-12 xl:z-30 xl:h-[94.0278cqw] xl:min-h-0 xl:overflow-clip xl:pb-0 xl:pt-0 xl:scroll-mt-[8.5417cqw] min-[1920px]:-mt-[7.5694vw] min-[1920px]:left-1/2 min-[1920px]:-translate-x-1/2 min-[1920px]:w-[calc(100vw-15px)] min-[1920px]:max-w-[2560px] min-[1920px]:[container-type:inline-size] min-[1920px]:h-[94.0278vw]${isResetting ? ' is-resetting' : ''}`}
    >
      <div
        className="cara-kerja-mobile-hill pointer-events-none absolute inset-x-0 bottom-0 z-0 bg-guide-hill xl:hidden"
        aria-hidden="true"
      />
      <img
        src={latarCaraKerja}
        alt=""
        aria-hidden="true"
        className="cara-kerja-scene pointer-events-none absolute left-0 z-[1] h-auto w-full max-w-none select-none xl:-top-[3.5cqw] xl:h-[calc(100%+3.5cqw)]"
      />

      <div className="cara-kerja-responsive-trees pointer-events-none absolute inset-0 z-[5] xl:hidden" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <img
            key={index}
            src={pohon}
            alt=""
            className={`cara-kerja-responsive-tree cara-kerja-responsive-tree-${index + 1} absolute h-[60px] w-[30px] select-none`}
          />
        ))}
      </div>

      <svg
        className="cara-kerja-responsive-route pointer-events-none absolute inset-0 z-[6] block h-full w-full xl:hidden"
        viewBox={`0 0 ${responsiveRoute.width} ${responsiveRoute.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={responsiveRoute.d}
          fill="none"
          stroke="#2F6B4F"
          strokeDasharray="1 10"
          strokeLinecap="round"
          strokeWidth="5"
          strokeOpacity="0.72"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 z-[31] hidden xl:block" aria-hidden="true">
        {POSISI_POHON.map((position, index) => (
          <img
            key={index}
            src={pohon}
            alt=""
            className="absolute h-[4.7222cqw] w-[2.2917cqw] select-none"
            style={{
              left: `${position.left}cqw`,
              top: `${position.top}cqw`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[32] hidden xl:block" aria-hidden="true">
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
      <div className="pointer-events-none absolute inset-0 z-[33] hidden xl:block" aria-hidden="true">
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

      <div className="cara-kerja-content relative z-40 mx-auto flex w-full flex-col items-center xl:absolute xl:inset-0">
        <div className="cara-kerja-heading-badge flex h-11 items-center gap-2 rounded-full bg-guide-badge px-5 text-guide-green xl:absolute xl:left-[40cqw] xl:top-[10.5cqw] xl:h-[3.6cqw] xl:w-[20cqw] xl:justify-center xl:gap-[0.8333cqw] xl:px-[1.6667cqw]">
          <Sparkles />
          <span className="whitespace-nowrap font-sans text-sm font-bold leading-5 xl:text-[1.25cqw] xl:leading-[1.9444cqw]">
            Empat langkah mudah
          </span>
        </div>

        <h2
          id="cara-kerja-title"
          className="cara-kerja-heading mt-2 text-center font-display text-[clamp(2.5rem,8vw,4rem)] font-bold leading-none text-[#0D404F] xl:absolute xl:left-[26.8403cqw] xl:top-[14.3cqw] xl:mt-0 xl:w-[46.3194cqw] xl:text-[5cqw] xl:leading-[4.9396cqw] xl:font-optical-sizing-auto xl:tracking-[-0.03em]"
        >
          Cara Kerja
        </h2>

        <ol className="cara-kerja-step-list relative z-10 mt-[calc(clamp(10rem,23cqw,11rem)+56px)] flex w-full flex-col items-center gap-9 px-4 max-[639px]:mt-[clamp(140px,39cqw,152px)] xl:absolute xl:inset-0 xl:mt-0 xl:block xl:p-0">
          {langkah.map((step, index) => {
            const position = POSISI_KARTU[index]
            return (
              <li
                key={step.nomor}
                ref={(element) => {
                  stepRefs.current[index] = element
                }}
                className={`cara-kerja-step relative z-10 flex min-h-[190px] w-[min(84vw,360px)] flex-col rounded-[24px] border border-transparent bg-white p-5 shadow-[0_10.43px_41.74px_-25.04px_rgba(33,75,56,0.5),inset_0_0_0_1.04px_#E5E5E5] ${visibleCount > index ? 'is-visible' : ''} xl:absolute xl:left-[var(--step-left)] xl:top-[var(--step-top)] xl:h-[15.8333cqw] xl:min-h-0 xl:w-[19.0278cqw] xl:rounded-[2.0278cqw] xl:border-[0.0722cqw] xl:p-[1.7361cqw] xl:shadow-[0_0.7243cqw_2.8986cqw_-1.7389cqw_rgba(33,75,56,0.5),inset_0_0_0_0.0722cqw_#E5E5E5]`}
                style={{
                  '--step-left': `${position.left}cqw`,
                  '--step-top': `${position.top}cqw`,
                  '--tablet-left': index % 2 === 0 ? '7.3%' : '54.6%',
                  '--tablet-top': ['48cqw', '57cqw', '88cqw', '98cqw'][index],
                  '--cara-step-offset': `${JARAK_MUNCUL_PX}px`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="cara-kerja-step-number absolute right-4 top-2 font-display text-4xl font-bold leading-none text-[rgba(24,24,27,0.07)] xl:left-[14.0278cqw] xl:right-auto xl:top-[1.8056cqw] xl:text-[3.3333cqw] xl:leading-[3.3333cqw]"
                >
                  {step.nomor}
                </span>
                <span
                  aria-hidden="true"
                  className="cara-kerja-dot cara-kerja-mobile-dot absolute h-3 w-3 rounded-full shadow-[0_0_0_4.17px_#fff] xl:hidden"
                  style={{
                    backgroundColor: step.warna,
                    opacity: visibleCount > index ? 0.88 : 0,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="cara-kerja-dot cara-kerja-tablet-dot absolute hidden h-[18px] w-[18px] rounded-full border-4 border-white shadow-[0_0_0_1px_rgba(47,107,79,0.12)]"
                  style={{
                    backgroundColor: step.warna,
                    opacity: visibleCount > index ? 0.88 : 0,
                  }}
                />
                <div
                  className="cara-kerja-step-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] shadow-[0_12.52px_27.13px_-10.43px_var(--guide-icon-shadow)] xl:h-[4.4444cqw] xl:w-[4.4444cqw] xl:rounded-[1.1111cqw] xl:shadow-[0_0.8694cqw_1.884cqw_-0.7243cqw_var(--guide-icon-shadow)]"
                  style={{ backgroundColor: step.warna, '--guide-icon-shadow': step.warna }}
                >
                  <img src={step.ikon} alt="" className="h-6 w-6 select-none xl:h-[1.9444cqw] xl:w-[1.9444cqw]" />
                </div>
                <div className="cara-kerja-step-copy min-w-0">
                  <h3 className="mt-4 font-display text-lg font-semibold leading-7 text-[#14532D] xl:mt-[1.3889cqw] xl:text-[1.3889cqw] xl:leading-[2.2222cqw] xl:tracking-[-0.02em]">
                    {step.judul}
                  </h3>
                  <p className="mt-1 max-w-[222px] font-sans text-[15px] font-normal leading-6 text-[#737373] xl:mt-[0.4167cqw] xl:max-w-none xl:text-[1.1111cqw] xl:leading-[1.6667cqw]">
                    {step.deskripsi}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
