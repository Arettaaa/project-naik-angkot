import { Popup } from 'react-leaflet'
import { IconSignpost } from '../icons'
import { nomor } from '../lib'
import { kepadatanOf, warnaTrayek } from '../warna'
import { nomorTampil } from '../nomorWarga'
import TutupPopup from './TutupPopup'

// Kartu popup ruas jalan: nama jalan, jumlah rute, kepadatan, trayek yang melintas.
// Nomor trayek bisa diketuk untuk menampilkan jalurnya di peta (eksplorasi dari jalan -> rute).
export default function RuasPopup({ posisi, ruas, onClose, onPilihTrayek, dipilih = [] }) {
  if (!posisi || !ruas) return null
  const k = kepadatanOf(ruas.tingkat)
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
            <p className="font-display text-[16px] leading-snug font-bold text-dark">{ruas.nama_jalan}</p>
            <p className="text-[13px] text-dark/60">Ruas jalan</p>
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
      </div>
    </Popup>
  )
}