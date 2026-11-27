import { fmtKm } from '../kepadatan'
import { kepadatanOf } from '../warna'
import { IconLocate } from '../icons'
import { ChipTrayek, Judul } from './KepadatanBits'

// Detail satu ruas jalan: nama, jumlah trayek, kategori kepadatan, dan trayek yang melewatinya.
export default function DetailRuas({ jalan, dipilih = [], onPilihTrayek, onFokus, onKembali, labelKembali }) {
  if (!jalan) {
    return (
      <div>
        <Judul eyebrow="Detail ruas" onKembali={onKembali} labelKembali={labelKembali}>
          Ruas tidak ditemukan
        </Judul>
        <p className="mt-2 text-[13px] text-dark/55">Data ruas jalan ini tidak ada di data kepadatan.</p>
      </div>
    )
  }
  const k = kepadatanOf(jalan.tingkat)

  return (
    <div>
      <Judul eyebrow="Detail ruas jalan" onKembali={onKembali} labelKembali={labelKembali}>
        {jalan.nama}
      </Judul>

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold" style={{ backgroundColor: k.lembut, color: k.warna }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.warna }} />
          Kepadatan {jalan.tingkat}
        </span>
        <span className="text-[12px] text-dark/55">{k.ket}</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#F4F7F7] px-3 py-2">
          <dt className="text-[11.5px] font-semibold text-dark/55">Trayek melewati</dt>
          <dd className="mt-0.5 font-display text-[17px] leading-tight font-bold text-tentang-dark">{jalan.maks} rute</dd>
        </div>
        <div className="rounded-2xl bg-[#F4F7F7] px-3 py-2">
          <dt className="text-[11.5px] font-semibold text-dark/55">Panjang ruas</dt>
          <dd className="mt-0.5 font-display text-[17px] leading-tight font-bold text-tentang-dark">{fmtKm(jalan.km)}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => onFokus?.(jalan.nama)}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#F1F4F5] px-3 py-2 text-[12.5px] font-semibold text-dark/70 transition hover:bg-mist hover:text-dark"
      >
        <IconLocate className="h-4 w-4" /> Tampilkan di peta
      </button>

      <div className="mt-4 border-t border-[#EDF1F2] pt-3">
        <h3 className="text-[13px] font-bold text-tentang-dark">Angkot yang lewat sini</h3>
        {jalan.kode.length > 0 ? (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {jalan.kode.map((kode) => (
                <ChipTrayek key={kode} kode={kode} aktif={dipilih.includes(kode)} onClick={() => onPilihTrayek?.(kode)} />
              ))}
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-dark/45">Ketuk nomor untuk melihat jalurnya di peta.</p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-dark/50">Daftar trayek untuk ruas ini belum tersedia.</p>
        )}
      </div>
    </div>
  )
}
