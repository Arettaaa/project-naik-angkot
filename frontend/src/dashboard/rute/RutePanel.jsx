import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { api } from '../../api/naik'
import useApi from '../../hooks/useApi'
import { useDashboard } from '../context'
import { Floating } from '../ui'
import { IconChevronDown, IconRoute } from '../icons'
import { batas, layarBesar, nomor } from '../lib'
import RutePopup from '../components/RutePopup'
import DaftarRute from './DaftarRute'
import DetailRute from './DetailRute'
import ChipRute from './ChipRute'
import LayerRuteTerpilih from './LayerRuteTerpilih'

// Menu Rute: Daftar Rute + popup + Detail Rute + chip + simulasi perjalanan.
export default function RutePanel() {
  const { kode } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const map = useMap()
  const { trayek, rute, muatUlang } = useDashboard()

  const [daftarBuka, setDaftarBuka] = useState(false) // default tertutup: pengguna yang membuka sendiri
  const [detailBuka, setDetailBuka] = useState(true)
  const [ruteId, setRuteId] = useState(null)
  const [popup, setPopup] = useState(null)
  const [simulasiAktif, setSimulasiAktif] = useState(false)

  const kodePenuh = useMemo(() => {
    if (!kode) return null
    const nomorTarget = nomor(kode)
    const cocok = rute.data?.features.find((f) => nomor(f.properties.kode_trayek) === nomorTarget)
    return cocok?.properties.kode_trayek || `Trayek ${nomorTarget.padStart(2, '0')}`
  }, [kode, rute.data])

  const fitur = useMemo(() => {
    if (!rute.data || !kode) return []
    const nomorTarget = nomor(kode)
    return rute.data.features.filter((f) => nomor(f.properties.kode_trayek) === nomorTarget)
  }, [rute.data, kode])

  const dipilih = fitur.find((f) => f.properties.rute_id === ruteId) ?? fitur[0]
  const lainnya = fitur.filter((f) => f !== dipilih)
  const detail = useApi(kode ? () => api.detailTrayek(kode) : null, [kode])
  const arahDetail = detail.data?.rute.find((r) => r.rute_id === dipilih?.properties.rute_id)
  // beri tahu tombol "Tanya AI" (HP) supaya menyingkir saat daftar rute terbuka
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('naik:daftar-rute', { detail: daftarBuka }))
    return () => window.dispatchEvent(new CustomEvent('naik:daftar-rute', { detail: false }))
  }, [daftarBuka])
  const [titikAktif, setTitikAktif] = useState(null)
  const [poiAktif, setPoiAktif] = useState(null)

  useEffect(() => {
    setTitikAktif(null)
    setPoiAktif(null)
  }, [kodePenuh, ruteId])

  // Reset simulasi saat ganti rute/trayek
  useEffect(() => {
    setSimulasiAktif(false)
  }, [kodePenuh, ruteId])

  // arah dari ?arah=rute_id (mis. dari popup Beranda), default arah pertama
  useEffect(() => {
    const a = Number(search.get('arah'))
    setRuteId(Number.isFinite(a) && a > 0 ? a : null)
    setDetailBuka(true)
    if (kodePenuh && !layarBesar()) setDaftarBuka(false) // di HP daftar ditutup supaya peta kelihatan
  }, [kodePenuh, search])

  // zoom ke rute terpilih. Popup tidak dibuka otomatis: info yang sama sudah ada di panel Detail Rute,
  // popup cuma muncul kalau garis rute diklik.
  const paskan = useCallback(() => {
    if (!dipilih) return
    const b = batas(dipilih)
    if (b.isValid())
      map.flyToBounds(
        b,
        layarBesar()
          ? { paddingTopLeft: [440, 40], paddingBottomRight: [420, 60], duration: 0.6 }
          : { paddingTopLeft: [20, 80], paddingBottomRight: [20, Math.round(window.innerHeight * 0.52)], duration: 0.6 },
      )
  }, [dipilih, map])
  useEffect(() => {
    setPopup(null)
    paskan()
  }, [paskan])

  function bukaDetail(p) {
    if (p.kode_trayek === kodePenuh) {
      setRuteId(p.rute_id)
      setDetailBuka(true)
    } else navigate(`/rute/${nomor(p.kode_trayek)}?arah=${p.rute_id}`)
  }

  return (
    <>
      <Floating className={`top-3 left-3 right-3 ${kode && !daftarBuka ? 'max-lg:right-[64px]' : ''} flex max-h-[calc(55%-12px)] flex-col lg:right-auto lg:bottom-3 lg:left-[94px] lg:max-h-none lg:w-[340px]`}>
        {daftarBuka ? (
          <DaftarRute
            trayek={trayek}
            kodeAktif={kodePenuh}
            onPilih={(t) => navigate(`/rute/${nomor(t.kode_trayek)}`)}
            onClose={() => setDaftarBuka(false)}
            onRetry={muatUlang}
          />
        ) : (
          <button
            type="button"
            onClick={() => setDaftarBuka(true)}
            aria-expanded="false"
            aria-label="Buka daftar rute angkot"
            className="group flex w-fit max-w-full items-center gap-3 rounded-2xl bg-white py-2 pr-3.5 pl-2 text-left shadow-[0_8px_30px_rgba(21,30,44,0.14)] ring-1 ring-primary/15 transition hover:ring-primary/40 active:scale-[0.98]"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E3F4EC] text-primary">
              <IconRoute className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
              </span>
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[15px] leading-tight font-bold text-tentang-dark">Daftar Rute</span>
              <span className="mt-0.5 block text-[12px] leading-tight text-dark/55">
                {trayek.data?.length ? `${trayek.data.length} rute · ketuk untuk memilih` : 'Ketuk untuk memilih rute'}
              </span>
            </span>
            <IconChevronDown className="h-4 w-4 shrink-0 text-dark/40 transition group-hover:text-primary" />
          </button>
        )}
      </Floating>

      {dipilih && detailBuka && (
        <DetailRute
          fitur={dipilih}
          detail={detail}
          bisaBalik={lainnya.length > 0}
          onBalik={() => setRuteId(lainnya[0].properties.rute_id)}
          onClose={() => setDetailBuka(false)}
          simulasiAktif={simulasiAktif}
          onMulaiSimulasi={() => {
            setPopup(null)
            setSimulasiAktif(true)
            if (!layarBesar()) setDetailBuka(false) // HP: panel detail menutupi angkot yang diikuti kamera
          }}
          onHentikanSimulasi={() => {
            setSimulasiAktif(false)
            paskan()
          }}
          onPilihTitik={(idx) => {
            setPoiAktif(null)
            setTitikAktif({ idx, n: Date.now() })
          }}
          poiAktifId={poiAktif?.poi_id}
          onPilihPoi={(poi) => {
            setTitikAktif(null)
            setPoiAktif(poi)
            if (poi?.koordinat?.lat != null && poi?.koordinat?.lon != null) {
              map.flyTo([poi.koordinat.lat, poi.koordinat.lon], Math.max(map.getZoom(), 16), { duration: 0.5 })
            }
          }}
          onTampilkan={() => {
            setSimulasiAktif(false)
            setPoiAktif(null)
            paskan()
          }}
        />
      )}

      {poiAktif?.koordinat?.lat != null && poiAktif?.koordinat?.lon != null && (
        <CircleMarker
          center={[poiAktif.koordinat.lat, poiAktif.koordinat.lon]}
          radius={9}
          pathOptions={{ color: '#fff', weight: 3, fillColor: '#1A936F', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]} className="naik-tag-jalan font-semibold">
            {poiAktif.nama}
          </Tooltip>
        </CircleMarker>
      )}

      {dipilih && !simulasiAktif && <ChipRute rute={dipilih.properties} />}

      <LayerRuteTerpilih
        semua={!kodePenuh ? rute.data : null}
        dipilih={dipilih}
        lainnya={lainnya}
        titikJalan={arahDetail?.titik_jalan}
        halte={arahDetail?.halte}
        titikAktif={titikAktif}
        onKlik={(posisi, props) => setPopup({ posisi, props })}
        simulasiAktif={simulasiAktif}
        onMulaiSimulasi={() => {
          setPopup(null)
          setSimulasiAktif(true)
        }}
        onSelesaiSimulasi={() => {
          setSimulasiAktif(false)
          setDetailBuka(true)
          paskan()
        }}
      />

      <RutePopup
        posisi={popup?.posisi}
        rute={popup?.props}
        onClose={() => setPopup(null)}
        onDetail={() => {
          bukaDetail(popup.props)
          setPopup(null)
        }}
        onSimulasi={
          popup?.props.kode_trayek === kodePenuh
            ? () => {
                setRuteId(popup.props.rute_id)
                setPopup(null)
                setSimulasiAktif(true)
              }
            : undefined
        }
      />
    </>
  )
}
