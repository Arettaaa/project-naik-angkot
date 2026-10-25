import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import { halte as halteDemo, ruasPadat as ruasDemo, trayek as trayekDemo } from '../../data/demoRute'

const CENTER = [-6.595, 106.806]

function routeCoordinates(route, stopsById) {
  return route.halte.map((stopId) => stopsById[stopId].posisi)
}

function findRouteLeg(route, fromId, toId) {
  const fromIndex = route.halte.indexOf(fromId)
  const toIndex = route.halte.indexOf(toId)
  if (fromIndex === -1 || toIndex === -1) return null
  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)
  const halte = route.halte.slice(start, end + 1)
  if (fromIndex > toIndex) halte.reverse()
  return { route, halte }
}

function findFareRoute(fromId, toId, routes) {
  const direct = routes
    .map((route) => findRouteLeg(route, fromId, toId))
    .filter(Boolean)
    .sort((a, b) => a.halte.length - b.halte.length)[0]
  if (direct) return { legs: [direct], transitAt: null }

  for (const firstRoute of routes) {
    const firstLegs = firstRoute.halte.includes(fromId)
      ? firstRoute.halte.filter((id) => id !== fromId).map((id) => findRouteLeg(firstRoute, fromId, id))
      : []
    for (const firstLeg of firstLegs) {
      if (!firstLeg) continue
      const transferId = firstLeg.halte.at(-1)
      for (const secondRoute of routes) {
        if (secondRoute === firstRoute || !secondRoute.halte.includes(toId)) continue
        const secondLeg = findRouteLeg(secondRoute, transferId, toId)
        if (secondLeg) return { legs: [firstLeg, secondLeg], transitAt: transferId }
      }
    }
  }
  return null
}

function partialCoordinates(positions, progress) {
  if (progress >= 1 || positions.length < 2) return positions
  const boundedProgress = Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) : 0
  const travelled = boundedProgress * (positions.length - 1)
  const fullPoints = Math.min(positions.length - 2, Math.floor(travelled))
  const fraction = travelled - fullPoints
  const current = positions[fullPoints] ?? positions[0]
  const next = positions[fullPoints + 1] ?? positions[positions.length - 1]
  return [
    ...positions.slice(0, fullPoints + 1),
    [current[0] + (next[0] - current[0]) * fraction, current[1] + (next[1] - current[1]) * fraction],
  ]
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (event) => setReducedMotion(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

function MapBehavior({
  activeTab,
  data,
  selectedRoute,
  visibleDensity,
  visibleRoutes,
  fareResult,
  mapStageRef,
}) {
  const map = useMap()
  const stopsById = useMemo(
    () => Object.fromEntries(data.halte.map((stop) => [stop.id, stop])),
    [data.halte],
  )

  useEffect(() => {
    const stage = mapStageRef.current
    if (!stage) return undefined

    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [map, mapStageRef])

  useEffect(() => {
    const allPositions = data.halte.map((stop) => stop.posisi)
    let positions = allPositions

    if (activeTab === 'kepadatan') {
      positions = data.ruasPadat
        .filter((road) => visibleDensity[road.id])
        .flatMap((road) => road.posisi)
    } else if (activeTab === 'eksplorasi') {
      const route = data.trayek.find((item) => item.id === selectedRoute)
      positions = route ? routeCoordinates(route, stopsById) : allPositions
    } else if (activeTab === 'filter') {
      const routes = data.trayek.filter((route) => visibleRoutes[route.id])
      positions = routes.flatMap((route) => routeCoordinates(route, stopsById))
    } else if (fareResult?.legs?.length) {
      positions = fareResult.legs.flatMap((leg) =>
        leg.halte.map((stopId) => stopsById[stopId].posisi),
      )
    }

    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [32, 32], maxZoom: 14, animate: false })
    } else {
      map.setView(CENTER, 13, { animate: false })
    }

    const firstRefresh = window.setTimeout(() => map.invalidateSize({ pan: false }), 0)
    const transitionRefresh = window.setTimeout(() => map.invalidateSize({ pan: false }), 270)
    return () => {
      window.clearTimeout(firstRefresh)
      window.clearTimeout(transitionRefresh)
    }
  }, [
    activeTab,
    data.halte,
    data.ruasPadat,
    data.trayek,
    fareResult,
    map,
    selectedRoute,
    stopsById,
    visibleDensity,
    visibleRoutes,
  ])

  return null
}

