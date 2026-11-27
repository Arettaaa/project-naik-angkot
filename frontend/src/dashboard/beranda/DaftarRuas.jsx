import { useEffect, useMemo, useRef } from 'react'
import { fmtKm } from '../kepadatan'
import { KEPADATAN, kepadatanOf } from '../warna'
import { IconSearch, IconX } from '../icons'
import { Judul, Pil } from './KepadatanBits'

const TAMBAH = 40 // baris yang ditambahkan tiap kali daftar digulir sampai bawah

const normal = (s) => String(s ?? '').toLowerCase()

// Daftar seluruh ruas jalan dalam data kepadatan: filter kategori + pencarian nama jalan.
// Daftar panjang (ribuan baris) dirender bertahap supaya panel tetap ringan.
export default function DaftarRuas({ daftar, st, setSt, onPilih, onKembali, besar = true }) {
  const { kategori, cari, batas } = st
  const scroll = useRef(null)

  const tersaring = useMemo(() => {
    const q = normal(cari).trim()
    return daftar.list.filter((j) => (kategori === 'Semua' || j.tingkat === kategori) && (!q || normal(j.nama).includes(q)))
  }, [daftar, kategori, cari])

  // posisi scroll dikembalikan saat balik dari detail
  useEffect(() => {
    const el = scroll.current
    if (el) el.scrollTop = st.scrollTop || 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ganti = (patch) => setSt((s) => ({ ...s, batas: TAMBAH, scrollTop: 0, ...patch }))
  const onScroll = (e) => {
    const el = e.currentTarget
    st.scrollTop = el.scrollTop // disimpan tanpa render ulang
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160 && batas < tersaring.length) {
      setSt((s) => ({ ...s, batas: s.batas + TAMBAH }))
    }
  }

  const tampil = tersaring.slice(0, batas)
  const tombol = [{ key: 'Semua', warna: '#4A5B61', jumlah: daftar.total }, ...KEPADATAN.map((k) => ({ key: k.key, warna: k.warna, jumlah: daftar.jumlah[k.key] }))]

  return (
    <div className="flex min-h-0 flex-col">
      <Judul eyebrow="Informasi kepadatan" onKembali={onKembali} labelKembali="Ringkasan">
        Seluruh ruas jalan
      </Judul>
      <p className="mt-1 text-[12.5px] text-dark/60">
        {daftar.total.toLocaleString('id-ID')} ruas jalan bernama dilewati angkot
      </p>

      <label className="mt-3 flex items-center gap-2 rounded-2xl bg-[#F4F7F7] px-3 py-2.5">
        <IconSearch className="h-4 w-4 shrink-0 text-dark/40" />
        <input
          value={cari}
          onChange={(e) => ganti({ cari: e.target.value })}
          placeholder="Cari nama jalan…"
          className="w-full bg-transparent text-[13.5px] text-dark placeholder:text-dark/40 focus:outline-none"
        />
        {cari && (
          <button type="button" onClick={() => ganti({ cari: '' })} aria-label="Hapus pencarian" className="shrink-0 text-dark/40 hover:text-dark">
            <IconX className="h-4 w-4" />
          </button>
        )}
      </label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {tombol.map((t) => {
          const aktif = kategori === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => ganti({ kategori: t.key })}
              aria-pressed={aktif}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold transition"
              style={aktif ? { backgroundColor: t.warna, color: '#fff' } : { backgroundColor: t.warna + '14', color: t.warna }}
            >
              {t.key}
              <span className={`text-[11px] font-bold ${aktif ? 'text-white/75' : 'opacity-60'}`}>{t.jumlah.toLocaleString('id-ID')}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-2.5 text-[11.5px] text-dark/50">
        {tersaring.length.toLocaleString('id-ID')} ruas ditampilkan · urut dari trayek terbanyak
      </p>

      {/* Desktop: daftar punya area scroll sendiri supaya header & filter tetap terlihat.
          HP: ikut scroll bottom sheet, biar tidak ada scroll bersarang di layar sempit. */}
      <div
        ref={scroll}
        onScroll={besar ? onScroll : undefined}
        className={`-mx-1 mt-1 px-1 ${besar ? 'naik-scroll max-h-[46dvh] min-h-0 overflow-y-auto overscroll-contain' : ''}`}
      >
        {tersaring.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-dark/50">
            Tidak ada ruas jalan yang cocok{cari ? ` dengan “${cari}”` : ''}.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {tampil.map((j) => (
              <li key={j.nama}>
                <button
                  type="button"
                  onClick={() => onPilih(j.nama)}
                  className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[#F4F7F7]"
                >
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: kepadatanOf(j.tingkat).warna }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-dark group-hover:text-primary">{j.nama}</span>
                    <span className="block text-[11.5px] text-dark/50">
                      {j.tingkat} · {fmtKm(j.km)}
                    </span>
                  </span>
                  <Pil tingkat={j.tingkat}>{j.maks} rute</Pil>
                </button>
              </li>
            ))}
          </ul>
        )}
        {batas < tersaring.length && (
          <button
            type="button"
            onClick={() => setSt((s) => ({ ...s, batas: s.batas + TAMBAH }))}
            className="mt-2 mb-1 w-full rounded-2xl bg-[#F4F7F7] py-2.5 text-[12.5px] font-semibold text-dark/65 transition hover:bg-mist hover:text-dark"
          >
            Muat {Math.min(TAMBAH, tersaring.length - batas)} ruas lagi
          </button>
        )}
      </div>
    </div>
  )
}
