import { Popup } from 'react-leaflet'
import { jarak, menitAngkot, rupiah } from '../../utils/format'
import { IconChevronRight, IconPlay } from '../icons'
import { nomor } from '../lib'
import TutupPopup from './TutupPopup'
import { nomorWarga } from '../nomorWarga'

// Kartu popup rute: nomor berwarna, asal → tujuan, arah, panjang/waktu/tarif, tombol detail (+ simulasi bila ada).
export default function RutePopup({ posisi, rute, onDetail, onSimulasi, onClose }) {
  if (!posisi || !rute) return null
  const warna = rute.warna
  const panjang = Number(rute.panjang_m) || null
  const info = [
    panjang && ['Panjang', jarak(panjang)],
    panjang && ['Waktu', `±${menitAngkot(panjang)} mnt`],
    ['Tarif', rupiah(rute.tarif)],
  ].filter(Boolean)
  return (
    <Popup position={posisi} className="naik-popup" closeButton={false} autoPan autoPanPadding={[24, 90]} eventHandlers={{ remove: onClose }}>
      <div className="w-[268px] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-[17px] font-bold text-white" style={{ backgroundColor: warna }}>
            {nomor(rute.kode_trayek)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold" style={{ color: warna }}>
              {rute.arah || `Rute ${nomor(rute.kode_trayek)}`}
            </p>
            <p className="mt-0.5 text-[14.5px] leading-snug font-semibold text-dark">
              {rute.asal} <span className="text-dark/40">→</span> {rute.tujuan}
            </p>
            {nomorWarga(rute.kode_trayek) && (
              <p className="mt-1 text-[11.5px] text-[#8A5A00]">Warga masih menyebutnya angkot {nomorWarga(rute.kode_trayek)}</p>
            )}
          </div>
          <TutupPopup />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#F4F7F7] px-2 py-2 text-center" style={{ gridTemplateColumns: `repeat(${info.length}, 1fr)` }}>
          {info.map(([l, v]) => (
            <div key={l}>
              <dt className="text-[11px] text-dark/50">{l}</dt>
              <dd className="font-display text-[13px] font-bold text-dark">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex gap-2">
          {onSimulasi && (
            <button
              onClick={onSimulasi}
              title="Simulasi angkot berjalan"
              aria-label="Simulasi angkot berjalan"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E3E8EA] text-dark/70 transition hover:bg-[#F4F7F7]"
            >
              <IconPlay className="h-4 w-4" />
            </button>
          )}
          {onDetail && (
            <button
              onClick={onDetail}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl text-[14px] font-semibold text-white transition hover:brightness-90"
              style={{ backgroundColor: warna }}
            >
              Lihat detail rute <IconChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Popup>
  )
}
