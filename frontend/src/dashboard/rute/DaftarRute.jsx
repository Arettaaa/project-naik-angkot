import { useMemo, useState } from 'react'
import { Card, CardHeader, Muat, Select } from '../ui'
import { IconSearch, IconSliders } from '../icons'
import { nomor, uniq } from '../lib'
import KartuRute from './KartuRute'

// Panel Daftar Rute Angkot: pencarian, filter asal/tujuan, daftar kartu.
export default function DaftarRute({ trayek, kodeAktif, onPilih, onClose, onRetry }) {
  const [cari, setCari] = useState('')
  const [filterBuka, setFilterBuka] = useState(false)
  const [asal, setAsal] = useState('')
  const [tujuan, setTujuan] = useState('')

  const opsiAsal = useMemo(() => uniq(trayek.data?.flatMap((t) => t.arah.map((a) => a.asal))), [trayek.data])
  const opsiTujuan = useMemo(() => uniq(trayek.data?.flatMap((t) => t.arah.map((a) => a.tujuan))), [trayek.data])

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return (trayek.data ?? []).filter((t) => {
      const teks = `${t.kode_trayek} ${nomor(t.kode_trayek)} ${t.nama_trayek} ${t.arah.map((a) => `${a.asal} ${a.tujuan}`).join(' ')}`.toLowerCase()
      return (!q || teks.includes(q)) && (!asal || t.arah.some((a) => a.asal === asal)) && (!tujuan || t.arah.some((a) => a.tujuan === tujuan))
    })
  }, [trayek.data, cari, asal, tujuan])

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader title="Daftar Rute Angkot" subtitle="Cari & pilih rute untuk melihat detail." onClose={onClose} />
      <div className="px-5 pt-4 lg:px-6">
        <label className="relative block">
          <span className="sr-only">Cari rute</span>
          <IconSearch className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-dark/40" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nomor atau nama rute…"
            className="h-12 w-full rounded-2xl border border-[#E3E8EA] pr-4 pl-10 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <button
          onClick={() => setFilterBuka((x) => !x)}
          className={`mt-3 inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition ${
            filterBuka || asal || tujuan ? 'border-primary bg-[#E3F4EC] text-primary' : 'border-[#E3E8EA] text-dark/70 hover:bg-[#F6F9F9]'
          }`}
        >
          <IconSliders className="h-4 w-4" /> Filter
        </button>
        {filterBuka && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Select value={asal} onChange={setAsal}>
              <option value="">Semua asal</option>
              {opsiAsal.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Select value={tujuan} onChange={setTujuan}>
              <option value="">Semua tujuan</option>
              {opsiTujuan.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <Muat loading={trayek.loading} error={trayek.error} onRetry={onRetry} />
      <ul className="naik-scroll mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-5 lg:px-6">
        {daftar.map((t) => (
          <li key={t.kode_trayek}>
            <KartuRute trayek={t} aktif={t.kode_trayek === kodeAktif} onClick={() => onPilih(t)} />
          </li>
        ))}
        {trayek.data && daftar.length === 0 && <li className="py-6 text-center text-sm text-dark/60">Tidak ada rute yang cocok.</li>}
      </ul>
    </Card>
  )
}