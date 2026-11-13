import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/naik'
import { useDashboard } from '../dashboard/context'
import { Card, CardHeader, Floating, KodeBadge, PilWarga } from '../dashboard/ui'
import { IconArrowRight, IconLocate, IconRotate } from '../dashboard/icons'
import { nomor, rupiah } from '../utils/format'

function IconChat({ className = 'h-5 w-5' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  )
}

function IconSend({ className = 'h-4 w-4' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

const PESAN_AWAL = {
  id: 'welcome',
  pengirim: 'ai',
  status: 'success',
  narasi:
    'Halo! Saya **Kang Angkot**, asisten navigasi WebGIS NAIK. Tanyakan rute angkot, tarif, atau tempat singgah di sekitar jalur angkot Kota Bogor.',
  rekomendasi_angkot: [],
  tempat_singgah: [],
}

// Tombol pembuka chat untuk dipasang di tempat lain (mis. slot atas bottom sheet Beranda di HP).
export function TombolTanyaAi() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('naik:toggle-kang-angkot'))}
      aria-label="Tanya Kang Angkot AI"
      className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(26,147,111,0.35)] transition active:scale-[0.97]"
    >
      <IconChat className="h-5 w-5" />
      Tanya AI
    </button>
  )
}

function FormatTeks({ teks }) {
  if (!teks) return null
  const parts = String(teks).split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold text-tentang-dark">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={idx}>{part}</span>
      })}
    </>
  )
}

