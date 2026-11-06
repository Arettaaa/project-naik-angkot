import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/naik'
import { barisJalur, fmtKm, ringkasKota, ringkasRute } from '../kepadatan'
import { KEPADATAN, kepadatanOf } from '../warna'
import { nomor } from '../lib'

// Bar bertumpuk Rendah | Sedang | Tinggi (persen panjang jalan).
function BarKepadatan({ pct, tinggi = 'h-2.5' }) {
  return (
    <div className={`flex w-full gap-[3px] overflow-hidden rounded-full ${tinggi}`}>
      {KEPADATAN.map((k) =>
        pct[k.key] > 0 ? <span key={k.key} className="h-full rounded-full" style={{ width: `${pct[k.key]}%`, backgroundColor: k.warna }} /> : null,
      )}
    </div>
  )
}

function LegendaMini({ pct }) {
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-dark/55">
      {KEPADATAN.map((k) => (
        <span key={k.key} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.warna }} />
          {k.key} {Math.round(pct[k.key])}%
        </span>
      ))}
    </p>
  )
}

function AngkaKelas({ r }) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      {KEPADATAN.map((k) => (
        <div key={k.key} className="rounded-2xl px-3 py-2" style={{ backgroundColor: k.lembut }}>
          <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: k.warna }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.warna }} />
            {k.key}
          </dt>
          <dd className="mt-0.5 font-display text-[17px] leading-tight font-bold text-tentang-dark">{Math.round(r.pct[k.key])}%</dd>
          <dd className="text-[11px] text-dark/55">{fmtKm(r.km[k.key])}</dd>
        </div>
      ))}
    </dl>
  )
}

function Pil({ tingkat, children }) {
  const k = kepadatanOf(tingkat)
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ backgroundColor: k.lembut, color: k.warna }}>
      {children}
    </span>
  )
}

const Judul = ({ eyebrow, children }) => (
  <div className="pr-9">
    <p className="text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">{eyebrow}</p>
    <h2 className="mt-0.5 font-display text-[18px] leading-tight font-bold text-tentang-dark">{children}</h2>
  </div>
)

