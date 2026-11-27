import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/naik'
import { barisJalur, cariJalan, daftarJalan, fmtKm, ringkasKota, ringkasRute } from '../kepadatan'
import { KEPADATAN, kepadatanOf } from '../warna'
import { nomor } from '../lib'
import { NomorChip } from '../ui'
import { nomorTampil } from '../nomorWarga'
import { IconChevronRight } from '../icons'
import { BarKepadatan, ChipTrayek, Judul, LegendaMini, Pil } from './KepadatanBits'
import DaftarRuas from './DaftarRuas'
import DetailRuas from './DetailRuas'

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

// ---------- ringkasan kota ----------
function RingkasKota({ data, daftar, onFokusJalan, onPilihTrayek, onSemua, dipilih = [], ringkas }) {
  const r = useMemo(() => ringkasKota(data), [data])
  const maks = r.terpadat[0]?.maks ?? 1
  const [buka, setBuka] = useState(null) // nama jalan yang daftar trayeknya dibuka
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
                    <button
                      onClick={() => {
                        onFokusJalan(j.nama)
                        setBuka((b) => (b === j.nama ? null : j.nama))
                      }}
                      aria-expanded={buka === j.nama}
                      className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[#F4F7F7]"
                    >
                      <span className="w-4 text-center font-display text-[14px] font-bold text-dark/35">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-dark group-hover:text-primary">{j.nama}</span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[#EDF1F2]">
                          <span className="block h-full rounded-full" style={{ width: `${(j.maks / maks) * 100}%`, backgroundColor: kepadatanOf(j.tingkat).warna }} />
                        </span>
                      </span>
                      <Pil tingkat={j.tingkat}>{j.maks} rute</Pil>
                    </button>
                    {buka === j.nama && j.kode.length > 0 && (
                      <div className="mb-2 pr-2 pl-9">
                        <p className="mb-1.5 text-[11.5px] text-dark/55">Angkot yang lewat sini:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {j.kode.map((k) => (
                            <ChipTrayek key={k} kode={k} aktif={dipilih.includes(k)} onClick={() => onPilihTrayek?.(k)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
          <button
            type="button"
            onClick={onSemua}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl bg-primary/10 px-3.5 py-3 text-left transition hover:bg-primary/15"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-primary">Lihat seluruh ruas jalan</span>
              <span className="block text-[11.5px] text-dark/55">{daftar.total.toLocaleString('id-ID')} ruas · Rendah, Sedang, dan Tinggi</span>
            </span>
            <IconChevronRight className="h-4 w-4 shrink-0 text-primary" />
          </button>
          <p className="mt-3 rounded-2xl bg-[#F4F7F7] px-3 py-2.5 text-[12px] leading-relaxed text-dark/65">
            Kepadatan = banyaknya trayek yang lewat di ruas jalan yang sama. Pilih nomor rute untuk melihat kepadatan sepanjang jalurnya.
          </p>
        </>
      )}
    </div>
  )
}

// ---------- kepadatan sepanjang satu rute ----------
const cache = new Map()

function JalurRute({ data, daftar, t, ringkas, onSemua, onPilihJalan }) {
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
          <NomorChip kode={kode} />
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
                    <button type="button" onClick={() => onPilihJalan(b.nama)} className="min-w-0 text-left">
                      <span className={`block text-[13.5px] leading-snug ${ujung ? 'font-bold text-tentang-dark' : 'font-medium text-dark'}`}>{b.nama}</span>
                      {lain.length > 0 && (
                        <span className="block truncate text-[11.5px] text-dark/50">
                          bareng {lain.slice(0, 5).join(', ')}
                          {lain.length > 5 ? ` +${lain.length - 5}` : ''}
                        </span>
                      )}
                    </button>
                    <Pil tingkat={b.tingkat}>{b.maks} rute</Pil>
                  </li>
                )
              })}
            </ol>
          )}
          {!detail.loading && a && !baris.length && <p className="mt-4 text-[13px] text-dark/50">Urutan jalan untuk arah ini belum tersedia.</p>}
          <button
            type="button"
            onClick={onSemua}
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-2xl bg-primary/10 px-3.5 py-3 text-left transition hover:bg-primary/15"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-primary">Lihat seluruh ruas jalan</span>
              <span className="block text-[11.5px] text-dark/55">{daftar.total.toLocaleString('id-ID')} ruas se-Kota Bogor</span>
            </span>
            <IconChevronRight className="h-4 w-4 shrink-0 text-primary" />
          </button>
        </>
      )}
    </div>
  )
}

