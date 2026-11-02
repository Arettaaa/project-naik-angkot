import { useState } from 'react'
import { Card, Floating } from '../ui'
import { IconEye, IconEyeOff } from '../icons'
import { KEPADATAN } from '../warna'

// Kartu Legenda (kiri bawah), bisa disembunyikan.
export default function Legenda({ catatan }) {
  const [buka, setBuka] = useState(true)
  return (
    <Floating className="bottom-24 left-3 hidden sm:block lg:bottom-3 lg:left-[94px]">
      <Card className="w-[220px] !rounded-[20px]">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <p className="font-display text-[15px] font-bold text-tentang-dark">Legenda</p>
          <button onClick={() => setBuka((x) => !x)} aria-label={buka ? 'Sembunyikan legenda' : 'Tampilkan legenda'} className="text-dark/50 hover:text-dark">
            {buka ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
          </button>
        </div>
        {buka && (
          <div className="border-t border-[#EDF1F2] px-4 pt-2 pb-3">
            <p className="mb-1.5 text-[12px] font-semibold text-dark/80">Tingkat Kepadatan</p>
            {KEPADATAN.map((k) => (
              <p key={k.key} className="flex items-center gap-2 py-0.5 text-[13px] text-dark">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: k.warna }} />
                {k.key} <span className="text-dark/50">({k.ket})</span>
              </p>
            ))}
            <p className="mt-1.5 flex items-center gap-2 text-[12px] text-dark/60">
              <span className="inline-block w-5 border-t-2 border-dashed border-[#D9433B]" /> Batas Kota Bogor
            </p>
            {catatan}
          </div>
        )}
      </Card>
    </Floating>
  )
}