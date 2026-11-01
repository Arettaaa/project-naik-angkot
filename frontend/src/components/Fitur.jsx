import { lazy, Suspense, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import demoRute from '../data/demoRute'

const PetaFitur = lazy(() => import('./fitur/PetaFitur'))

const TABS = [
  { id: 'kepadatan', label: 'Peta Kepadatan' },
  { id: 'eksplorasi', label: 'Eksplorasi Rute' },
  { id: 'filter', label: 'Filter & Pop-up' },
  { id: 'tarif', label: 'Rekomendasi & Tarif' },
]

export default function Fitur({ data = demoRute }) {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const [selectedRoute, setSelectedRoute] = useState(data.trayek[0].id)
  const [visibleDensity, setVisibleDensity] = useState(() =>
    Object.fromEntries(data.ruasPadat.map((road) => [road.id, true])),
  )
  const [visibleRoutes, setVisibleRoutes] = useState(() =>
    Object.fromEntries(data.trayek.map((route) => [route.id, true])),
  )
  const tabRefs = useRef([])
  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab)

  const focusTab = (index) => {
    const nextIndex = (index + TABS.length) % TABS.length
    setActiveTab(TABS[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  const handleTabKeyDown = (event, index) => {
    const mobile = window.matchMedia('(max-width: 1023px)').matches
    const offsets = mobile
      ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }
      : { ArrowUp: -1, ArrowDown: 1 }
    const offset = offsets[event.key]

    if (offset !== undefined) {
      event.preventDefault()
      focusTab(index + offset)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusTab(TABS.length - 1)
    }
  }

  const toggleDensity = (id) => {
    setVisibleDensity((current) => ({ ...current, [id]: !current[id] }))
  }

  const toggleRoute = (id) => {
    setVisibleRoutes((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <section
      id="fitur"
      className="relative z-20 -mt-16 md:-mt-28 lg:-mt-px min-h-[760px] w-full overflow-hidden bg-transparent pb-10 scroll-mt-[123px] lg:h-[72.2222cqw] lg:min-h-0 lg:pb-0 lg:scroll-mt-[8.5417cqw]"
    >
      <div className="relative mx-auto w-full max-w-[1920px] [container-type:inline-size]">
        <header className="relative -translate-y-2 px-5 pt-[max(9.5rem,calc(32.5cqw+1rem))] text-right lg:absolute lg:right-[8.3333cqw] lg:top-[3cqw] lg:w-[51.3889cqw] lg:translate-y-0 lg:px-0 lg:pt-0">
          <h2 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[0.92] text-[#0D404F] lg:text-[4.1667cqw] lg:leading-[3.8417cqw]">
            Fitur Utama
          </h2>
          <p className="mt-2 font-sans text-base font-medium leading-snug text-[#0D404F] sm:text-lg lg:mt-[0.7639cqw] lg:text-[2.5cqw] lg:leading-[3.8417cqw]">
            Cek kepadatan jalan dan pilih rute.
            <br />
            Saring halte untuk cari rute dan tarif.
          </p>
        </header>

        <div className="relative mx-4 mt-8 rounded-[24px] bg-[#086342] p-3 shadow-[0_12px_30px_rgba(10,77,56,0.14)] sm:mx-6 sm:p-4 lg:absolute lg:left-[8.2639cqw] lg:top-[17.2917cqw] lg:mx-0 lg:mt-0 lg:h-[46.1111cqw] lg:w-[83.4028cqw] lg:rounded-[2.7778cqw] lg:p-0 lg:shadow-none">
          <div
            role="tablist"
            aria-label="Fitur peta NAIK"
            className="fitur-tablist mb-3 grid grid-cols-2 gap-2 pb-1 lg:absolute lg:left-[3.125cqw] lg:top-[2.8472cqw] lg:mb-0 lg:w-[20.4167cqw] lg:grid-cols-1 lg:grid-rows-4 lg:gap-x-0 lg:gap-y-[2.2917cqw] lg:pb-0"
          >
            {TABS.map((tab, index) => (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                id={`fitur-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="fitur-tabpanel"
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`flex min-h-11 w-full items-center justify-center rounded-full border-2 px-2 py-2 text-center font-sans text-[clamp(0.7rem,2.4vw,0.875rem)] font-semibold leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:h-[5cqw] lg:min-h-0 lg:border-[0.2083cqw] lg:px-[0.8cqw] lg:py-0 lg:text-[1.5278cqw] ${
                  activeTab === tab.id
                    ? 'border-[#BAE59E] bg-[#BAE59E] text-[#0D404F] shadow-[0_0.55cqw_1cqw_rgba(0,0,0,0.18)]'
                    : 'border-[#C6EDA4] bg-transparent text-[#C6EDA4] hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id="fitur-tabpanel"
            role="tabpanel"
            aria-labelledby={`fitur-tab-${TABS[activeIndex].id}`}
            className="relative h-auto w-full rounded-[18px] lg:absolute lg:left-[26.6667cqw] lg:top-[2.8472cqw] lg:h-[40.4167cqw] lg:w-[53.75cqw] lg:rounded-[1.875cqw]"
          >
            <Suspense
              fallback={
                <div
                  className="h-[420px] animate-pulse rounded-[18px] bg-[#E8F6F8] lg:h-full lg:rounded-[1.875cqw]"
                  aria-label="Memuat peta"
                />
              }
            >
              <PetaFitur
                activeTab={activeTab}
                data={data}
                selectedRoute={selectedRoute}
                setSelectedRoute={setSelectedRoute}
                visibleDensity={visibleDensity}
                toggleDensity={toggleDensity}
                visibleRoutes={visibleRoutes}
                toggleRoute={toggleRoute}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  )
}
