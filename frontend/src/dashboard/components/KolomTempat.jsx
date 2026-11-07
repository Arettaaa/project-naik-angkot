import { useRef, useState } from 'react'
import { saranAwal, teksJarak, useCariTempat, usePusatPeta, useTempatSaya } from '../hooks'
import { IconCap, IconClock, IconHome, IconLocate, IconMap, IconPin, IconSignpost, IconX } from '../icons'

// ikon + warna per jenis hasil
const GAYA = {
  rumah: { Ikon: IconHome, bg: '#E3F4EC', fg: '#1A936F' },
  kampus: { Ikon: IconCap, bg: '#E8EEFB', fg: '#3475C4' },
  riwayat: { Ikon: IconClock, bg: '#F1F4F5', fg: '#5B6B70' },
  lokasi: { Ikon: IconLocate, bg: '#E1F3FB', fg: '#0284C7' },
  peta: { Ikon: IconMap, bg: '#E3F4EC', fg: '#1A936F' },
  jalan: { Ikon: IconSignpost, bg: '#EEF1F6', fg: '#56657A' },
  kelurahan: { Ikon: IconMap, bg: '#F0ECFA', fg: '#7C60BD' },
  kecamatan: { Ikon: IconMap, bg: '#F0ECFA', fg: '#7C60BD' },
  wilayah: { Ikon: IconMap, bg: '#F0ECFA', fg: '#7C60BD' },
  perumahan: { Ikon: IconHome, bg: '#FBEFE6', fg: '#B2580B' },
}
const GAYA_TEMPAT = { Ikon: IconPin, bg: '#FFF3E0', fg: '#E58A12' }
const SIMPAN = new Set(['rumah', 'kampus', 'riwayat'])

// Satu baris saran (tempat, jalan, riwayat, Rumah/Kampus, "lokasi saya", "pilih di peta").
export function ItemTempat({ t, peran, aktif, judul, ...p }) {
  const g = GAYA[peran] ?? GAYA[t?.jenis] ?? GAYA_TEMPAT
  const teksJudul = judul ?? t?.nama
  const sub = peran === 'rumah' || peran === 'kampus' ? t?.nama : t?.ket
  return (
    <button
      type="button"
      role="option"
      aria-selected={aktif}
      onMouseDown={(e) => e.preventDefault()}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${aktif ? 'bg-[#EEF6F3]' : 'hover:bg-[#F6F9F9]'}`}
      {...p}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: g.bg, color: g.fg }}>
        <g.Ikon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14.5px] font-medium ${peran === 'peta' || peran === 'lokasi' ? 'text-primary' : 'text-dark'}`}>{teksJudul}</span>
        {sub && <span className="block truncate text-[12px] text-dark/50">{sub}</span>}
      </span>
      {t?.jarak_m != null && <span className="shrink-0 text-[11.5px] font-medium text-dark/45">{teksJarak(t.jarak_m)}</span>}
    </button>
  )
}

// Kolom ketik tempat (Dari / Ke) ala aplikasi ojol: riwayat & Rumah/Kampus saat kosong, hasil terdekat saat mengetik.
export default function KolomTempat({ titik, onPilih, onFocus, onLokasiSaya, onPilihPeta, placeholder = 'Ketik nama tempat…' }) {
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(false)
  const [aktif, setAktif] = useState(0)
  const ref = useRef(null)
  const dekat = usePusatPeta()
  const saya = useTempatSaya()
  const { hasil, loading, siap, gagal } = useCariTempat(q, dekat)
  const mengetik = q.trim().length >= 2

  const item = [
    ...(mengetik ? hasil.map((t) => ({ peran: 'hasil', t })) : []),
    ...(!mengetik && onLokasiSaya ? [{ peran: 'lokasi', judul: 'Lokasi saya sekarang' }] : []),
    ...(!mengetik ? saranAwal(saya) : []),
    ...(onPilihPeta ? [{ peran: 'peta', judul: 'Pilih lewat peta' }] : []),
  ]

  function pilih(x) {
    setQ('')
    setBuka(false)
    ref.current?.blur()
    if (x.peran === 'lokasi') return onLokasiSaya()
    if (x.peran === 'peta') return onPilihPeta()
    onPilih({ lat: x.t.lat, lng: x.t.lng, nama: x.t.nama, ket: x.t.ket ?? null })
  }

  return (
    <div>
      <div className="flex h-11 items-center gap-2 rounded-xl border border-[#E3E8EA] bg-white px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <input
          ref={ref}
          value={buka ? q : (titik?.nama ?? '')}
          onChange={(e) => {
            setQ(e.target.value)
            setAktif(0)
          }}
          onFocus={() => {
            setBuka(true)
            onFocus?.()
            // di HP panel Cari pendek: geser kolom ke atas supaya daftar saran kelihatan
            if (window.innerWidth < 1024) setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80)
          }}
          onBlur={() => setTimeout(() => setBuka(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setAktif((i) => Math.min(i + 1, item.length - 1))
            else if (e.key === 'ArrowUp') setAktif((i) => Math.max(i - 1, 0))
            else if (e.key === 'Enter' && item[aktif]) pilih(item[aktif])
            else if (e.key === 'Escape') ref.current?.blur()
            else return
            e.preventDefault()
          }}
          placeholder={titik ? titik.nama : placeholder}
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-dark outline-none placeholder:text-dark/45"
        />
        {buka && q && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ('')} aria-label="Kosongkan" className="text-dark/40 hover:text-dark">
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>
      {!buka && titik?.ket && <p className="mt-1 truncate px-1 text-[12px] text-dark/50">{titik.ket}</p>}
      {buka && item.length > 0 && (
        <div role="listbox" className="naik-scroll mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-[#E3E8EA] bg-white py-1.5">
          {mengetik && loading && !hasil.length && <p className="px-4 py-2 text-[13px] text-dark/50">Mencari tempat…</p>}
          {mengetik && gagal && <p className="px-4 py-2 text-[13px] text-red-700">Pencarian gagal (backend / internet). Pilih lewat peta dulu ya.</p>}
          {mengetik && siap && !gagal && !hasil.length && <p className="px-4 py-2 text-[13px] text-dark/55">Tempat tidak ditemukan. Coba kata lain, atau pilih lewat peta.</p>}
          {item.map((x, i) => (
            <div key={`${x.peran}-${x.t?.nama ?? x.judul}-${x.t?.lat ?? i}`}>
              {!mengetik && SIMPAN.has(x.peran) && !SIMPAN.has(item[i - 1]?.peran) && (
                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-dark/40 uppercase">Tersimpan & terakhir</p>
              )}
              <ItemTempat
                t={x.t}
                peran={x.peran}
                judul={x.judul}
                aktif={i === aktif}
                onClick={() => pilih(x)}
                onMouseEnter={() => setAktif(i)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