function InfoCard({ title, children, onClose, label }) {
  return (
    <section
      aria-label={label}
      className="w-full rounded-xl bg-white/95 p-3 text-[#0D404F] shadow-lg sm:max-w-[250px] lg:max-w-[18cqw] lg:rounded-[0.9cqw] lg:p-[0.9cqw]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-bold lg:text-[1.05cqw]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-base font-bold hover:bg-[#E8F6F8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087B87] lg:h-[1.5cqw] lg:w-[1.5cqw] lg:text-[1cqw]"
          aria-label="Tutup informasi"
        >
          ×
        </button>
      </div>
      <div className="mt-1 text-xs leading-relaxed lg:mt-[0.25cqw] lg:text-[0.78cqw]">{children}</div>
    </section>
  )
}

function MapControls({
  activeTab,
  data,
  selectedRoute,
  setSelectedRoute,
  visibleDensity,
  toggleDensity,
  visibleRoutes,
  toggleRoute,
  selectedRoad,
  setSelectedRoad,
  selectedStop,
  setSelectedStop,
  sourceId,
  setSourceId,
  targetId,
  setTargetId,
  onFindRoute,
  onClearResult,
  fareResult,
  isFareReady,
  validationMessage,
}) {
  const stopsById = Object.fromEntries(data.halte.map((stop) => [stop.id, stop]))
  const selectedStopRoutes = selectedStop
    ? data.trayek.filter((route) => route.halte.includes(selectedStop))
    : []
  const selectedRoadData = data.ruasPadat.find((road) => road.id === selectedRoad)

  return (
    <div className="pointer-events-none absolute inset-0 z-[410] flex flex-col justify-between p-3 lg:p-[1cqw] max-lg:relative max-lg:inset-auto max-lg:gap-3 max-lg:p-0 max-lg:pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto max-lg:w-full">
          {activeTab === 'kepadatan' && (
            <section
              aria-label="Tampilkan tingkat kepadatan"
              className="rounded-xl bg-white/95 p-3 text-[#0D404F] shadow-lg lg:rounded-[0.9cqw] lg:p-[0.85cqw]"
            >
              <h3 className="mb-2 font-display text-xs font-bold lg:mb-[0.45cqw] lg:text-[0.9cqw]">
                Tingkat kepadatan
              </h3>
              <div className="flex flex-wrap gap-2 lg:gap-[0.4cqw]">
                {data.ruasPadat.map((road) => (
                  <button
                    key={road.id}
                    type="button"
                    aria-pressed={Boolean(visibleDensity[road.id])}
                    onClick={() => toggleDensity(road.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#D7E8E9] px-2.5 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087B87] lg:gap-[0.35cqw] lg:px-[0.55cqw] lg:py-[0.25cqw] lg:text-[0.75cqw]"
                  >
                    <span
                      className="h-2 w-2 rounded-full lg:h-[0.55cqw] lg:w-[0.55cqw]"
                      style={{ backgroundColor: road.warna, opacity: visibleDensity[road.id] ? 1 : 0.3 }}
                    />
                    {road.tingkat}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'eksplorasi' && (
            <section
              aria-label="Pilih trayek untuk dijelajahi"
              className="rounded-xl bg-white/95 p-3 text-[#0D404F] shadow-lg lg:w-[16cqw] lg:rounded-[0.9cqw] lg:p-[0.8cqw]"
            >
              <h3 className="mb-2 font-display text-xs font-bold lg:mb-[0.45cqw] lg:text-[0.9cqw]">
                Pilih trayek
              </h3>
              <div className="grid gap-1.5 lg:gap-[0.4cqw]">
                {data.trayek.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    aria-pressed={selectedRoute === route.id}
                    onClick={() => setSelectedRoute(route.id)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087B87] lg:gap-[0.45cqw] lg:rounded-[0.55cqw] lg:px-[0.5cqw] lg:py-[0.45cqw] lg:text-[0.72cqw] ${
                      selectedRoute === route.id
                        ? 'border-[#0D8790] bg-[#E8F6F8]'
                        : 'border-[#E0ECEC] hover:bg-[#F3FAFB]'
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-[3px] lg:h-[0.8cqw] lg:w-[0.8cqw]"
                      style={{ backgroundColor: route.warna }}
                    />
                    <span>
                      <span className="block font-bold">{route.id}</span>
                      <span className="block font-normal">{route.nama}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'filter' && (
            <section
              aria-label="Tampilkan trayek"
              className="rounded-xl bg-white/95 p-3 text-[#0D404F] shadow-lg lg:rounded-[0.9cqw] lg:p-[0.85cqw]"
            >
              <h3 className="mb-2 font-display text-xs font-bold lg:mb-[0.45cqw] lg:text-[0.9cqw]">
                Trayek di peta
              </h3>
              <div className="flex flex-wrap gap-2 lg:gap-[0.4cqw]">
                {data.trayek.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    aria-pressed={Boolean(visibleRoutes[route.id])}
                    onClick={() => toggleRoute(route.id)}
                    className="rounded-full border border-[#D7E8E9] px-2.5 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087B87] lg:px-[0.55cqw] lg:py-[0.25cqw] lg:text-[0.75cqw]"
                    style={{ opacity: visibleRoutes[route.id] ? 1 : 0.45 }}
                  >
                    {route.id}
                  </button>
                ))}
              </div>
              {selectedStop && (
                <div className="mt-3 border-t border-[#D7E8E9] pt-2 lg:mt-[0.7cqw] lg:pt-[0.5cqw]">
                  <InfoCard
                    label="Informasi halte terpilih"
                    title={stopsById[selectedStop].nama}
                    onClose={() => setSelectedStop(null)}
                  >
                    <p>
                      Trayek: {selectedStopRoutes.length
                        ? selectedStopRoutes.map((route) => route.id).join(', ')
                        : 'Belum ada trayek'}
                    </p>
                    <p className="mt-1">Perkiraan waktu tunggu: 5–12 menit.</p>
                  </InfoCard>
                </div>
              )}
            </section>
          )}

          {activeTab === 'tarif' && (
            <section
              aria-label="Cari rekomendasi rute dan tarif"
              className="rounded-xl bg-white/95 p-3 text-[#0D404F] shadow-lg lg:w-[16cqw] lg:rounded-[0.9cqw] lg:p-[0.8cqw]"
            >
              <h3 className="mb-2 font-display text-xs font-bold lg:mb-[0.45cqw] lg:text-[0.9cqw]">
                Cari perjalanan
              </h3>
              <label className="mb-2 block text-xs font-semibold lg:mb-[0.45cqw] lg:text-[0.72cqw]">
                Dari
                <select
                  value={sourceId}
                  onChange={(event) => {
                    onClearResult()
                    setSourceId(event.target.value)
                  }}
                  className="mt-1 block w-full rounded-md border border-[#C9DDDF] bg-white px-2 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087B87] lg:mt-[0.2cqw] lg:rounded-[0.35cqw] lg:px-[0.4cqw] lg:py-[0.3cqw] lg:text-[0.7cqw]"
                >
                  {data.halte.map((stop) => (
                    <option key={stop.id} value={stop.id}>{stop.nama}</option>
                  ))}
                </select>
              </label>
              <label className="mb-2 block text-xs font-semibold lg:mb-[0.45cqw] lg:text-[0.72cqw]">
                Ke
                <select
                  value={targetId}
                  onChange={(event) => {
                    onClearResult()
                    setTargetId(event.target.value)
                  }}
                  className="mt-1 block w-full rounded-md border border-[#C9DDDF] bg-white px-2 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087B87] lg:mt-[0.2cqw] lg:rounded-[0.35cqw] lg:px-[0.4cqw] lg:py-[0.3cqw] lg:text-[0.7cqw]"
                >
                  {data.halte.map((stop) => (
                    <option key={stop.id} value={stop.id}>{stop.nama}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={onFindRoute}
                className="w-full rounded-full bg-[#087B65] px-3 py-2 text-xs font-bold text-white hover:bg-[#05634F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D404F] lg:py-[0.4cqw] lg:text-[0.75cqw]"
              >
                Cari Rute
              </button>
              {validationMessage && (
                <p role="alert" className="mt-2 text-xs font-semibold text-[#A83232] lg:mt-[0.4cqw] lg:text-[0.72cqw]">
                  {validationMessage}
                </p>
              )}
              {fareResult && (fareResult.status === 'none' || isFareReady) && (
                <div aria-live="polite" className="mt-2 border-t border-[#D7E8E9] pt-2 text-xs lg:mt-[0.5cqw] lg:pt-[0.45cqw] lg:text-[0.7cqw]">
                  {fareResult.status === 'none' ? (
                    <p className="font-semibold">Belum ada rute yang sesuai.</p>
                  ) : (
                    <>
                      <p className="font-bold">
                        {fareResult.legs.map((leg) => leg.route.id).join(' → ')}
                      </p>
                      <p className="mt-1">
                        {fareResult.legs.length === 1
                          ? `${fareResult.legs[0].route.menit} menit · tanpa transit`
                          : `${fareResult.legs.reduce((sum, leg) => sum + leg.route.menit, 0)} menit · 1 transit di ${stopsById[fareResult.transitAt].nama}`}
                      </p>
                      <p className="mt-1 font-bold">
                        Perkiraan tarif: Rp {(fareResult.legs.length * 5000).toLocaleString('id-ID')}
                      </p>
                    </>
                  )}
                  <p className="mt-1 text-[10px] leading-tight opacity-75 lg:text-[0.58cqw]">
                    Data contoh untuk demo, bukan data resmi.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="pointer-events-auto max-lg:w-full">
          {selectedRoadData && activeTab === 'kepadatan' && (
            <InfoCard
              label="Informasi ruas jalan terpilih"
              title={selectedRoadData.nama}
              onClose={() => setSelectedRoad(null)}
            >
              <p>
                Kepadatan: <strong>{selectedRoadData.tingkat}</strong>
              </p>
              <p className="mt-1">Perkiraan {selectedRoadData.jumlahTrayek} trayek melintas.</p>
            </InfoCard>
          )}
        </div>
      </div>

      <div className="pointer-events-auto flex justify-end max-lg:flex-col max-lg:gap-2">
        <section
          aria-label={`Legenda ${activeTab === 'kepadatan' ? 'kepadatan jalan' : 'jalur angkot'}`}
          className="ml-auto rounded-lg bg-white/95 px-3 py-2 text-[#0D404F] shadow-md lg:rounded-[0.65cqw] lg:px-[0.75cqw] lg:py-[0.55cqw]"
        >
          <h3 className="font-display text-[10px] font-bold uppercase tracking-wide lg:text-[0.62cqw]">
            {activeTab === 'kepadatan' ? 'KEPADATAN JALAN' : 'RUTE ANGKOT'}
          </h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] lg:mt-[0.25cqw] lg:gap-x-[0.7cqw] lg:gap-y-[0.2cqw] lg:text-[0.6cqw]">
            {(activeTab === 'kepadatan'
              ? data.ruasPadat.map((road) => ({ id: road.id, nama: road.tingkat, warna: road.warna }))
              : data.trayek.map((route) => ({ id: route.id, nama: route.id, warna: route.warna }))
            ).map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1">
                <span className="h-1.5 w-4 rounded-full lg:h-[0.3cqw] lg:w-[1cqw]" style={{ background: item.warna }} />
                {item.nama}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function PetaFitur({
  activeTab,
  data = { halte: halteDemo, trayek: trayekDemo, ruasPadat: ruasDemo },
  selectedRoute,
  setSelectedRoute,
  visibleDensity,
  toggleDensity,
  visibleRoutes,
  toggleRoute,
}) {
  const mapStageRef = useRef(null)
  const [selectedRoad, setSelectedRoad] = useState(null)
  const [selectedStop, setSelectedStop] = useState(null)
  const [sourceId, setSourceId] = useState(data.halte[0].id)
  const [targetId, setTargetId] = useState(data.halte[3].id)
  const [fareResult, setFareResult] = useState(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [routeProgress, setRouteProgress] = useState(1)
  const reducedMotion = useReducedMotion()
  const stopsById = useMemo(
    () => Object.fromEntries(data.halte.map((stop) => [stop.id, stop])),
    [data.halte],
  )

  useEffect(() => {
    if (!fareResult?.legs?.length || reducedMotion) return undefined

    const startTime = performance.now()
    let frameId
    const advance = (now) => {
      const progress = Math.min((now - startTime) / 1000, 1)
      setRouteProgress(progress)
      if (progress < 1) frameId = window.requestAnimationFrame(advance)
    }
    frameId = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frameId)
  }, [fareResult, reducedMotion])

  const handleFindRoute = () => {
    setSelectedStop(null)
    if (sourceId === targetId) {
      setFareResult(null)
      setRouteProgress(1)
      setValidationMessage('Pilih halte tujuan yang berbeda dari halte asal.')
      return
    }

    setValidationMessage('')
    const result = findFareRoute(sourceId, targetId, data.trayek)
    setFareResult(result ? { ...result, status: 'found' } : { status: 'none', legs: [] })
    setRouteProgress(result && !reducedMotion ? 0 : 1)
  }

  const handleClearResult = () => {
    setFareResult(null)
    setRouteProgress(1)
    setValidationMessage('')
  }

  const visibleProgress = reducedMotion ? 1 : routeProgress
  const fareSegments = fareResult?.legs?.flatMap((leg) => {
    const route = leg.route
    const positions = leg.halte.map((stopId) => stopsById[stopId].posisi)
    return [{
      id: `${route.id}-${leg.halte[0]}-${leg.halte.at(-1)}`,
      route,
      positions: partialCoordinates(positions, visibleProgress),
    }]
  }) ?? []

  const allVisibleRoutesOff = !data.trayek.some((route) => visibleRoutes[route.id])
  const endpoints = activeTab === 'eksplorasi'
    ? data.trayek.find((route) => route.id === selectedRoute)?.halte
    : null
  const fareEndpoints = fareResult?.status === 'found' && visibleProgress >= 1
    ? [sourceId, targetId, fareResult.transitAt].filter(Boolean)
    : []

  return (
    <div className="fitur-map relative isolate h-full w-full overflow-visible [container-type:inline-size] max-lg:h-auto">
      <div
        ref={mapStageRef}
        className="fitur-map-stage relative h-full overflow-hidden rounded-[18px] bg-[#E8F6F8] lg:rounded-[1.875cqw] max-lg:h-[420px]"
      >
        <MapContainer
          center={CENTER}
          zoom={13}
          minZoom={10}
          maxZoom={18}
          scrollWheelZoom={false}
          zoomControl={false}
          className="!absolute !inset-0 !z-0 !h-full !w-full"
          aria-label="Peta interaktif trayek dan halte angkot Kota Bogor"
        >
          {/* The unauthenticated CARTO endpoint returns an API-key placeholder; keep the live OSM map as the fallback. */}
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
            opacity={0.78}
          />
          <ZoomControl position="topleft" />
          <MapBehavior
            activeTab={activeTab}
            data={data}
            selectedRoute={selectedRoute}
            visibleDensity={visibleDensity}
            visibleRoutes={visibleRoutes}
            fareResult={fareResult}
            mapStageRef={mapStageRef}
          />

          {activeTab === 'kepadatan' && data.ruasPadat.map((road) => (
            visibleDensity[road.id] && (
              <Polyline
                key={road.id}
                positions={road.posisi}
                pathOptions={{ color: road.warna, weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
                eventHandlers={{ click: () => setSelectedRoad(road.id) }}
              />
            )
          ))}

          {activeTab === 'eksplorasi' && data.trayek.map((route) => (
            <Polyline
              key={route.id}
              positions={routeCoordinates(route, stopsById)}
              pathOptions={{
                color: route.warna,
                weight: route.id === selectedRoute ? 7 : 4,
                opacity: route.id === selectedRoute ? 1 : 0.15,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          ))}

          {activeTab === 'filter' && data.trayek.map((route) => (
            visibleRoutes[route.id] && (
              <Polyline
                key={route.id}
                positions={routeCoordinates(route, stopsById)}
                pathOptions={{ color: route.warna, weight: 5, opacity: 0.82, lineCap: 'round', lineJoin: 'round' }}
              />
            )
          ))}

          {activeTab === 'tarif' && fareSegments.map((segment) => (
            segment.positions.length > 1 && (
              <Polyline
                key={segment.id}
                positions={segment.positions}
                pathOptions={{
                  color: segment.route.warna,
                  weight: 7,
                  opacity: 1,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )
          ))}

          {activeTab !== 'kepadatan' && data.halte.map((stop) => {
            const showAllStops = activeTab === 'filter'
            const onSelectedRoute = endpoints?.includes(stop.id)
            const isFareStop = fareEndpoints.includes(stop.id)
            const shouldShow = showAllStops
              ? data.trayek.some((route) => visibleRoutes[route.id] && route.halte.includes(stop.id))
              : activeTab === 'tarif'
                ? isFareStop
                : onSelectedRoute
            if (!shouldShow) return null

            const color = stop.warna ?? data.trayek.find((route) => route.halte.includes(stop.id))?.warna ?? '#087B87'
            return (
              <CircleMarker
                key={stop.id}
                center={stop.posisi}
                radius={activeTab === 'tarif' && isFareStop ? 9 : 7}
                pathOptions={{ color, weight: 3, fillColor: '#FFFFFF', fillOpacity: 1 }}
                eventHandlers={activeTab === 'filter' ? { click: () => setSelectedStop(stop.id) } : undefined}
              >
                <Tooltip
                  permanent
                  direction="right"
                  offset={[8, 0]}
                  className="feature-stop-label"
                >
                  {stop.nama}
                </Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>
        <div className="pointer-events-none absolute inset-0 z-[399] bg-[#CDEFF3]/20" aria-hidden="true" />
        {activeTab === 'filter' && allVisibleRoutesOff && (
          <p className="pointer-events-none absolute left-1/2 top-1/2 z-[401] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white/95 px-4 py-2 text-center text-sm font-semibold text-[#0D404F] shadow lg:text-[0.9cqw]">
            Tidak ada trayek yang ditampilkan
          </p>
        )}
      </div>

      <div
        role="presentation"
        className="fitur-tab-enter pointer-events-none absolute inset-0 z-[410] max-lg:relative max-lg:inset-auto"
        key={activeTab}
      >
        <MapControls
          activeTab={activeTab}
          data={data}
          selectedRoute={selectedRoute}
          setSelectedRoute={setSelectedRoute}
          visibleDensity={visibleDensity}
          toggleDensity={toggleDensity}
          visibleRoutes={visibleRoutes}
          toggleRoute={toggleRoute}
          selectedRoad={selectedRoad}
          setSelectedRoad={setSelectedRoad}
          selectedStop={selectedStop}
          setSelectedStop={setSelectedStop}
          sourceId={sourceId}
          setSourceId={setSourceId}
          targetId={targetId}
          setTargetId={setTargetId}
          onFindRoute={handleFindRoute}
          onClearResult={handleClearResult}
          fareResult={fareResult}
          isFareReady={visibleProgress >= 1}
          validationMessage={validationMessage}
        />
      </div>
    </div>
  )
}
