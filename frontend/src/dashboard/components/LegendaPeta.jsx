import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useMap, useMapEvents } from 'react-leaflet'
import { Floating } from '../ui'
import { useDashboard } from '../context'
import { useLayarBesar } from '../hooks'
import { KEPADATAN } from '../warna'
import { nomor } from '../lib'
import { nomorTampil } from '../nomorWarga'
import { IconChevronDown, IconChevronUp, IconX } from '../icons'

// ---------- batang skala (dihitung ulang tiap peta digeser / di-zoom) ----------
const LANGKAH_SKALA = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
const SKALA_MAKS_PX = 104
const jarakTeks = (m) => (m >= 1000 ? `${m / 1000} km` : `${m} m`)

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
      <span className="h-[7px] border-x-2 border-b-2 border-dark/55" style={{ width: skala.px }} />
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

// ---------- potongan kecil ----------
const Garis = ({ warna, tebal = 3, putus, titik }) => {
  let bg = warna
  if (putus) bg = `repeating-linear-gradient(90deg, ${warna} 0 5px, transparent 5px 9px)`
  if (titik) bg = `repeating-linear-gradient(90deg, ${warna} 0 3px, transparent 3px 8px)`
  return <span className="w-7 rounded-full" style={{ height: tebal, background: bg }} />
}

const Titik = ({ warna }) => (
  <span className="h-3 w-3 rounded-full border-2" style={{ backgroundColor: warna, borderColor: '#fff', boxShadow: '0 0 0 1px rgba(21,30,44,.18)' }} />
)

const Beberapa = ({ warna }) => (
  <span className="flex w-7 flex-col gap-[3px]" aria-hidden="true">
    {warna.map((w) => (
      <span key={w} className="h-[3px] w-full rounded-full" style={{ backgroundColor: w }} />
    ))}
  </span>
)

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

