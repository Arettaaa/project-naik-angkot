import { useRef, useState } from 'react'
import { useCariTempat } from '../hooks'
import { IconPin, IconX } from '../icons'

// Satu baris hasil tempat (dipakai dropdown Beranda & menu Cari).
export function ItemTempat({ t, aktif, ...p }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={aktif}
      onMouseDown={(e) => e.preventDefault()}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${aktif ? 'bg-[#EEF6F3]' : 'hover:bg-[#F6F9F9]'}`}
      {...p}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF3E0] text-[#E58A12]">
        <IconPin className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-medium text-dark">{t.nama}</span>
        {t.ket && <span className="block truncate text-[12px] text-dark/50">{t.ket}</span>}
      </span>
    </button>
  )
}

// Kolom ketik tempat (Dari / Ke) dengan saran (daftar ikut mengalir di dalam panel, jadi tidak terpotong di HP): tempat NAIK + POI database + OpenStreetMap.
export default function KolomTempat({ titik, onPilih, onFocus, placeholder = 'Ketik nama tempat…' }) {
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(false)
  const [aktif, setAktif] = useState(0)
  const ref = useRef(null)
  const { hasil, loading, siap } = useCariTempat(q)

  function pilih(t) {
    onPilih({ lat: t.lat, lng: t.lng, nama: t.nama })
    setQ('')
    setBuka(false)
    ref.current?.blur()
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
            if (e.key === 'ArrowDown') setAktif((i) => Math.min(i + 1, hasil.length - 1))
            else if (e.key === 'ArrowUp') setAktif((i) => Math.max(i - 1, 0))
            else if (e.key === 'Enter' && hasil[aktif]) pilih(hasil[aktif])
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
      {buka && q.trim().length >= 2 && (
        <div role="listbox" className="naik-scroll mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-[#E3E8EA] bg-white py-1.5">
          {hasil.map((t, i) => (
            <ItemTempat key={`${t.nama}-${t.lat}`} t={t} aktif={i === aktif} onClick={() => pilih(t)} onMouseEnter={() => setAktif(i)} />
          ))}
          {loading && <p className="px-4 py-2 text-[13px] text-dark/50">Mencari tempat…</p>}
          {siap && !hasil.length && <p className="px-4 py-2 text-[13px] text-dark/55">Tempat tidak ditemukan. Coba kata lain, atau klik langsung di peta.</p>}
        </div>
      )}
    </div>
  )
}
