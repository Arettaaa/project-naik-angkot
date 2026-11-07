import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import kota from '../assets/hero/hero-kota.svg'
import awan from '../assets/hero/hero-awan.svg'
import mobilDekat from '../assets/hero/hero-mobil-dekat.svg'
import mobilJauh from '../assets/hero/hero-mobil-jauh.svg'
import matahari from '../assets/hero/hero-matahari.svg'

// Ilustrasi hero: kota statis (satu gambar) + angkot, awan, dan matahari yang digerakkan CSS transform.
// Jauh lebih ringan dari animasi Lottie sebelumnya (tidak menggambar ulang seluruh kota tiap frame).
// Semua posisi mengikuti koordinat ilustrasi asli 1464 × 1438.
const W = 1464
const H = 1438
const pos = (x, y, w) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%` })

const AWAN = [
  { x: 126, y: 442, w: 113, durasi: 26, tunda: -4 },
  { x: 500, y: 539, w: 113, durasi: 32, tunda: -12 },
  { x: 931, y: 442, w: 113, durasi: 28, tunda: -20 },
  { x: 1208, y: 535, w: 90, durasi: 34, tunda: -8 },
]

function AdeganKota() {
  const ref = useRef(null)

  // animasi berhenti saat hero tidak terlihat supaya tidak membebani bagian lain
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => el.classList.toggle('hero-diam', !e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="hero-illustration absolute left-[-0.8333cqw] top-[calc(210px-20cqw)] aspect-[1464/1438] h-[99.8611cqw] w-[101.6667cqw] max-w-none sm:top-[calc(100px-20cqw)] min-[900px]:max-lg:-translate-y-[30px] lg:top-[-15.5556cqw]"
    >
      <img src={kota} alt="" className="absolute inset-0 h-full w-full select-none" draggable="false" />
      {AWAN.map((a) => (
        <img
          key={a.x}
          src={awan}
          alt=""
          draggable="false"
          className="hero-awan absolute select-none"
          style={{ ...pos(a.x, a.y, a.w), animationDuration: `${a.durasi}s`, animationDelay: `${a.tunda}s` }}
        />
      ))}
      <img src={matahari} alt="" draggable="false" className="hero-matahari absolute select-none" style={pos(967, 629, 34.5)} />
      {/* dua lajur jalan: angkot jauh (lebih kecil) & dekat, melaju kiri -> kanan dengan kecepatan tetap */}
      <div className="hero-lajur absolute inset-x-0" style={{ top: `${(1000 / H) * 100}%` }}>
        <img src={mobilJauh} alt="" draggable="false" className="hero-mobil select-none" style={{ width: `${(135 / W) * 100}%`, '--durasi': '13s', '--tunda': '-3s' }} />
      </div>
      <div className="hero-lajur absolute inset-x-0" style={{ top: `${(1050 / H) * 100}%` }}>
        <img src={mobilDekat} alt="" draggable="false" className="hero-mobil select-none" style={{ width: `${(171 / W) * 100}%`, '--durasi': '9.5s', '--tunda': '-6s' }} />
      </div>
    </div>
  )
}

export default function Hero() {
  const [nomor, setNomor] = useState(1)
  const kode = String(nomor).padStart(2, '0')
  const geser = (d) => setNomor((n) => ((n - 1 + d + 30) % 30) + 1)

  return (
    <section
      aria-label="NAIK, teman perjalanan angkot Kota Bogor"
      className="hero-section relative h-auto min-h-[calc(clamp(520px,100cqw,760px)+16cqw)] w-full overflow-hidden bg-[linear-gradient(180deg,#E8F6FF_0%,#E8F6FF_56%,#1A936F_56%,#1A936F_100%)] min-[900px]:min-h-[calc(80cqw+80px+16cqw)] lg:h-[calc(84.3056cqw+16cqw)] lg:min-h-0"
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none" aria-hidden="true">
        <AdeganKota />
      </div>

      <div className="hero-content relative z-10 mx-auto flex w-[min(1201px,calc(100%-32px))] flex-col items-start pt-[4.75rem] pb-[2.5cqw] sm:pt-[max(5rem,11.8056cqw)] sm:pb-[4.4444cqw] lg:pb-0 lg:pt-[14.5833cqw]">
        <h1 className="hero-muncul font-display text-3xl font-extrabold leading-tight tracking-tight text-hero-brown sm:text-5xl lg:text-[60px] lg:leading-[3.78125cqw] lg:whitespace-nowrap">
          NAIK Angkot, Anti Nyasar.
        </h1>

        <p className="hero-muncul mt-2 max-w-[760px] font-sans text-lg font-medium leading-snug text-hero-brown [animation-delay:90ms] sm:text-2xl lg:text-[34px] lg:leading-[1.5]">
          Cari angkot yang tepat, lihat rutenya,{' '}
          <br className="hidden lg:inline" />
          dan cek titik pindah di Kota Bogor.
        </p>

        {/* Pill: cari rute + pilih nomor angkot untuk langsung melihat rutenya */}
        <div className="hero-muncul mt-4 inline-flex h-[52px] max-w-full items-center gap-1 rounded-full border border-white/40 bg-hero-pill pr-1.5 pl-5 shadow-sm [animation-delay:180ms] sm:mt-6 sm:h-14 lg:mt-6">
          <Link to="/cari" className="inline-flex items-center gap-2.5 text-hero-brown transition-opacity hover:opacity-80">
            <svg width="16" height="16" viewBox="0 0 17 17" fill="none" className="shrink-0" aria-hidden="true">
              <path
                d="M14.5 6.9c0 4.84-6.2 8.99-6.2 8.99S2.07 11.75 2.07 6.9a6.22 6.22 0 0 1 12.43 0Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8.29" cy="6.91" r="2.07" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            <span className="font-inter text-[15px] font-semibold whitespace-nowrap sm:text-[17px]">Cari rute sekarang</span>
          </Link>
          <span className="mx-2.5 h-5 w-px bg-hero-brown/25" aria-hidden="true" />
          <button type="button" onClick={() => geser(-1)} className="hero-panah" aria-label="Nomor angkot sebelumnya">
            <svg width="16" height="16" viewBox="0 0 17 17" fill="none" aria-hidden="true">
              <path d="M10.36 12.44 6.22 8.29l4.14-4.15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link
            to={`/rute/${kode}`}
            className="min-w-9 rounded-full px-1.5 py-1 text-center font-inter text-[16px] font-bold text-hero-brown tabular-nums transition hover:bg-black/5 sm:text-[17px]"
            title={`Lihat rute angkot ${kode}`}
            aria-label={`Lihat rute angkot ${kode}`}
          >
            {kode}
          </Link>
          <button type="button" onClick={() => geser(1)} className="hero-panah" aria-label="Nomor angkot berikutnya">
            <svg width="16" height="16" viewBox="0 0 17 17" fill="none" aria-hidden="true">
              <path d="m6.22 12.44 4.14-4.15-4.14-4.14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
