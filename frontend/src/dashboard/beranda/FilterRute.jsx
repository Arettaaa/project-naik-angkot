import { useMemo, useState } from 'react'
import { Card, CardHeader, Muat, OutlineButton, PrimaryButton, Select } from '../ui'
import { IconFilter } from '../icons'
import { nomor, uniq } from '../lib'

// Panel Filter Rute: Nomor Rute, Asal, Tujuan.
export default function FilterRute({ trayek, filter, onTerapkan, onReset, jumlahHasil, onClose, onRetry }) {
  const [draf, setDraf] = useState(filter)
  const opsiAsal = useMemo(() => uniq(trayek.data?.flatMap((t) => t.arah.map((a) => a.asal))), [trayek.data])
  const opsiTujuan = useMemo(() => uniq(trayek.data?.flatMap((t) => t.arah.map((a) => a.tujuan))), [trayek.data])
  const adaFilter = filter.kode || filter.asal || filter.tujuan
  const ubah = (k) => (v) => setDraf((d) => ({ ...d, [k]: v }))

  return (
    <Card className="naik-scroll min-h-0 overflow-y-auto">
      <CardHeader title="Filter Rute" icon={<IconFilter className="h-5 w-5" />} onClose={onClose} />
      <div className="space-y-4 px-5 pt-5 pb-5 lg:px-6">
        <Muat loading={trayek.loading} error={trayek.error} onRetry={onRetry} />
        <Select label="Nomor Rute" value={draf.kode} onChange={ubah('kode')}>
          <option value="">Semua</option>
          {trayek.data?.map((t) => (
            <option key={t.kode_trayek} value={t.kode_trayek}>
              {nomor(t.kode_trayek)} · {t.nama_trayek}
            </option>
          ))}
        </Select>
        <Select label="Asal" value={draf.asal} onChange={ubah('asal')}>
          <option value="">Semua</option>
          {opsiAsal.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Select label="Tujuan" value={draf.tujuan} onChange={ubah('tujuan')}>
          <option value="">Semua</option>
          {opsiTujuan.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <PrimaryButton onClick={() => onTerapkan(draf)}>Terapkan Filter</PrimaryButton>
        <OutlineButton
          onClick={() => {
            setDraf({ kode: '', asal: '', tujuan: '' })
            onReset()
          }}
        >
          Reset
        </OutlineButton>
        {adaFilter && jumlahHasil != null && (
          <p className="text-center text-[13px] text-dark/60">{jumlahHasil ? `${jumlahHasil} rute ditampilkan` : 'Tidak ada rute yang cocok'}</p>
        )}
      </div>
    </Card>
  )
}