// Panel info kepadatan. Tiga tampilan dengan navigasi kembali yang jelas:
// Ringkasan (atau jalur rute terpilih) -> Seluruh ruas jalan -> Detail ruas.
export default function InfoKepadatan({ kepadatan, trayek, dipilih, onFokusJalan, onPilihTrayek, nav, setNav, besar = true, ringkas = false }) {
  const [aktif, setAktif] = useState(null)
  const [stDaftar, setStDaftar] = useState({ kategori: 'Semua', cari: '', batas: 40, scrollTop: 0 })

  const semua = trayek.data && dipilih.length === trayek.data.length // semua dipilih = sama dengan ringkasan kota
  const list = semua ? [] : (trayek.data ?? []).filter((t) => dipilih.includes(t.kode_trayek))
  const t = list.find((x) => x.kode_trayek === aktif) ?? list.at(-1)

  const daftar = useMemo(() => (kepadatan.data ? daftarJalan(kepadatan.data) : { list: [], jumlah: {}, total: 0 }), [kepadatan.data])

  if (kepadatan.loading || !kepadatan.data) return <p className="text-[13px] text-dark/55">{kepadatan.error ? 'Data kepadatan gagal dimuat.' : 'Memuat data kepadatan…'}</p>

  const keDaftar = () => setNav({ view: 'semua', nama: null })
  const keDetail = (nama) => setNav((n) => ({ view: 'detail', nama, dari: n.view === 'semua' ? 'semua' : 'dasar' }))
  const keDasar = () => setNav({ view: 'dasar', nama: null })

  if (nav.view === 'detail') {
    const jalan = cariJalan(daftar, nav.nama)
    const kembaliKeDaftar = nav.dari === 'semua'
    if (ringkas && jalan) {
      return (
        <div>
          <Judul eyebrow="Detail ruas jalan">{jalan.nama}</Judul>
          <p className="mt-1 text-[12.5px] text-dark/60">
            {jalan.maks} rute · kepadatan {jalan.tingkat}
          </p>
        </div>
      )
    }
    return (
      <DetailRuas
        jalan={jalan}
        dipilih={dipilih}
        onPilihTrayek={onPilihTrayek}
        onFokus={onFokusJalan}
        onKembali={() => (kembaliKeDaftar ? keDaftar() : keDasar())}
        labelKembali={kembaliKeDaftar ? 'Daftar ruas' : t ? `Jalur ${nomorTampil(t.kode_trayek)}` : 'Ringkasan'}
      />
    )
  }

  if (nav.view === 'semua') {
    if (ringkas) {
      return (
        <div>
          <Judul eyebrow="Informasi kepadatan">Seluruh ruas jalan</Judul>
          <p className="mt-1 text-[12.5px] text-dark/60">{daftar.total.toLocaleString('id-ID')} ruas jalan</p>
        </div>
      )
    }
    return <DaftarRuas daftar={daftar} st={stDaftar} setSt={setStDaftar} onPilih={keDetail} onKembali={keDasar} besar={besar} />
  }

  if (!t)
    return (
      <RingkasKota
        data={kepadatan.data}
        daftar={daftar}
        onFokusJalan={onFokusJalan}
        onPilihTrayek={onPilihTrayek}
        onSemua={keDaftar}
        dipilih={dipilih}
        ringkas={ringkas}
      />
    )

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
              {nomorTampil(x.kode_trayek)}
            </button>
          ))}
        </div>
      )}
      <JalurRute key={t.kode_trayek} data={kepadatan.data} daftar={daftar} t={t} ringkas={ringkas} onSemua={keDaftar} onPilihJalan={keDetail} />
    </div>
  )
}
