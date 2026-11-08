import { Link } from 'react-router-dom'
import { Muat } from '../ui'
import { IconChevronRight } from '../icons'
import { nomor } from '../lib'
import { NomorChip } from '../ui'
import { nomorTampil, trayekLama } from '../nomorWarga'

// Chip nomor rute berwarna (pilih lebih dari satu, langsung tampil di peta).
export function ChipNomor({ t, aktif, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      title={t.nama_trayek}
      className={`flex h-10 shrink-0 items-center justify-center rounded-xl border-2 font-display text-[15px] font-bold transition active:scale-95 ${className}`}
      style={aktif ? { backgroundColor: t.warna, borderColor: t.warna, color: '#fff' } : { borderColor: t.warna + '55', color: t.warna, backgroundColor: t.warna + '0F' }}
    >
      <NomorChip kode={t.kode_trayek} />
    </button>
  )
}

// Daftar rute terpilih: nama jalur + tautan detail.
export function RuteTerpilih({ trayek, dipilih }) {
  const list = (trayek.data ?? []).filter((t) => dipilih.includes(t.kode_trayek))
  if (!list.length || list.length > 4) return null
  return (
    <ul className="mt-3 space-y-1.5">
      {list.map((t) => (
        <li key={t.kode_trayek}>
          <Link
            to={`/rute/${nomor(t.kode_trayek)}`}
            className="flex items-center gap-3 rounded-2xl bg-[#F4F7F7] px-3 py-2.5 !text-dark transition hover:bg-[#EAF1F0]"
          >
            <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.warna }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold" style={{ color: t.warna }}>
                Rute {nomorTampil(t.kode_trayek)}
              </span>
              <span className="block truncate text-[14px] font-medium">{t.nama_trayek}</span>
            </span>
            <IconChevronRight className="h-4 w-4 shrink-0 text-dark/40" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

// Isi panel "Rute angkot": judul + chip + rute terpilih. `baris` = satu baris geser (HP tertutup).
export default function PilihRute({ trayek, dipilih, toggle, hapus, pilihSemua, onRetry, baris = false, jumlahTampil }) {
  const n = dipilih.length
  const total = trayek.data?.length ?? 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-bold text-tentang-dark">Rute angkot</h2>
          <p className="text-[12.5px] text-dark/55">
            {n === total && total ? `Semua ${total} rute${jumlahTampil != null ? ` · ${jumlahTampil} jalur di peta` : ''}` : n ? `${n} rute dipilih${jumlahTampil != null ? ` · ${jumlahTampil} jalur di peta` : ''}` : 'Ketuk nomor untuk melihat jalurnya'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {total > 0 && n < total && (
            <button onClick={pilihSemua} className="rounded-lg px-2 py-1 text-[13px] font-semibold text-primary hover:bg-[#E3F4EC]">
              Pilih semua
            </button>
          )}
          {n > 0 && (
            <button onClick={hapus} className="rounded-lg px-2 py-1 text-[13px] font-semibold text-dark/55 hover:bg-[#F1F4F5] hover:text-dark">
              Hapus{n === total ? ' semua' : ''}
            </button>
          )}
        </div>
      </div>
      <Muat loading={trayek.loading} error={trayek.error} onRetry={onRetry} />
      {trayek.data && (
        <div className={baris ? 'naik-scroll -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1' : 'mt-3 grid grid-cols-6 gap-2'}>
          {/* trayek SK dulu, trayek lama di ujung */}
          {[...trayek.data].sort((a, b) => trayekLama(a.kode_trayek) - trayekLama(b.kode_trayek)).map((t) => (
            <ChipNomor key={t.kode_trayek} t={t} aktif={dipilih.includes(t.kode_trayek)} onClick={() => toggle(t.kode_trayek)} className={baris ? 'w-12' : ''} />
          ))}
        </div>
      )}
      {!baris && <RuteTerpilih trayek={trayek} dipilih={dipilih} />}
    </div>
  )
}
