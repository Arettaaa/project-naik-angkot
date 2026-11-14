import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pane, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useDashboard } from '../context'
import { TombolTanyaAi } from '../../components/AiChatbot'
import { BottomSheet, Card, Floating } from '../ui'
import { useLayarBesar } from '../hooks'
import { IconChevronDown, IconChevronUp, IconX, IconLocate } from '../icons'
import { batas, nomor } from '../lib'
import RutePopup from '../components/RutePopup'
import RuasPopup from '../components/RuasPopup'
import CariTujuan from './CariTujuan'
import PilihRute, { RuteTerpilih } from './PilihRute'
import TombolLayer from './TombolLayer'
import InfoKepadatan from './InfoKepadatan'
import LayerJalan from './LayerJalan'
import LayerRute from './LayerRute'

// Menu Beranda (gaya aplikasi transportasi): kolom "Mau ke mana hari ini?", chip nomor rute, tombol layer.
// Desktop: kolom kiri. HP: kolom cari di atas + bottom sheet di bawah.
export default function BerandaPanel() {
  const { trayek, rute, kepadatan, butuhKepadatan, layers, setLayers, filter, setFilter, muatUlang } = useDashboard()
  const navigate = useNavigate()
  const map = useMap()
  const besar = useLayarBesar()
  const [panelBuka, setPanelBuka] = useState(true) // desktop: kartu rute dibuka/ciut
  const [sheetBuka, setSheetBuka] = useState(false) // HP: bottom sheet
  const [ruas, setRuas] = useState(null)
  const [rutePop, setRutePop] = useState(null)
  const [sorot, setSorot] = useState(null) // nama jalan yang disorot dari daftar jalan terpadat

  const dipilih = filter.kode
  const adaFilter = dipilih.length > 0
  const toggle = (kode) => setFilter((f) => ({ ...f, kode: f.kode.includes(kode) ? f.kode.filter((k) => k !== kode) : [...f.kode, kode] }))
  const hapus = () => setFilter((f) => ({ ...f, kode: [] }))
  const pilihSemua = () => setFilter((f) => ({ ...f, kode: (trayek.data ?? []).map((t) => t.kode_trayek) }))
  const [infoTutup, setInfoTutup] = useState(false) // desktop: panel info kepadatan diciutkan
  const [infoSembunyi, setInfoSembunyi] = useState(false) // desktop: panel info kepadatan ditutup (tinggal tombol kecil)
  useEffect(() => {
    if (layers.kepadatan) setInfoSembunyi(false) // tiap mode kepadatan dibuka lagi, panel info tampil
  }, [layers.kepadatan])

  useEffect(() => {
    if (layers.jalan || layers.kepadatan) return butuhKepadatan()
    // muat data kepadatan diam-diam saat browser senggang, jadi saat pindah ke Kepadatan sudah siap
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 1500))
    const batal = window.cancelIdleCallback ?? clearTimeout
    const id = idle(() => butuhKepadatan())
    return () => batal(id)
  }, [layers.jalan, layers.kepadatan, butuhKepadatan])

  const ruteTampil = useMemo(() => {
    if (!rute.data) return null
    if (!adaFilter) return rute.data
    return { ...rute.data, features: rute.data.features.filter((f) => dipilih.includes(f.properties.kode_trayek)) }
  }, [rute.data, dipilih, adaFilter])

  // zoom ke rute yang dipilih (sisakan ruang untuk panel)
  useEffect(() => {
    if (!adaFilter || !ruteTampil?.features.length) return
    const b = batas(ruteTampil)
    if (!b.isValid()) return
    const opsi = besar
      ? { paddingTopLeft: [480, 60], paddingBottomRight: [layers.kepadatan ? 380 : 90, 60] }
      : { paddingTopLeft: [24, 90], paddingBottomRight: [24, sheetBuka ? 420 : 240] }
    map.fitBounds(b, { ...opsi, maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruteTampil, map])

  // mode Kepadatan: garis rute tidak digambar; jalur rute terpilih tampil lewat ruasnya yang diwarnai kepadatan
  const tampilRute = layers.rute && !layers.kepadatan

  // sorotan otomatis hilang kalau pilihan rute / mode berubah
  const kunci = `${layers.kepadatan}-${dipilih.join('.')}`
  const sorotNama = sorot?.kunci === kunci ? sorot.nama : null

  function fokusJalan(nama) {
    const fitur = kepadatan.data?.features.filter((f) => f.properties.nama_jalan === nama)
    if (!fitur?.length) return
    setSorot({ nama, kunci })
    const b = L.geoJSON({ type: 'FeatureCollection', features: fitur }).getBounds()
    map.fitBounds(b, besar ? { paddingTopLeft: [480, 80], paddingBottomRight: [420, 80], maxZoom: 16 } : { paddingTopLeft: [24, 120], paddingBottomRight: [24, 320], maxZoom: 16 })
  }
  const lokasiSaya = () => map.locate({ setView: true, maxZoom: 16 })

  const tombolLayer = <TombolLayer layers={layers} setLayers={setLayers} loading={kepadatan.loading} error={kepadatan.error} />
  const pilihRute = (p) => (
    <PilihRute trayek={trayek} dipilih={dipilih} toggle={toggle} hapus={hapus} pilihSemua={pilihSemua} onRetry={muatUlang} jumlahTampil={ruteTampil?.features.length} {...p} />
  )
  const info = (p) => <InfoKepadatan kepadatan={kepadatan} trayek={trayek} dipilih={dipilih} onFokusJalan={fokusJalan} onPilihTrayek={toggle} {...p} />

  return (
    <>
      {besar ? (
        <>
          <Floating className="top-3 left-[94px] flex max-h-[calc(100%-24px)] w-[360px] flex-col gap-3">
            <CariTujuan trayek={trayek} onPilihRute={(k) => !dipilih.includes(k) && toggle(k)} />
            <Card className="naik-scroll min-h-0 overflow-y-auto !rounded-[24px]">
              <div className="px-5 pt-4 pb-4">
                {panelBuka ? (
                  pilihRute()
                ) : (
                  <button onClick={() => setPanelBuka(true)} className="flex w-full items-center justify-between text-left">
                    <span className="font-display text-[17px] font-bold text-tentang-dark">
                      Rute angkot {adaFilter && <span className="text-[13px] font-semibold text-primary">· {dipilih.map(nomor).join(', ')}</span>}
                    </span>
                    <IconChevronDown className="h-5 w-5 text-dark/50" />
                  </button>
                )}
                {panelBuka && (
                  <button onClick={() => setPanelBuka(false)} className="mx-auto mt-3 flex items-center gap-1 text-[12.5px] font-medium text-dark/50 hover:text-dark">
                    <IconChevronUp className="h-4 w-4" /> Ciutkan
                  </button>
                )}
              </div>
            </Card>
          </Floating>
          <Floating className="top-3 right-3">{tombolLayer}</Floating>
          {layers.kepadatan && infoSembunyi && (
            <Floating className="top-[76px] right-3">
              <button
                onClick={() => setInfoSembunyi(false)}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white pr-4 pl-3.5 text-[13.5px] font-semibold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.14)] transition hover:bg-[#F6F9F9]"
              >
                <span className="flex gap-0.5" aria-hidden="true">
                  {['#4FAE84', '#E3A03A', '#C8432E'].map((w) => (
                    <span key={w} className="h-2.5 w-1.5 rounded-full" style={{ backgroundColor: w }} />
                  ))}
                </span>
                Info kepadatan
              </button>
            </Floating>
          )}
          {layers.kepadatan && !infoSembunyi && (
            <Floating className="top-[76px] right-3 flex max-h-[calc(100%-292px)] w-[340px] flex-col">
              <Card className="naik-scroll relative min-h-0 overflow-y-auto !rounded-[24px] px-5 py-4 select-none">
                <div className="absolute top-3 right-3 z-[2] flex gap-1.5">
                  <button
                    onClick={() => setInfoTutup((x) => !x)}
                    aria-label={infoTutup ? 'Perluas info kepadatan' : 'Ciutkan info kepadatan'}
                    title={infoTutup ? 'Perluas' : 'Ciutkan'}
                    aria-expanded={!infoTutup}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F4F5] text-dark/55 transition hover:bg-mist hover:text-dark"
                  >
                    {infoTutup ? <IconChevronDown className="h-4 w-4" /> : <IconChevronUp className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setInfoSembunyi(true)}
                    aria-label="Tutup info kepadatan"
                    title="Tutup"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F4F5] text-dark/55 transition hover:bg-mist hover:text-dark"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </div>
                {info({ ringkas: infoTutup })}
              </Card>
            </Floating>
          )}
        </>
      ) : (
        <>
          <Floating className="top-3 right-3 left-3">
            <CariTujuan trayek={trayek} onPilihRute={(k) => !dipilih.includes(k) && toggle(k)} kanan={tombolLayer} />
          </Floating>
          <BottomSheet
            terbuka={sheetBuka}
            setTerbuka={setSheetBuka}
            atas={
              <div className="flex items-center justify-end gap-2">
                <TombolTanyaAi />
                <button
                  aria-label="Lokasi saya"
                  onClick={lokasiSaya}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-dark shadow-[0_6px_20px_rgba(21,30,44,0.18)]"
                >
                  <IconLocate />
                </button>
              </div>
            }
          >
            <div className={`naik-scroll overflow-y-auto px-4 pb-3 ${sheetBuka ? 'max-h-[52dvh]' : ''}`}>
              {pilihRute({ baris: !sheetBuka || layers.kepadatan })}
              {layers.kepadatan ? (
                <div className="mt-4 border-t border-[#EDF1F2] pt-4">{info({ ringkas: !sheetBuka })}</div>
              ) : (
                !sheetBuka && dipilih.length < (trayek.data?.length ?? 0) && <RuteTerpilih trayek={trayek} dipilih={dipilih.slice(-1)} />
              )}
              <p className="mt-3 text-center text-[10.5px] text-dark/40">
                Peta © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap</a> · Leaflet
              </p>
            </div>
          </BottomSheet>
        </>
      )}

      {(layers.jalan || layers.kepadatan) && (
        <LayerJalan
          data={kepadatan.data}
          kepadatan={layers.kepadatan}
          fokus={dipilih}
          sorot={sorotNama}
          onPilih={(x) => {
            setRutePop(null)
            setRuas(x)
          }}
        />
      )}
      {/* garis rute selalu di atas ruas kepadatan (yang dimuat belakangan) */}
      <Pane name="naik-rute" style={{ zIndex: 420 }}>
      {tampilRute && (
        <LayerRute
          data={ruteTampil}
          tebal={adaFilter ? 5 : 2.5}
          opacity={adaFilter ? 0.95 : 0.7}
          onPilih={(x) => {
            setRuas(null)
            setRutePop(x)
          }}
        />
      )}
      </Pane>
      <RuasPopup
        posisi={ruas?.posisi}
        ruas={ruas?.props}
        onClose={() => setRuas(null)}
        dipilih={dipilih}
        onPilihTrayek={(kode) => {
          toggle(kode)
          setLayers((l) => (l.kepadatan ? l : { ...l, rute: true }))
        }}
      />
      <RutePopup
        posisi={rutePop?.posisi}
        rute={rutePop?.props}
        onClose={() => setRutePop(null)}
        onDetail={() => navigate(`/rute/${nomor(rutePop.props.kode_trayek)}?arah=${rutePop.props.rute_id}`)}
      />
    </>
  )
}