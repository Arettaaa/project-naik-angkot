import { Popup } from 'react-leaflet'
import { rupiah } from '../../utils/format'
import { IconBus } from '../icons'
import { nomor } from '../lib'
import TutupPopup from './TutupPopup'

// Kartu popup rute: warna aksen (ikon, garis pembatas, label, tombol) mengikuti warna garis rute di peta.
export default function RutePopup({ posisi, rute, onDetail, onClose }) {
  if (!posisi || !rute) return null
  const warna = rute.warna
  return (
    <Popup position={posisi} className="naik-popup" closeButton={false} autoPan eventHandlers={{ remove: onClose }}>
      <div className="w-[280px] overflow-hidden rounded-[22px]">
        <div className="h-1.5 w-full" style={{ backgroundColor: warna }} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: warna }}>
              <IconBus className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[16px] font-bold" style={{ color: warna }}>
                Rute {nomor(rute.kode_trayek)}
              </p>
              <p className="truncate text-[13px] text-dark/70">
                {rute.asal} → {rute.tujuan}
              </p>
            </div>
            <TutupPopup />
          </div>
          <dl className="mt-3 grid grid-cols-[72px_1fr] gap-y-1.5 border-t border-[#EDF1F2] pt-3 text-[13px]">
            <dt className="text-dark/50">Asal</dt>
            <dd className="font-medium text-dark">{rute.asal}</dd>
            <dt className="text-dark/50">Tujuan</dt>
            <dd className="font-medium text-dark">{rute.tujuan}</dd>
            <dt className="text-dark/50">Tarif</dt>
            <dd className="font-medium text-dark">{rupiah(rute.tarif)}</dd>
          </dl>
          {onDetail && (
            <button
              onClick={onDetail}
              className="mt-4 h-11 w-full rounded-xl text-[14px] font-semibold text-white transition hover:brightness-90"
              style={{ backgroundColor: warna }}
            >
              Lihat Detail
            </button>
          )}
        </div>
      </div>
    </Popup>
  )
}
