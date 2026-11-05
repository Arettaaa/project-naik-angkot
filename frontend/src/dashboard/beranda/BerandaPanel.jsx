import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMap } from 'react-leaflet'
import { useDashboard } from '../context'
import { Floating } from '../ui'
import { IconFilter } from '../icons'
import { batas, nomor } from '../lib'
import RutePopup from '../components/RutePopup'
import RuasPopup from '../components/RuasPopup'
import FilterRute from './FilterRute'
import LayerPanel from './LayerPanel'
import Legenda from './Legenda'
import LayerJalan from './LayerJalan'
import LayerRute from './LayerRute'

// Menu Beranda: Filter Rute + Layer + Legenda + layer peta.
export default function BerandaPanel() {
  const { trayek, rute, kepadatan, butuhKepadatan, layers, setLayers, filter, setFilter, muatUlang } = useDashboard()
  const navigate = useNavigate()
  const map = useMap()
  const [filterBuka, setFilterBuka] = useState(true)
  const [ruas, setRuas] = useState(null)
  const [rutePop, setRutePop] = useState(null)

  useEffect(() => {
    if (layers.jalan || layers.kepadatan) butuhKepadatan()
  }, [layers.jalan, layers.kepadatan, butuhKepadatan])

  const adaFilter = Boolean(filter.kode || filter.asal || filter.tujuan)
  const ruteTampil = useMemo(() => {
    if (!rute.data) return null
    const features = rute.data.features.filter(
      ({ properties: p }) => (!filter.kode || p.kode_trayek === filter.kode) && (!filter.asal || p.asal === filter.asal) && (!filter.tujuan || p.tujuan === filter.tujuan),
    )
    return { ...rute.data, features }
  }, [rute.data, filter])

  // zoom ke hasil filter
  useEffect(() => {
    if (!adaFilter || !ruteTampil?.features.length) return
    const b = batas(ruteTampil)
    if (b.isValid()) map.fitBounds(b, { padding: [60, 60] })
  }, [adaFilter, ruteTampil, map])

  // saat kepadatan aktif tanpa filter, garis rute disembunyikan supaya warna kepadatan terbaca
  const tampilRute = layers.rute && (!layers.kepadatan || adaFilter)

  return (
    <>
      <Floating className="top-3 left-3 right-3 flex max-h-[calc(100%-112px)] flex-col gap-3 lg:right-auto lg:left-[94px] lg:max-h-[calc(100%-24px)] lg:w-[320px]">
        {filterBuka ? (
          <FilterRute
            trayek={trayek}
            filter={filter}
            jumlahHasil={ruteTampil?.features.length}
            onTerapkan={(f) => {
              setFilter(f)
              setLayers((l) => ({ ...l, rute: true }))
            }}
            onReset={() => setFilter({ kode: '', asal: '', tujuan: '' })}
            onClose={() => setFilterBuka(false)}
            onRetry={muatUlang}
          />
        ) : (
          <button
            onClick={() => setFilterBuka(true)}
            className="inline-flex h-12 w-fit items-center gap-2 rounded-2xl bg-white px-4 text-[15px] font-semibold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.12)]"
          >
            <IconFilter className="h-4 w-4 text-primary" /> Filter Rute
            {adaFilter && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
        )}
        <LayerPanel layers={layers} setLayers={setLayers} loading={kepadatan.loading} error={kepadatan.error} />
      </Floating>

      <Legenda
        catatan={
          layers.rute && layers.kepadatan && !adaFilter ? <p className="mt-1.5 text-[12px] text-dark/50">Garis rute disembunyikan saat kepadatan aktif.</p> : null
        }
      />

      {(layers.jalan || layers.kepadatan) && (
        <LayerJalan
          data={kepadatan.data}
          kepadatan={layers.kepadatan}
          onPilih={(x) => {
            setRutePop(null)
            setRuas(x)
          }}
        />
      )}
      {tampilRute && (
        <LayerRute
          data={ruteTampil}
          tebal={adaFilter ? 5 : 3}
          onPilih={(x) => {
            setRuas(null)
            setRutePop(x)
          }}
        />
      )}
      <RuasPopup posisi={ruas?.posisi} ruas={ruas?.props} onClose={() => setRuas(null)} />
      <RutePopup
        posisi={rutePop?.posisi}
        rute={rutePop?.props}
        onClose={() => setRutePop(null)}
        onDetail={() => navigate(`/rute/${nomor(rutePop.props.kode_trayek)}?arah=${rutePop.props.rute_id}`)}
      />
    </>
  )
}