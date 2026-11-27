import { Popup } from 'react-leaflet'
import { IconChevronRight, IconSignpost } from '../icons'
import { kepadatanOf, warnaTrayek } from '../warna'
import { nomorTampil } from '../nomorWarga'
import TutupPopup from './TutupPopup'

// Kartu popup ruas jalan: nama jalan, jumlah rute, kepadatan, trayek yang melintas.
// Nomor trayek bisa diketuk untuk menampilkan jalurnya di peta (eksplorasi dari jalan -> rute).
export default function RuasPopup({ posisi, ruas, onClose, onPilihTrayek, onDetail, dipilih = [] }) {
  if (!posisi || !ruas) return null
  const k = kepadatanOf(ruas.tingkat)
  const nama = ruas.nama_jalan || ruas.nama_osm || 'Ruas tanpa nama'
  const panjang = Number(ruas.panjang_m) || 0
  const dilalui = String(ruas.trayek ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <Popup position={posisi} className="naik-popup" closeButton={false} autoPan eventHandlers={{ remove: onClose }}>
      <div className="w-[290px] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF9F1C] text-white">
            <IconSignpost className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[16px] leading-snug font-bold text-dark">{nama}</p>
            <p className="text-[13px] text-dark/60">Ruas jalan{ruas.kelas_jalan ? ` · ${ruas.kelas_jalan}` : ''}</p>
          </div>
          <TutupPopup />
        </div>
        <dl className="mt-3 space-y-2 border-t border-[#EDF1F2] pt-3 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-dark/60">Jumlah rute</dt>
            <dd className="font-semibold text-dark">{ruas.jumlah_trayek} rute</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-dark/60">Kepadatan</dt>
            <dd className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold" style={{ backgroundColor: k.warna + '22', color: k.warna }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.warna }} />
              {ruas.tingkat}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-dark/60">Panjang ruas</dt>
            <dd className="font-semibold text-dark">{panjang >= 1000 ? `${(panjang / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${Math.round(panjang)} m`}</dd>
          </div>
        </dl>
        {dilalui.length > 0 && (
          <div className="mt-3 border-t border-[#EDF1F2] pt-3">
            <p className="text-[12px] text-dark/60">Dilalui angkot</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dilalui.map((kode) => {
                const warna = warnaTrayek(kode)
                const aktif = dipilih.includes(kode)
                return (
                  <button
                    key={kode}
                    type="button"
                    onClick={() => onPilihTrayek?.(kode)}
                    title={aktif ? `Sembunyikan jalur ${nomorTampil(kode)}` : `Tampilkan jalur ${nomorTampil(kode)} di peta`}
                    className="inline-flex h-7 min-w-[30px] items-center justify-center rounded-lg px-2 font-display text-[13px] leading-none font-bold transition"
                    style={
                      aktif
                        ? { backgroundColor: warna, color: '#fff' }
                        : { backgroundColor: warna + '1A', color: warna, boxShadow: `inset 0 0 0 1px ${warna}59` }
                    }
                  >
                    {nomorTampil(kode)}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-dark/45">Ketuk nomor untuk melihat jalurnya di peta.</p>
          </div>
        )}
        {onDetail && ruas.nama_jalan && (
          <button
            type="button"
            onClick={() => onDetail(ruas.nama_jalan)}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl bg-primary/10 px-3 py-2.5 text-left text-[12.5px] font-bold text-primary transition hover:bg-primary/15"
          >
            Lihat detail ruas di panel
            <IconChevronRight className="h-4 w-4 shrink-0" />
          </button>
        )}
      </div>
    </Popup>
  )
}