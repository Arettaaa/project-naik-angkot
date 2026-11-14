import { useCallback, useEffect, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { Floating } from '../ui'
import { useDashboard } from '../context'
import { useLayarBesar } from '../hooks'
import { KEPADATAN } from '../warna'
import { nomorTampil } from '../nomorWarga'
import { IconChevronDown, IconChevronUp } from '../icons'

// Pilihan panjang batang skala (m) -> dipilih yang paling mendekati lebar maksimum batang.
const LANGKAH_SKALA = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
const SKALA_MAKS_PX = 104

const jarakTeks = (m) => (m >= 1000 ? `${m / 1000} km` : `${m} m`)

// Batang skala: dihitung ulang tiap peta digeser/di-zoom, jadi selalu sesuai tampilan.
function Skala() {
  const map = useMap()
  const [skala, setSkala] = useState(null)

  const hitung = useCallback(() => {
    const y = map.getSize().y / 2
    const meterPerPx = map.containerPointToLatLng([0, y]).distanceTo(map.containerPointToLatLng([SKALA_MAKS_PX, y])) / SKALA_MAKS_PX
    const maksMeter = meterPerPx * SKALA_MAKS_PX
    const bulat = [...LANGKAH_SKALA].reverse().find((m) => m <= maksMeter) ?? LANGKAH_SKALA[0]
    setSkala({ meter: bulat, px: Math.round(bulat / meterPerPx) })
  }, [map])

  useEffect(hitung, [hitung])
  useMapEvents({ zoomend: hitung, moveend: hitung })

  if (!skala) return null
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-start" style={{ width: skala.px }}>
        <span className="h-[7px] w-full border-x-2 border-b-2 border-dark/55" />
      </div>
      <span className="text-[11px] font-semibold text-dark/60 tabular-nums">{jarakTeks(skala.meter)}</span>
    </div>
  )
}

function ArahUtara() {
  return (
    <span className="flex flex-col items-center gap-0.5 text-dark/60" aria-label="Arah utara" title="Arah utara">
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path d="M8 1.5 12 14 8 11 4 14z" fill="currentColor" />
      </svg>
      <span className="text-[10px] leading-none font-bold">U</span>
    </span>
  )
}

function Baris({ swatch, label, ket }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="flex h-3.5 w-7 shrink-0 items-center justify-center" aria-hidden="true">
        {swatch}
      </span>
      <span className="min-w-0 text-[12px] leading-tight text-dark">
        {label}
        {ket && <span className="text-dark/50"> · {ket}</span>}
      </span>
    </li>
  )
}

const Garis = ({ warna, tebal = 3, putus }) => (
  <span
    className="w-7 rounded-full"
    style={{ height: tebal, backgroundColor: putus ? 'transparent' : warna, backgroundImage: putus ? `repeating-linear-gradient(90deg, ${warna} 0 5px, transparent 5px 9px)` : undefined }}
  />
)

const Titik = ({ warna }) => <span className="h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: warna, boxShadow: '0 0 0 1px rgba(21,30,44,.18)' }} />

