import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMap } from 'react-leaflet'
import { api } from '../../api/naik'
import useApi from '../../hooks/useApi'
import { useDashboard } from '../context'
import { Floating } from '../ui'
import { IconRoute } from '../icons'
import { batas, layarBesar, nomor, titikTengah } from '../lib'
import RutePopup from '../components/RutePopup'
import DaftarRute from './DaftarRute'
import DetailRute from './DetailRute'
import ChipRute from './ChipRute'
import LayerRuteTerpilih from './LayerRuteTerpilih'

// Menu Rute: Daftar Rute + popup + Detail Rute + chip.
export default function RutePanel() {
  const { kode } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const map = useMap()
  const { trayek, rute, muatUlang } = useDashboard()

  const [daftarBuka, setDaftarBuka] = useState(true)
  const [detailBuka, setDetailBuka] = useState(true)
  const [ruteId, setRuteId] = useState(null)
  const [popup, setPopup] = useState(null)

  const kodePenuh = kode ? `Trayek ${nomor(kode).padStart(2, '0')}` : null
  const fitur = useMemo(() => rute.data?.features.filter((f) => f.properties.kode_trayek === kodePenuh) ?? [], [rute.data, kodePenuh])
  const dipilih = fitur.find((f) => f.properties.rute_id === ruteId) ?? fitur[0]
  const lainnya = fitur.filter((f) => f !== dipilih)
  const detail = useApi(kodePenuh ? () => api.detailTrayek(kodePenuh) : null, [kodePenuh])

  // arah dari ?arah=rute_id (mis. dari popup Beranda), default arah pertama
  useEffect(() => {
    const a = Number(search.get('arah'))
    setRuteId(Number.isFinite(a) && a > 0 ? a : null)
    setDetailBuka(true)
    if (kodePenuh && !layarBesar()) setDaftarBuka(false) // di HP daftar ditutup supaya peta kelihatan
  }, [kodePenuh, search])

  // zoom ke rute terpilih (+ popup di layar besar)
  useEffect(() => {
    if (!dipilih) return setPopup(null)
    const b = batas(dipilih)
    if (b.isValid())
      map.fitBounds(b, layarBesar() ? { paddingTopLeft: [440, 40], paddingBottomRight: [420, 120] } : { paddingTopLeft: [20, 80], paddingBottomRight: [20, Math.round(window.innerHeight * 0.55)] })
    setPopup(layarBesar() ? { posisi: titikTengah(dipilih), props: dipilih.properties } : null)
  }, [dipilih, map])

  function bukaDetail(p) {
    if (p.kode_trayek === kodePenuh) {
      setRuteId(p.rute_id)
      setDetailBuka(true)
    } else navigate(`/rute/${nomor(p.kode_trayek)}?arah=${p.rute_id}`)
  }

  return (
    <>
      <Floating className="top-3 left-3 right-3 flex max-h-[calc(55%-12px)] flex-col lg:right-auto lg:bottom-3 lg:left-[94px] lg:max-h-none lg:w-[340px]">
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
            onClick={() => setDaftarBuka(true)}
            className="inline-flex h-12 w-fit items-center gap-2 rounded-2xl bg-white px-4 text-[15px] font-semibold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.12)]"
          >
            <IconRoute className="h-4 w-4 text-primary" /> Daftar Rute
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
          onTampilkan={() => {
            const b = batas(dipilih)
            if (b.isValid()) map.flyToBounds(b, { padding: [60, 60] })
            setPopup({ posisi: titikTengah(dipilih), props: dipilih.properties })
          }}
        />
      )}

      {dipilih && <ChipRute rute={dipilih.properties} />}

      <LayerRuteTerpilih semua={!kodePenuh ? rute.data : null} dipilih={dipilih} lainnya={lainnya} onKlik={(posisi, props) => setPopup({ posisi, props })} />
      <RutePopup posisi={popup?.posisi} rute={popup?.props} onClose={() => setPopup(null)} onDetail={() => bukaDetail(popup.props)} />
    </>
  )
}