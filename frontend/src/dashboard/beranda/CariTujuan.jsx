import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TEMPAT } from '../../data/tempat'
import { useCariTempat } from '../hooks'
import { ItemTempat } from '../components/KolomTempat'
import { IconMap, IconSearch, IconX } from '../icons'
import { nomor } from '../lib'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Kolom "Mau ke mana hari ini?": cari tempat tujuan (lanjut ke menu Cari) atau nomor/nama rute.
export default function CariTujuan({ trayek, onPilihRute, kanan }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(false)
  const [aktif, setAktif] = useState(0)
  const inputRef = useRef(null)

  const cariTempat = useCariTempat(q)
  const saran = useMemo(() => {
    const k = norm(q.trim())
    const tempat = (k ? cariTempat.hasil.slice(0, 7) : TEMPAT.slice(0, 5)).map((t) => ({ jenis: 'tempat', t }))
    const rute = k
      ? (trayek.data ?? [])
          .filter((t) => nomor(t.kode_trayek).includes(k.replace(/^0+(?=\d)/, '')) || norm(t.nama_trayek).includes(k))
          .slice(0, 5)
          .map((t) => ({ jenis: 'rute', t }))
      : []
    return [...tempat, ...rute, { jenis: 'peta' }]
  }, [q, trayek.data, cariTempat.hasil])

  function pilih(s) {
    setBuka(false)
    inputRef.current?.blur()
    if (s.jenis === 'tempat') navigate(`/cari?ke=${s.t.lat},${s.t.lng}&nama=${encodeURIComponent(s.t.nama)}`)
    // (tempat bisa dari daftar NAIK, database POI, atau OpenStreetMap)
    else if (s.jenis === 'rute') {
      onPilihRute(s.t.kode_trayek)
      setQ('')
    } else navigate('/cari')
  }

  function tombol(e) {
    if (e.key === 'ArrowDown') setAktif((i) => Math.min(i + 1, saran.length - 1))
    else if (e.key === 'ArrowUp') setAktif((i) => Math.max(i - 1, 0))
    else if (e.key === 'Enter' && saran[aktif]) pilih(saran[aktif])
    else if (e.key === 'Escape') setBuka(false)
    else return
    e.preventDefault()
  }

  const adaTempat = saran.some((s) => s.jenis === 'tempat')
  const adaRute = saran.some((s) => s.jenis === 'rute')

  return (
    <div className="relative">
      <div className="flex gap-2">
        <label className="flex h-[52px] min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-4 shadow-[0_8px_30px_rgba(21,30,44,0.14)] ring-primary/25 focus-within:ring-2">
          <IconSearch className="h-5 w-5 shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setAktif(0)
              setBuka(true)
            }}
            onFocus={() => setBuka(true)}
            onBlur={() => setTimeout(() => setBuka(false), 150)}
            onKeyDown={tombol}
            placeholder="Mau ke mana hari ini?"
            aria-label="Cari tujuan atau nomor rute"
            role="combobox"
            aria-expanded={buka}
            aria-controls="naik-saran"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-dark outline-none placeholder:font-normal placeholder:text-dark/45"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Kosongkan" className="text-dark/40 hover:text-dark">
              <IconX className="h-4 w-4" />
            </button>
          )}
        </label>
        {kanan}
      </div>

      {buka && (
        <div id="naik-saran" role="listbox" className="naik-scroll absolute top-[60px] right-0 left-0 z-10 max-h-[60dvh] overflow-y-auto rounded-2xl bg-white py-2 shadow-[0_12px_36px_rgba(21,30,44,0.18)]">
          {adaTempat && <p className="px-4 pt-1 pb-1.5 text-[11.5px] font-semibold tracking-wide text-dark/45 uppercase">{q ? 'Tempat' : 'Tujuan populer'}</p>}
          {q.trim().length >= 2 && cariTempat.loading && !adaTempat && <p className="px-4 pt-1 pb-2 text-[13px] text-dark/50">Mencari tempat…</p>}
          {cariTempat.siap && !adaTempat && !adaRute && <p className="px-4 pt-1 pb-2 text-[13px] text-dark/55">Tempat tidak ditemukan. Coba kata lain, atau pilih titiknya langsung di peta.</p>}
          {saran.map((s, i) => {
            const kelas = `flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${i === aktif ? 'bg-[#EEF6F3]' : 'hover:bg-[#F6F9F9]'}`
            const judulRute = s.jenis === 'rute' && saran[i - 1]?.jenis !== 'rute'
            return (
              <div key={s.jenis === 'peta' ? 'peta' : `${s.jenis}-${s.t.nama ?? s.t.kode_trayek}`}>
                {judulRute && <p className="mt-1 border-t border-[#EDF1F2] px-4 pt-2.5 pb-1.5 text-[11.5px] font-semibold tracking-wide text-dark/45 uppercase">Rute angkot</p>}
                {s.jenis === 'peta' && (adaTempat || adaRute) && <div className="my-1 border-t border-[#EDF1F2]" />}
                {s.jenis === 'tempat' ? (
                  <ItemTempat t={s.t} aktif={i === aktif} onClick={() => pilih(s)} onMouseEnter={() => setAktif(i)} />
                ) : (
                  <button type="button" role="option" aria-selected={i === aktif} onMouseDown={(e) => e.preventDefault()} onClick={() => pilih(s)} onMouseEnter={() => setAktif(i)} className={kelas}>
                    {s.jenis === 'rute' ? (
                      <>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-[14px] font-bold text-white" style={{ backgroundColor: s.t.warna }}>
                          {nomor(s.t.kode_trayek)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-dark">{s.t.nama_trayek}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E3F4EC] text-primary">
                          <IconMap className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1 text-[14.5px] font-medium text-primary">Pilih titik di peta</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