function Bagian({ judul, children }) {
  return (
    <div className="mt-2.5 border-t border-[#EDF1F2] pt-2.5">
      <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-dark/45 uppercase">{judul}</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  )
}

const BATAS = <Baris swatch={<Garis warna="#C8432E" tebal={2} putus />} label="Batas Kota Bogor" />
const WARNA_CONTOH = ['#008D5C', '#B2580B', '#3475C4']

// Halaman -> 'peta' | 'rute' | 'detail' | 'cari'
function halamanDari(pathname) {
  if (pathname.startsWith('/cari')) return 'cari'
  if (/^\/rute\/[^/]+/.test(pathname)) return 'detail'
  if (pathname.startsWith('/rute')) return 'rute'
  return 'peta'
}

const SUBJUDUL = {
  peta: 'Trayek Angkot Kota Bogor',
  rute: 'Daftar jalur trayek',
  detail: 'Detail satu trayek',
  cari: 'Hasil pencarian rute',
}

// Isi legenda: berubah mengikuti halaman yang sedang dibuka dan layer yang aktif.
function IsiLegenda({ halaman, pathname }) {
  const { layers, trayek, filter } = useDashboard()

  let isi = null
  if (halaman === 'peta') {
    const dipilih = filter.kode
    const daftarPilih = (trayek.data ?? []).filter((t) => dipilih.includes(t.kode_trayek)).slice(0, 6)
    const sisa = dipilih.length - daftarPilih.length
    isi = (
      <>
        {layers.kepadatan && (
          <Bagian judul="Kepadatan trayek">
            {KEPADATAN.map((k) => (
              <Baris key={k.key} swatch={<Garis warna={k.warna} tebal={k.tebal + 1} />} label={k.key} ket={k.ket} />
            ))}
          </Bagian>
        )}
        {layers.rute && !layers.kepadatan && (
          <Bagian judul="Jalur trayek">
            {daftarPilih.length ? (
              <>
                {daftarPilih.map((t) => (
                  <Baris key={t.kode_trayek} swatch={<Garis warna={t.warna} tebal={4} />} label={`Angkot ${nomorTampil(t.kode_trayek)}`} />
                ))}
                {sisa > 0 && <li className="pl-[38px] text-[11.5px] text-dark/50">+{sisa} trayek lain</li>}
              </>
            ) : (
              <Baris swatch={<Beberapa warna={WARNA_CONTOH} />} label="Jalur angkot" ket="warna per nomor" />
            )}
          </Bagian>
        )}
        {layers.jalan && !layers.kepadatan && (
          <Bagian judul="Jaringan jalan">
            <Baris swatch={<Garis warna="#7C8C92" tebal={2.5} />} label="Ruas jalan dilalui angkot" />
          </Bagian>
        )}
        <Bagian judul="Batas">{BATAS}</Bagian>
      </>
    )
  } else if (halaman === 'rute') {
    isi = (
      <>
        <Bagian judul="Jalur trayek">
          <Baris swatch={<Beberapa warna={WARNA_CONTOH} />} label="Jalur angkot" ket="warna per nomor" />
        </Bagian>
        <Bagian judul="Batas">{BATAS}</Bagian>
        <p className="mt-2.5 text-[11px] leading-snug text-dark/50">Pilih satu rute dari daftar untuk melihat detail jalurnya.</p>
      </>
    )
  } else if (halaman === 'detail') {
    const param = pathname.match(/^\/rute\/([^/]+)/)?.[1]
    const t = (trayek.data ?? []).find((x) => nomor(x.kode_trayek) === param)
    const warna = t?.warna ?? '#008D5C'
    isi = (
      <>
        <Bagian judul="Jalur">
          <Baris swatch={<Garis warna={warna} tebal={5} />} label={t ? `Angkot ${nomorTampil(t.kode_trayek)}` : 'Rute terpilih'} ket="arah dipilih" />
          <Baris swatch={<Garis warna={warna} tebal={3} putus />} label="Arah sebaliknya" />
        </Bagian>
        <Bagian judul="Titik">
          <Baris swatch={<Titik warna="#13A36F" />} label="Titik awal" />
          <Baris swatch={<Titik warna="#C8432E" />} label="Titik tujuan" />
          <Baris swatch={<Titik warna={warna} />} label="Pergantian jalan" ket="ketuk untuk detail" />
        </Bagian>
        <Bagian judul="Batas">{BATAS}</Bagian>
      </>
    )
  } else {
    isi = (
      <>
        <Bagian judul="Perjalanan">
          <Baris swatch={<Garis warna="#4C3935" tebal={3} titik />} label="Jalan kaki" />
          <Baris swatch={<Beberapa warna={WARNA_CONTOH} />} label="Naik angkot" ket="warna per nomor" />
        </Bagian>
        <Bagian judul="Titik">
          <Baris swatch={<Titik warna="#38BDF8" />} label="Titik asal" />
          <Baris swatch={<Titik warna="#FFAB2E" />} label="Titik tujuan" />
          <Baris swatch={<Titik warna="#1A936F" />} label="Naik / turun angkot" />
          <Baris swatch={<Titik warna="#A586FF" />} label="Titik pindah angkot" />
          <Baris swatch={<Titik warna="#2F80ED" />} label="Lokasi saya" />
        </Bagian>
        <Bagian judul="Batas">{BATAS}</Bagian>
      </>
    )
  }

  return (
    <>
      {isi}
      <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[#EDF1F2] pt-2.5">
        <Skala />
        <p className="text-[10px] leading-snug text-dark/45">Sumber: SK Trayek Angkot Kota Bogor, OpenStreetMap, survei Kelompok 9 · Proyeksi WGS 84</p>
      </div>
    </>
  )
}

function Kepala({ halaman, onTutup, ikon = 'chevron' }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-[13.5px] leading-tight font-bold text-tentang-dark">Legenda</h2>
        <p className="text-[10.5px] leading-tight text-dark/50">{SUBJUDUL[halaman]}</p>
      </div>
      <div className="flex items-center gap-2">
        <ArahUtara />
        <button
          onClick={onTutup}
          aria-label="Tutup legenda"
          title="Tutup"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F4F5] text-dark/55 transition hover:bg-mist hover:text-dark"
        >
          {ikon === 'x' ? <IconX className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

const KARTU =
  'naik-scroll max-h-[min(66dvh,500px)] max-lg:max-h-[min(64dvh,480px)] overflow-y-auto rounded-2xl bg-white/95 px-3.5 py-3 shadow-[0_8px_30px_rgba(21,30,44,0.16)] backdrop-blur'

const Pil = ({ onClick }) => (
  <button
    onClick={onClick}
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
)

// Legenda utama.
//  - Desktop: kiri-atas peta (di kanan panel kiri, di kiri panel detail) di semua halaman. Terbuka di Beranda, ciut (pil) di halaman lain.
//  - HP di Beranda: pil di bawah kolom cari. HP di halaman lain: tombolnya ada di kolom kontrol peta (lihat LegendaHp).
export default function LegendaPeta() {
  const { pathname } = useLocation()
  const besar = useLayarBesar()
  const halaman = halamanDari(pathname)
  const [pilihan, setPilihan] = useState({}) // halaman -> true/false (pilihan pengguna)

  if (!besar && halaman !== 'peta') return null
  const terbuka = pilihan[halaman] ?? (besar && halaman === 'peta')
  const set = (v) => setPilihan((s) => ({ ...s, [halaman]: v }))

  return (
    // dibuka sendiri oleh pengguna -> di atas panel lain (kalau layar sempit & kebetulan berhimpit); bawaan -> di bawah panel
    <Floating className={`top-[76px] left-3 ${pilihan[halaman] ? '!z-[1060]' : '!z-[998]'} max-lg:max-w-[min(72vw,260px)] lg:top-3 lg:left-[470px] lg:w-[clamp(220px,calc(100vw-866px),300px)]`}>
      {terbuka ? (
        <section aria-label="Legenda peta" className={KARTU}>
          <Kepala halaman={halaman} onTutup={() => set(false)} />
          <IsiLegenda halaman={halaman} pathname={pathname} />
        </section>
      ) : (
        <Pil onClick={() => set(true)} />
      )}
    </Floating>
  )
}

// Tombol legenda untuk HP di halaman selain Beranda: dipasang DI DALAM kolom kontrol peta (KontrolPeta),
// jadi tombolnya mengikuti kolom itu. Kartunya melayang di atas menu bawah dengan latar redup (ketuk di luar untuk menutup).
export function LegendaHp() {
  const { pathname } = useLocation()
  const halaman = halamanDari(pathname)
  const [buka, setBuka] = useState(false)

  return (
    <div className="relative lg:hidden">
      <button
        aria-label={buka ? 'Tutup legenda peta' : 'Tampilkan legenda peta'}
        aria-expanded={buka}
        onClick={() => setBuka((x) => !x)}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-dark shadow-[0_6px_20px_rgba(21,30,44,0.14)] transition hover:bg-[#F3F6F6]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="5" cy="18" r="1.4" fill="currentColor" stroke="none" />
          <path d="M10 6h10M10 12h10M10 18h10" />
        </svg>
      </button>
      {buka &&
        // dipindah ke atas semua panel (z-index lebih tinggi), tetap di dalam .naik-dashboard supaya tema gelap ikut berlaku
        createPortal(
          <>
            <div aria-hidden="true" onClick={() => setBuka(false)} className="fixed inset-0 z-[1190] bg-black/30" />
            <section aria-label="Legenda peta" className={`${KARTU} fixed inset-x-3 bottom-[96px] z-[1200] mx-auto w-auto max-w-[340px]`}>
              <Kepala halaman={halaman} onTutup={() => setBuka(false)} ikon="x" />
              <IsiLegenda halaman={halaman} pathname={pathname} />
            </section>
          </>,
          document.querySelector('.naik-dashboard') ?? document.body,
        )}
    </div>
  )
}