// Legenda peta + arah utara + skala + sumber data (unsur kartografi).
// Letaknya dibuat tidak bertumpuk dengan panel lain: HP di bawah kolom cari, desktop di sisa ruang bawah antara panel kiri dan tombol kanan.
export default function LegendaPeta() {
  const { layers, trayek, filter } = useDashboard()
  const besar = useLayarBesar()
  const [buka, setBuka] = useState(null) // null = ikut ukuran layar

  const terbuka = buka ?? besar
  const dipilih = filter.kode
  const daftarPilih = (trayek.data ?? []).filter((t) => dipilih.includes(t.kode_trayek)).slice(0, 6)
  const sisaPilih = dipilih.length - daftarPilih.length

  return (
    <Floating className="top-[76px] left-3 !z-[998] max-lg:max-w-[min(72vw,260px)] lg:top-auto lg:bottom-3 lg:left-[470px] lg:max-w-[300px]">
      {terbuka ? (
        <section
          aria-label="Legenda peta"
          className="naik-scroll max-h-[min(58dvh,460px)] overflow-y-auto rounded-2xl bg-white/95 px-3.5 py-3 shadow-[0_8px_30px_rgba(21,30,44,0.16)] backdrop-blur"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[13.5px] leading-tight font-bold text-tentang-dark">Legenda</h2>
              <p className="text-[10.5px] leading-tight text-dark/50">Trayek Angkot Kota Bogor</p>
            </div>
            <div className="flex items-center gap-2">
              <ArahUtara />
              <button
                onClick={() => setBuka(false)}
                aria-label="Ciutkan legenda"
                title="Ciutkan"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F4F5] text-dark/55 transition hover:bg-mist hover:text-dark"
              >
                <IconChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {layers.kepadatan && (
            <div className="mt-2.5 border-t border-[#EDF1F2] pt-2.5">
              <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-dark/45 uppercase">Kepadatan trayek</p>
              <ul className="flex flex-col gap-1.5">
                {KEPADATAN.map((k) => (
                  <Baris key={k.key} swatch={<Garis warna={k.warna} tebal={k.tebal + 1} />} label={k.key} ket={k.ket} />
                ))}
              </ul>
            </div>
          )}

          {layers.rute && !layers.kepadatan && (
            <div className="mt-2.5 border-t border-[#EDF1F2] pt-2.5">
              <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-dark/45 uppercase">Jalur trayek</p>
              <ul className="flex flex-col gap-1.5">
                {daftarPilih.length ? (
                  <>
                    {daftarPilih.map((t) => (
                      <Baris key={t.kode_trayek} swatch={<Garis warna={t.warna} tebal={4} />} label={`Angkot ${nomorTampil(t.kode_trayek)}`} />
                    ))}
                    {sisaPilih > 0 && <li className="pl-[38px] text-[11.5px] text-dark/50">+{sisaPilih} trayek lain</li>}
                  </>
                ) : (
                  <Baris
                    swatch={
                      <span className="flex w-7 flex-col gap-[3px]" aria-hidden="true">
                        {['#008D5C', '#B2580B', '#3475C4'].map((w) => (
                          <span key={w} className="h-[3px] w-full rounded-full" style={{ backgroundColor: w }} />
                        ))}
                      </span>
                    }
                    label="Jalur angkot"
                    ket="warna per nomor"
                  />
                )}
              </ul>
            </div>
          )}

          {layers.jalan && !layers.kepadatan && (
            <div className="mt-2.5 border-t border-[#EDF1F2] pt-2.5">
              <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-dark/45 uppercase">Jaringan jalan</p>
              <ul className="flex flex-col gap-1.5">
                <Baris swatch={<Garis warna="#7C8C92" tebal={2.5} />} label="Ruas jalan dilalui angkot" />
              </ul>
            </div>
          )}

          <div className="mt-2.5 border-t border-[#EDF1F2] pt-2.5">
            <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-dark/45 uppercase">Batas & titik</p>
            <ul className="flex flex-col gap-1.5">
              <Baris swatch={<Garis warna="#1F7A5A" tebal={2.5} putus />} label="Batas Kota Bogor" />
              <Baris swatch={<Titik warna="#38BDF8" />} label="Titik asal" />
              <Baris swatch={<Titik warna="#FFAB2E" />} label="Titik tujuan" />
            </ul>
          </div>

          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[#EDF1F2] pt-2.5">
            <Skala />
            <p className="text-[10px] leading-snug text-dark/45">
              Sumber: SK Trayek Angkot Kota Bogor, OpenStreetMap, survei Kelompok 9 · Proyeksi WGS 84
            </p>
          </div>
        </section>
      ) : (
        <button
          onClick={() => setBuka(true)}
          aria-label="Tampilkan legenda peta"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/95 pr-3.5 pl-3 text-[12.5px] font-semibold text-tentang-dark shadow-[0_8px_30px_rgba(21,30,44,0.16)] backdrop-blur transition hover:bg-[#F6F9F9]"
        >
          <span className="flex gap-0.5" aria-hidden="true">
            {['#4FAE84', '#E3A03A', '#C8432E'].map((w) => (
              <span key={w} className="h-2.5 w-1.5 rounded-full" style={{ backgroundColor: w }} />
            ))}
          </span>
          Legenda
          <IconChevronUp className="h-3.5 w-3.5 text-dark/45" />
        </button>
      )}
    </Floating>
  )
}