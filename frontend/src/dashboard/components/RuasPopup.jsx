import { Popup } from 'react-leaflet'
import { IconSignpost } from '../icons'
import { nomor } from '../lib'
import { kepadatanOf } from '../warna'
import TutupPopup from './TutupPopup'

// Kartu popup ruas jalan: nama jalan, jumlah rute, kepadatan, trayek yang melintas.
export default function RuasPopup({ posisi, ruas, onClose }) {
  if (!posisi || !ruas) return null
  const k = kepadatanOf(ruas.tingkat)
  const dilalui = String(ruas.trayek ?? '').split(',').map((s) => nomor(s.trim())).filter(Boolean)
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
          <div className="flex items-start justify-between gap-4">
            <dt className="text-dark/60">Dilalui</dt>
            <dd className="text-right font-semibold text-dark">{dilalui.join(', ')}</dd>
          </div>
        </dl>
      </div>
    </Popup>
  )
}