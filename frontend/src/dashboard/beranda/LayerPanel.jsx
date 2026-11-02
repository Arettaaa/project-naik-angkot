import { Card, Checkbox } from '../ui'
import { IconLayers } from '../icons'

// Panel Layer: Jaringan Jalan, Rute Angkot, Kepadatan Rute.
export default function LayerPanel({ layers, setLayers, loading, error }) {
  const set = (k) => (v) => setLayers((l) => ({ ...l, [k]: v }))
  return (
    <Card className="hidden shrink-0 sm:block">
      <div className="px-5 pt-5 pb-4 lg:px-6">
        <h2 className="flex items-center gap-2 font-display text-[20px] font-bold text-tentang-dark">
          <IconLayers className="h-5 w-5 text-dark/70" /> Layer
        </h2>
        <div className="mt-3">
          <Checkbox checked={layers.jalan} onChange={set('jalan')}>
            Jaringan Jalan
          </Checkbox>
          <Checkbox checked={layers.rute} onChange={set('rute')}>
            Rute Angkot
          </Checkbox>
          <Checkbox checked={layers.kepadatan} onChange={set('kepadatan')}>
            Kepadatan Rute
          </Checkbox>
        </div>
        {loading && <p className="mt-2 text-xs text-dark/50">Memuat ruas jalan…</p>}
        {error && <p className="mt-2 text-xs text-red-700">Ruas jalan gagal dimuat.</p>}
      </div>
    </Card>
  )
}