// ---------- ringkasan kota ----------
function RingkasKota({ data, onFokusJalan, ringkas }) {
  const r = useMemo(() => ringkasKota(data), [data])
  const maks = r.terpadat[0]?.maks ?? 1
  return (
    <div>
      <Judul eyebrow="Informasi kepadatan">Jalur angkot Kota Bogor</Judul>
      <p className="mt-1 text-[12.5px] text-dark/60">
        {fmtKm(r.total)} jalan dilewati angkot · <strong className="text-dark/80">{Math.round(r.pct.Tinggi)}%</strong> di antaranya padat (≥ 4 rute)
      </p>
      <div className="mt-3">
        <BarKepadatan pct={r.pct} />
        {ringkas && <LegendaMini pct={r.pct} />}
      </div>
      {!ringkas && (
        <>
          <AngkaKelas r={r} />
          {r.terpadat.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-[13px] font-bold text-tentang-dark">Jalan paling banyak dilewati</h3>
              <ol className="space-y-1">
                {r.terpadat.map((j, i) => (
                  <li key={j.nama}>
                    <button onClick={() => onFokusJalan(j.nama)} className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[#F4F7F7]">
                      <span className="w-4 text-center font-display text-[14px] font-bold text-dark/35">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-dark group-hover:text-primary">{j.nama}</span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[#EDF1F2]">
                          <span className="block h-full rounded-full" style={{ width: `${(j.maks / maks) * 100}%`, backgroundColor: kepadatanOf(j.tingkat).warna }} />
                        </span>
                      </span>
                      <Pil tingkat={j.tingkat}>{j.maks} rute</Pil>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          <p className="mt-4 rounded-2xl bg-[#F4F7F7] px-3 py-2.5 text-[12px] leading-relaxed text-dark/65">
            Kepadatan = banyaknya trayek yang lewat di ruas jalan yang sama. Pilih nomor rute untuk melihat kepadatan sepanjang jalurnya.
          </p>
        </>
      )}
    </div>
  )
}

// ---------- kepadatan sepanjang satu rute ----------
const cache = new Map()

function JalurRute({ data, t, ringkas }) {
  const kode = t.kode_trayek
  const [detail, setDetail] = useState(() => ({ data: cache.get(kode) ?? null, loading: !cache.has(kode), error: null }))
  const [arahI, setArahI] = useState(0)
  // komponen di-key per kode trayek, jadi cukup ambil sekali kalau belum ada di cache
  useEffect(() => {
    if (cache.has(kode)) return
    let aktif = true
    api
      .detailTrayek(nomor(kode))
      .then((d) => {
        cache.set(kode, d)
        if (aktif) setDetail({ data: d, loading: false, error: null })
      })
      .catch((error) => aktif && setDetail({ data: null, loading: false, error }))
    return () => {
      aktif = false
    }
  }, [kode])

  const r = useMemo(() => ringkasRute(data, kode), [data, kode])
  const arah = detail.data?.rute ?? []
  const a = arah[arahI]
  const baris = useMemo(() => barisJalur(a?.urutan_jalan, r.perJalan, kode), [a, r, kode])
  const pctTinggi = Math.round(r.pct.Tinggi)

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-[17px] font-bold text-white" style={{ backgroundColor: t.warna }}>
          {nomor(kode)}
        </span>
        <div className="min-w-0 pr-9">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">Kepadatan sepanjang jalur</p>
          <p className="truncate font-display text-[16px] leading-tight font-bold text-tentang-dark">{t.nama_trayek}</p>
        </div>
      </div>

      <div className="mt-3">
        <BarKepadatan pct={r.pct} />
        <LegendaMini pct={r.pct} />
        <p className="mt-2 text-[12.5px] leading-snug text-dark/65">
          {pctTinggi > 0 ? (
            <>
              <strong style={{ color: kepadatanOf('Tinggi').warna }}>{pctTinggi}%</strong> jalurnya ({fmtKm(r.km.Tinggi)}) lewat ruas padat yang dilalui ≥ 4 rute.
            </>
          ) : (
            <>Tidak ada ruas padat (≥ 4 rute) di jalur ini.</>
          )}
        </p>
      </div>

      {!ringkas && (
        <>
          {arah.length > 1 && (
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[#F1F4F5] p-1">
              {arah.map((x, i) => (
                <button
                  key={x.rute_id}
                  onClick={() => setArahI(i)}
                  aria-pressed={i === arahI}
                  className={`truncate rounded-lg px-2 py-2 text-[12.5px] font-semibold transition ${i === arahI ? 'bg-white text-primary shadow-sm' : 'text-dark/55 hover:text-dark'}`}
                >
                  Ke {x.tujuan}
                </button>
              ))}
            </div>
          )}

          {detail.loading && <p className="mt-4 text-[13px] text-dark/50">Memuat urutan jalan…</p>}
          {detail.error && <p className="mt-4 text-[13px] text-red-700">Urutan jalan gagal dimuat.</p>}

          {baris.length > 0 && (
            <ol className="mt-4">
              {baris.map((b, i) => {
                const k = kepadatanOf(b.tingkat)
                const ujung = i === 0 || i === baris.length - 1
                const lain = b.lain.map(nomor)
                return (
                  <li key={`${b.nama}-${i}`} className="relative grid grid-cols-[22px_1fr_auto] items-start gap-x-3 pb-3 last:pb-0">
                    {i < baris.length - 1 && <span className="absolute top-3 bottom-0 left-[9px] w-1 rounded-full" style={{ backgroundColor: k.warna }} />}
                    <span
                      className={`relative z-[1] mt-0.5 rounded-full border-[3px] bg-white ${ujung ? 'h-[22px] w-[22px]' : 'mt-1 ml-[3px] h-4 w-4'}`}
                      style={{ borderColor: ujung ? t.warna : k.warna, backgroundColor: ujung ? t.warna : '#fff' }}
                    />
                    <span className="min-w-0">
                      <span className={`block text-[13.5px] leading-snug ${ujung ? 'font-bold text-tentang-dark' : 'font-medium text-dark'}`}>{b.nama}</span>
                      {lain.length > 0 && (
                        <span className="block truncate text-[11.5px] text-dark/50">
                          bareng {lain.slice(0, 5).join(', ')}
                          {lain.length > 5 ? ` +${lain.length - 5}` : ''}
                        </span>
                      )}
                    </span>
                    <Pil tingkat={b.tingkat}>{b.maks} rute</Pil>
                  </li>
                )
              })}
            </ol>
          )}
          {!detail.loading && a && !baris.length && <p className="mt-4 text-[13px] text-dark/50">Urutan jalan untuk arah ini belum tersedia.</p>}
        </>
      )}
    </div>
  )
}

// Panel info kepadatan: ringkasan kota (belum pilih rute) atau diagram jalur rute terpilih.
export default function InfoKepadatan({ kepadatan, trayek, dipilih, onFokusJalan, ringkas = false }) {
  const [aktif, setAktif] = useState(null)
  const semua = trayek.data && dipilih.length === trayek.data.length // semua dipilih = sama dengan ringkasan kota
  const list = semua ? [] : (trayek.data ?? []).filter((t) => dipilih.includes(t.kode_trayek))
  const t = list.find((x) => x.kode_trayek === aktif) ?? list.at(-1)

  if (kepadatan.loading || !kepadatan.data) return <p className="text-[13px] text-dark/55">{kepadatan.error ? 'Data kepadatan gagal dimuat.' : 'Memuat data kepadatan…'}</p>

  if (!t) return <RingkasKota data={kepadatan.data} onFokusJalan={onFokusJalan} ringkas={ringkas} />
  return (
    <div>
      {list.length > 1 && !ringkas && (
        <div className="mb-3 flex flex-wrap gap-1.5 pr-9">
          {list.map((x) => (
            <button
              key={x.kode_trayek}
              onClick={() => setAktif(x.kode_trayek)}
              className="h-8 rounded-lg px-2.5 font-display text-[13px] font-bold transition"
              style={x === t ? { backgroundColor: x.warna, color: '#fff' } : { backgroundColor: x.warna + '14', color: x.warna }}
            >
              {nomor(x.kode_trayek)}
            </button>
          ))}
        </div>
      )}
      <JalurRute key={t.kode_trayek} data={kepadatan.data} t={t} ringkas={ringkas} />
    </div>
  )
}
