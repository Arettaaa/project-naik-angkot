import { Popup } from 'react-leaflet'
import { rupiah } from '../../utils/format'
import { IconChevronRight } from '../icons'
import { nomor } from '../lib'
import TutupPopup from './TutupPopup'

// Kartu popup rute: nomor berwarna, jalur asal → tujuan, arah & tarif, tombol detail. Warna mengikuti garis rute.
export default function RutePopup({ posisi, rute, onDetail, onClose }) {
  if (!posisi || !rute) return null
  const warna = rute.warna
  return (
    <Popup position={posisi} className="naik-popup" closeButton={false} autoPan autoPanPadding={[24, 90]} eventHandlers={{ remove: onClose }}>
      <div className="w-[264px] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-[17px] font-bold text-white" style={{ backgroundColor: warna }}>
            {nomor(rute.kode_trayek)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold" style={{ color: warna }}>
              Rute {nomor(rute.kode_trayek)}
              {rute.arah ? ` · ${rute.arah}` : ''}
            </p>
            <p className="mt-0.5 text-[14.5px] leading-snug font-semibold text-dark">
              {rute.asal} <span className="text-dark/40">→</span> {rute.tujuan}
            </p>
          </div>
          <TutupPopup />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#F4F7F7] px-3 py-2 text-[13px]">
          <span className="text-dark/60">Tarif</span>
          <span className="font-display font-bold text-dark">{rupiah(rute.tarif)}</span>
        </div>
        {onDetail && (
          <button
            onClick={onDetail}
            className="mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-xl text-[14px] font-semibold text-white transition hover:brightness-90"
            style={{ backgroundColor: warna }}
          >
            Lihat detail rute <IconChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </Popup>
  )
}