export default function AiChatbot() {
  const location = useLocation()
  const navigate = useNavigate()
  const { trayek, filter } = useDashboard()
  const [buka, setBuka] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pesanList, setPesanList] = useState([PESAN_AWAL])
  const [koordinat, setKoordinat] = useState(null)
  const [locLoading, setLocLoading] = useState(false)
  const listRef = useRef(null)
  const [daftarTerbuka, setDaftarTerbuka] = useState(false) // panel Daftar Rute terbuka -> tombol AI disembunyikan di HP

  useEffect(() => {
    const ubah = (e) => setDaftarTerbuka(Boolean(e.detail))
    window.addEventListener('naik:daftar-rute', ubah)
    return () => window.removeEventListener('naik:daftar-rute', ubah)
  }, [])

  const warnaMap = useMemo(
    () => Object.fromEntries((trayek?.data ?? []).map((t) => [t.kode_trayek, t.warna])),
    [trayek?.data],
  )

  const kodeAktif = useMemo(() => {
    const match = location.pathname.match(/^\/rute\/([^/]+)/)
    if (match) {
      const raw = decodeURIComponent(match[1]).replace(/^Trayek\s*/i, '')
      return `Trayek ${raw.padStart(2, '0')}`
    }
    if (filter?.kode?.length === 1) {
      return filter.kode[0]
    }
    return ''
  }, [location.pathname, filter?.kode])

  const sedangBukaDetailRute = /^\/rute\/[^/]+/.test(location.pathname)

  // Posisi tombol di HP: tiap halaman punya area kosong berbeda supaya tidak bertabrakan dengan panel lain.
  // /rute/:kode -> kanan atas (panel detail memenuhi bawah); /rute -> kanan bawah di atas tombol lokasi;
  // /peta -> ada di slot atas bottom sheet; /cari -> disembunyikan (panel hasil memenuhi layar).
  const posisiHP = sedangBukaDetailRute
    ? 'max-lg:fixed max-lg:top-3 max-lg:right-3 flex'
    : location.pathname === '/rute'
      ? 'max-lg:fixed max-lg:right-3 max-lg:bottom-[104px] flex'
      : 'max-lg:hidden lg:inline-flex'

  // Dibuka dari tombol "Kang Angkot" di menu bawah (HP) lewat event; Esc menutup panel
  useEffect(() => {
    const toggle = () => setBuka((v) => !v)
    const esc = (e) => e.key === 'Escape' && setBuka(false)
    window.addEventListener('naik:toggle-kang-angkot', toggle)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('naik:toggle-kang-angkot', toggle)
      window.removeEventListener('keydown', esc)
    }
  }, [])

  useEffect(() => {
    if (!buka) return
    const el = listRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [pesanList, loading, buka])

  function toggleLokasi() {
    if (koordinat) {
      setKoordinat(null)
      return
    }
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setKoordinat({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lon: Number(pos.coords.longitude.toFixed(5)),
        })
        setLocLoading(false)
      },
      () => {
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  async function kirimPesan(teksLangsung) {
    const teks = (teksLangsung ?? input).trim()
    if (!teks || teks.length < 3 || loading) return

    if (!teksLangsung) setInput('')

    setPesanList((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        pengirim: 'user',
        teks,
      },
    ])
    setLoading(true)

    try {
      const payload = {
        pesan: teks,
        ...(kodeAktif ? { kode_trayek: kodeAktif } : {}),
        ...(koordinat ? { lat: koordinat.lat, lon: koordinat.lon } : {}),
      }
      const res = await api.aiRekomendasi(payload)
      setPesanList((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          pengirim: 'ai',
          status: res?.status ?? 'success',
          narasi:
            res?.narasi ??
            'Maaf, belum ditemukan rekomendasi yang sesuai untuk pertanyaan tersebut.',
          rekomendasi_angkot: Array.isArray(res?.rekomendasi_angkot)
            ? res.rekomendasi_angkot
            : [],
          tempat_singgah: Array.isArray(res?.tempat_singgah) ? res.tempat_singgah : [],
        },
      ])
    } catch (err) {
      setPesanList((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          pengirim: 'ai',
          status: 'error',
          narasi:
            err?.message ||
            'Gagal terhubung ke server. Pastikan backend (`php artisan serve`) sedang aktif.',
          rekomendasi_angkot: [],
          tempat_singgah: [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const saranPertanyaan = useMemo(() => {
    const daftar = [
      'Rute ke Kebun Raya Bogor',
      'Kuliner dekat Suryakencana',
      'Dari Stasiun Bogor ke Botani Square',
    ]
    if (kodeAktif) {
      return [`Rekomendasi tempat di ${kodeAktif}`, ...daftar.slice(0, 2)]
    }
    return daftar
  }, [kodeAktif])

  return (
    <Floating
      className={`!z-[1100] flex flex-col items-end lg:bottom-4 ${
        sedangBukaDetailRute ? 'lg:right-[396px]' : 'lg:right-3'
      }`}
    >
      {/* HP: panel jadi lembar penuh dari bawah (menutup menu bawah) + latar redup; desktop: kartu melayang */}
      {buka && (
        <div
          aria-hidden="true"
          onClick={() => setBuka(false)}
          className="fixed inset-0 bg-black/45 lg:hidden"
        />
      )}
      {buka && (
        <Card
          role="dialog"
          aria-label="Kang Angkot"
          className="fixed inset-x-2 bottom-2 z-10 flex h-[min(640px,calc(100dvh-72px))] flex-col overflow-hidden !rounded-[26px] pb-[env(safe-area-inset-bottom)] lg:static lg:mb-2.5 lg:h-[min(520px,calc(100dvh-148px))] lg:w-[368px] lg:pb-0"
        >
          <CardHeader
            title="Kang Angkot"
            subtitle="Asisten rute & tempat singgah Kota Bogor"
            icon={<IconChat className="h-5 w-5" />}
            onClose={() => setBuka(false)}
          />

          <div className="mt-2 flex items-center justify-between gap-2 border-y border-[#EDF1F2] bg-[#F6F9F9] px-5 py-2 text-[12px]">
            <span className="truncate font-medium text-dark/65">
              {kodeAktif ? (
                <>
                  Konteks: <strong className="font-semibold text-tentang-dark">{kodeAktif}</strong>
                </>
              ) : (
                'Semua jalur Kota Bogor'
              )}
            </span>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleLokasi}
                disabled={locLoading}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  koordinat
                    ? 'border-primary bg-[#EAF4EE] text-primary'
                    : 'border-[#E3E8EA] bg-white text-dark/65 hover:bg-[#F3F6F6]'
                }`}
              >
                <IconLocate className="h-3.5 w-3.5" />
                {locLoading ? 'Mencari…' : koordinat ? 'Lokasi aktif' : 'Lokasi saya'}
              </button>
              {pesanList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPesanList([PESAN_AWAL])}
                  title="Ulangi percakapan"
                  aria-label="Ulangi percakapan"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E3E8EA] bg-white text-dark/55 transition hover:bg-[#F3F6F6] hover:text-dark"
                >
                  <IconRotate className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div
            ref={listRef}
            className="naik-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
          >
            {pesanList.map((msg) => {
              if (msg.pengirim === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
                      {msg.teks}
                    </div>
                  </div>
                )
              }

              const isError = msg.status === 'error'
              return (
                <div key={msg.id} className="space-y-2">
                  <div
                    className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                      isError
                        ? 'border border-red-200 bg-red-50 text-red-800'
                        : 'bg-[#F6F9F9] text-dark'
                    }`}
                  >
                    <p className="whitespace-pre-line">
                      <FormatTeks teks={msg.narasi} />
                    </p>

                    {msg.rekomendasi_angkot?.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-[#E3E8EA] pt-3">
                        <p className="text-[11.5px] font-semibold text-tentang-dark">
                          Rekomendasi angkot
                        </p>
                        {msg.rekomendasi_angkot.map((rek, i) => {
                          const noRute = nomor(rek.kode_trayek)
                          return (
                            <div
                              key={i}
                              className="rounded-2xl border border-[#E3E8EA] bg-white p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <KodeBadge
                                    kode={rek.kode_trayek}
                                    warna={warnaMap[rek.kode_trayek]}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="truncate font-display text-[14px] font-bold text-dark">
                                        {rek.kode_trayek}
                                      </p>
                                      <PilWarga kode={rek.kode_trayek} />
                                    </div>
                                    {rek.arah && (
                                      <p className="truncate text-[12px] text-dark/55">
                                        {rek.arah}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-full bg-[#EAF4EE] px-2.5 py-0.5 text-[12px] font-bold text-primary">
                                  {rupiah(rek.tarif ?? 5000)}
                                </span>
                              </div>

                              {(rek.titik_naik || rek.titik_turun) && (
                                <dl className="mt-2.5 space-y-1 border-t border-[#EDF1F2] pt-2 text-[12px] text-dark/75">
                                  {rek.titik_naik && (
                                    <div className="flex gap-1.5">
                                      <dt className="shrink-0 font-semibold text-dark/55">Naik:</dt>
                                      <dd className="min-w-0">{rek.titik_naik}</dd>
                                    </div>
                                  )}
                                  {rek.titik_turun && (
                                    <div className="flex gap-1.5">
                                      <dt className="shrink-0 font-semibold text-dark/55">Turun:</dt>
                                      <dd className="min-w-0">{rek.titik_turun}</dd>
                                    </div>
                                  )}
                                </dl>
                              )}

                              <button
                                type="button"
                                onClick={() => navigate(`/rute/${encodeURIComponent(noRute)}`)}
                                className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E3E8EA] bg-[#F6F9F9] py-1.5 text-[12px] font-semibold text-tentang-dark transition hover:border-primary hover:bg-[#EAF4EE] hover:text-primary"
                              >
                                Lihat rute di peta <IconArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {msg.tempat_singgah?.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-[#E3E8EA] pt-3">
                        <p className="text-[11.5px] font-semibold text-tentang-dark">
                          Tempat singgah di sekitar jalur
                        </p>
                        {msg.tempat_singgah.map((poi, i) => (
                          <div
                            key={i}
                            className="rounded-2xl border border-[#E3E8EA] bg-white px-3 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[13px] font-semibold text-dark">
                                {poi.nama}
                              </p>
                              {poi.kategori && (
                                <span className="shrink-0 rounded-full bg-[#EAF4EE] px-2.5 py-0.5 text-[10.5px] font-semibold capitalize text-primary">
                                  {poi.kategori}
                                </span>
                              )}
                            </div>
                            {poi.alasan && (
                              <p className="mt-1 text-[12px] leading-snug text-dark/60">
                                {poi.alasan}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="rounded-2xl bg-[#F6F9F9] px-4 py-3 text-[13px] text-dark/60">
                Memuat rekomendasi rute…
              </div>
            )}

            {pesanList.length <= 2 && !loading && (
              <div className="pt-1">
                <p className="mb-2 text-[11.5px] font-semibold text-dark/45">
                  Pertanyaan populer
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {saranPertanyaan.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => kirimPesan(s)}
                      className="rounded-full border border-[#E3E8EA] bg-white px-3 py-1.5 text-left text-[12px] font-medium text-dark/75 transition hover:border-primary hover:bg-[#F6F9F9] hover:text-tentang-dark"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              kirimPesan()
            }}
            className="flex items-center gap-2 border-t border-[#EDF1F2] bg-white px-4 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya rute atau tempat tujuan…"
              enterKeyHint="send"
              className="h-11 min-w-0 flex-1 rounded-2xl border border-[#E3E8EA] bg-[#F6F9F9] px-3.5 text-[16px] lg:text-[13.5px] text-dark outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length < 3}
              aria-label="Kirim pertanyaan"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_6px_16px_rgba(26,147,111,0.25)] transition hover:bg-[#178563] disabled:opacity-40"
            >
              <IconSend className="h-4 w-4" />
            </button>
          </form>
        </Card>
      )}

      {/* Tombol pembuka. HP: ditaruh di titik bebas per halaman; di /peta & /cari dipakai tombol lain (lihat TombolTanyaAi) */}
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        aria-label="Tanya Kang Angkot AI"
        className={`items-center gap-2.5 text-[14px] font-semibold shadow-[0_8px_30px_rgba(21,30,44,0.16)] transition active:scale-[0.97] ${posisiHP} h-11 rounded-full px-4 lg:static lg:inline-flex lg:h-12 lg:rounded-2xl lg:text-[14.5px] ${
          sedangBukaDetailRute ? 'max-lg:w-11 max-lg:justify-center max-lg:px-0' : ''
        } ${sedangBukaDetailRute && daftarTerbuka ? 'max-lg:!hidden' : ''} ${
          buka
            ? 'max-lg:!hidden border border-[#E3E8EA] bg-white text-tentang-dark hover:bg-[#F6F9F9]'
            : 'bg-primary text-white hover:bg-[#178563]'
        }`}
      >
        <IconChat className="h-5 w-5" />
        {/* HP di halaman detail rute: hanya ikon, supaya tidak menabrak tombol "Daftar Rute" */}
        <span className={sedangBukaDetailRute ? 'lg:hidden max-lg:sr-only' : 'lg:hidden'}>Tanya AI</span>
        <span className="hidden lg:inline">Kang Angkot</span>
      </button>
    </Floating>
  )
}

