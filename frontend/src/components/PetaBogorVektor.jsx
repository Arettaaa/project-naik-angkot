import { useId } from 'react'

// Peta ilustrasi vektor Kota Bogor (gaya flat/illustrated). Bentuk kota dari batas GADM (lon, lat),
// diproyeksikan & dihaluskan jadi kurva. Garis kecamatan, sungai, dan jalur hanya ILUSTRASI (bukan batas resmi).
const BATAS = [
  [106.76736, -6.54053], [106.766, -6.53353], [106.76694, -6.52216], [106.77, -6.5153], [106.77842, -6.51907],
  [106.78839, -6.51737], [106.7905, -6.52671], [106.80475, -6.53602], [106.81723, -6.53969], [106.82209, -6.53688],
  [106.828, -6.53983], [106.82775, -6.54879], [106.8322, -6.56409], [106.83141, -6.58085], [106.8264, -6.593],
  [106.8223, -6.59121], [106.8205, -6.59746], [106.82529, -6.62514], [106.83131, -6.62476], [106.83934, -6.63332],
  [106.84032, -6.64408], [106.8455, -6.65091], [106.84088, -6.66233], [106.8389, -6.67191], [106.8312, -6.67712],
  [106.8288, -6.67416], [106.82083, -6.67451], [106.80563, -6.66353], [106.80305, -6.65454], [106.795, -6.65847],
  [106.78464, -6.66041], [106.7763, -6.64839], [106.78667, -6.63628], [106.77648, -6.61031], [106.77494, -6.60224],
  [106.7668, -6.59918], [106.75974, -6.58957], [106.75359, -6.5869], [106.7531, -6.59641], [106.7446, -6.59796],
  [106.7508, -6.57598], [106.7443, -6.57604], [106.742, -6.56476], [106.74854, -6.5604],
]

// proyeksi lon/lat -> koordinat viewBox 778 x 856 (skala sama di kedua sumbu).
// Peta sengaja dikecilkan & ditaruh di tengah supaya ada ruang aman di semua sisi (tidak kepotong).
const LON0 = 106.742
const LAT0 = -6.5153
const PX_LAT = 3900
const PX_LON = 3875
const OX = 188
const OY = 108
const P = ([lon, lat]) => [OX + (lon - LON0) * PX_LON, OY + (LAT0 - lat) * PX_LAT]
const f = (n) => n.toFixed(1)

function kurva(pts, tutup, k = 0.15) {
  const n = pts.length
  const at = (i) => (tutup ? pts[(i + n) % n] : pts[Math.min(n - 1, Math.max(0, i))])
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  const sampai = tutup ? n : n - 1
  for (let i = 0; i < sampai; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k]
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k]
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return tutup ? `${d}Z` : d
}
const garis = (ll, k) => kurva(ll.map(P), false, k)

const BENTUK = kurva(BATAS.map(P), true, 0.14)

// garis pemisah kecamatan (ilustrasi)
const PEMISAH = [
  [[106.7625, -6.5995], [106.772, -6.6015], [106.782, -6.6035], [106.7905, -6.6005], [106.794, -6.59]],
  [[106.7725, -6.612], [106.79, -6.6235], [106.803, -6.6275], [106.8185, -6.6215], [106.8265, -6.6135]],
  [[106.803, -6.6275], [106.805, -6.612], [106.8095, -6.6], [106.8135, -6.589]],
  [[106.794, -6.59], [106.803, -6.5925], [106.8135, -6.589], [106.8215, -6.5945]],
  [[106.794, -6.59], [106.7955, -6.575], [106.799, -6.558], [106.8045, -6.5395]],
  [[106.7455, -6.5765], [106.757, -6.5775], [106.768, -6.5725], [106.779, -6.5745], [106.788, -6.5835], [106.794, -6.59]],
]

const CILIWUNG = [[106.8055, -6.67], [106.804, -6.642], [106.8015, -6.618], [106.7985, -6.604], [106.7945, -6.5965], [106.7935, -6.5845], [106.7965, -6.57], [106.804, -6.554], [106.812, -6.537]]
const CISADANE = [[106.765, -6.52], [106.761, -6.545], [106.764, -6.565], [106.77, -6.59], [106.7745, -6.615], [106.78, -6.635]]
const JALUR = [[106.8085, -6.6085], [106.804, -6.6045], [106.7985, -6.603], [106.792, -6.6005], [106.7895, -6.5945], [106.7905, -6.58], [106.7955, -6.564], [106.801, -6.55]]

// label kecamatan dua baris (rapat) agar muat di wilayah sempit & tidak menabrak elemen lain
const KECAMATAN = [
  { baris: ['BOGOR', 'UTARA'], pos: [106.8105, -6.5635] },
  { baris: ['TANAH', 'SAREAL'], pos: [106.7765, -6.5535] },
  { baris: ['BOGOR', 'BARAT'], pos: [106.7625, -6.5865] },
  { baris: ['BOGOR', 'TENGAH'], pos: [106.7845, -6.6135] },
  { baris: ['BOGOR', 'TIMUR'], pos: [106.8165, -6.6105] },
  { baris: ['BOGOR', 'SELATAN'], pos: [106.8, -6.6485] },
]

const FONT = "'Google Sans Flex', 'Inter', sans-serif"

function Pohon({ x, y, s = 1, warna = '#3FAE86' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-2" y="-2" width="4" height="9" rx="1" fill="#2F6B4F" />
      <path d="M0 -34 L11 -14 H-11 Z" fill={warna} />
      <path d="M0 -24 L14 0 H-14 Z" fill={warna} />
      <path d="M0 -24 L14 0 H0 Z" fill="#000" opacity=".1" />
    </g>
  )
}

// Pin oranye; label (pill gelap) di atas pin, tidak menutupi kepala pin.
function Pin({ x, y, label }) {
  const w = label.length * 7.2 + 24
  return (
    <g transform={`translate(${x} ${y})`} className="cursor-pointer transition-transform duration-300 hover:scale-110" style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.25))' }}>
      {/* Radar beacon pulsing circle */}
      <circle cx="0" cy="0" r="6" fill="#FFAB2E" opacity="0.6">
        <animate attributeName="r" values="5;22;28" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.25;0" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="0" cy="0" r="3.5" fill="#FFAB2E" />
      <path d="M0 0 L-8 -19 A11.5 11.5 0 1 1 8 -19 Z" fill="#FFAB2E" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="0" cy="-26" r="5" fill="#fff" />
      <circle cx="0" cy="-26" r="2.2" fill="#FFAB2E" />
      <rect x={-w / 2} y="-62" width={w} height="22" rx="11" fill="#151E2C" />
      <text x="0" y="-47.2" textAnchor="middle" fontFamily={FONT} fontSize="12" fontWeight="700" fill="#fff">
        {label}
      </text>
    </g>
  )
}

// Halte bus; label (pill putih) bisa di sisi 'kiri' | 'kanan' | 'bawah' | 'atas'.
function Halte({ x, y, label, sisi = 'kanan' }) {
  const w = label ? label.length * 6.7 + 22 : 0
  const pos = {
    kanan: [24, -11],
    kiri: [-24 - w, -11],
    bawah: [-w / 2, 20],
    atas: [-w / 2, -42],
  }[sisi]
  return (
    <g transform={`translate(${x} ${y})`} className="cursor-pointer transition-transform duration-300 hover:scale-110">
      {label && (
        <g style={{ filter: 'drop-shadow(0 3px 5px rgba(13,64,79,.2))' }}>
          <rect x={pos[0]} y={pos[1]} width={w} height="22" rx="11" fill="#fff" stroke="#DCE8E8" />
          <text x={pos[0] + w / 2} y={pos[1] + 15} textAnchor="middle" fontFamily={FONT} fontSize="11.5" fontWeight="600" fill="#0D404F">
            {label}
          </text>
        </g>
      )}
      <circle r="12" fill="#1A936F" stroke="#fff" strokeWidth="3.5" style={{ filter: 'drop-shadow(0 3px 5px rgba(13,64,79,.32))' }} />
      <g fill="#fff">
        <rect x="-5.5" y="-5" width="11" height="8.5" rx="2" />
        <circle cx="-2.8" cy="4.8" r="1.5" />
        <circle cx="2.8" cy="4.8" r="1.5" />
      </g>
      <rect x="-4" y="-3.2" width="8" height="3" rx=".8" fill="#1A936F" />
    </g>
  )
}

export default function PetaBogorVektor({ className = '', viewBox = '0 0 778 856', alt = 'Peta Kota Bogor' }) {
  const id = useId().replace(/:/g, '')
  const klip = `klip${id}`
  const bayang = `bayang${id}`
  const sungai = `sungai${id}`

  const raya = P([106.7995, -6.5985])
  const jalur = JALUR.map(P)
  const halte = [
    { p: jalur[0], nama: 'Baranangsiang', sisi: 'bawah' },
    { p: jalur[4], nama: 'Stasiun Bogor', sisi: 'kiri' },
    { p: jalur[6], nama: '', sisi: 'kanan' },
    { p: jalur[7], nama: '', sisi: 'kanan' },
  ]

  return (
    <svg
      role="img"
      aria-label={alt}
      viewBox={viewBox}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      overflow="visible"
      data-reveal
    >
      <defs>
        <clipPath id={klip}>
          <path d={BENTUK} />
        </clipPath>
        <filter id={bayang} x="-15%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="9" stdDeviation="10" floodColor="#0D404F" floodOpacity=".2" />
        </filter>
        <path id={sungai} d={garis(CILIWUNG)} />
      </defs>

          {/* dekorasi latar: pohon dan burung */}
          <g aria-hidden="true">
            <Pohon x={58} y={300} s={1} />
            <Pohon x={90} y={322} s={0.8} warna="#2FA57C" />
            <Pohon x={34} y={332} s={0.7} />
            <Pohon x={690} y={300} s={0.9} />
            <Pohon x={718} y={322} s={0.7} warna="#2FA57C" />
            <Pohon x={168} y={618} s={0.8} />
            <Pohon x={192} y={636} s={0.6} warna="#2FA57C" />

            <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M650 120 q7 -8 14 0 q7 -8 14 0">
                <animateTransform attributeName="transform" type="translate" values="0 0;6 -5;0 0" dur="5s" repeatCount="indefinite" />
              </path>
              <path d="M696 148 q5 -6 10 0 q5 -6 10 0">
                <animateTransform attributeName="transform" type="translate" values="0 0;-5 -4;0 0" dur="6s" repeatCount="indefinite" />
              </path>
            </g>
          </g>

          {/* badan peta: garis luar putih + bayangan */}
          <path d={BENTUK} fill="#fff" stroke="#fff" strokeWidth="10" strokeLinejoin="round" filter={`url(#${bayang})`} />

          <g clipPath={`url(#${klip})`}>
            <path d={BENTUK} fill="#EAF9F0" />
            {PEMISAH.map((ll, i) => (
              <path key={i} d={garis(ll)} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            ))}
            {PEMISAH.map((ll, i) => (
              <path key={`b${i}`} d={garis(ll)} fill="none" stroke="#BCE6D0" strokeWidth="1.3" strokeDasharray="1 6" strokeLinecap="round" />
            ))}
            <path d={garis(CISADANE)} fill="none" stroke="#A7DFF5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d={garis(CILIWUNG)} fill="none" stroke="#A7DFF5" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            {/* Kebun Raya */}
            <ellipse cx={raya[0]} cy={raya[1]} rx="26" ry="19" fill="#9BE3B5" />
            <g fill="#4FBF86">
              <circle cx={raya[0] - 10} cy={raya[1] - 3} r="6" />
              <circle cx={raya[0] + 3} cy={raya[1] - 8} r="7" />
              <circle cx={raya[0] + 13} cy={raya[1] + 3} r="6" />
              <circle cx={raya[0] - 3} cy={raya[1] + 7} r="6" />
            </g>
            {/* pita tepi */}
            <path d={BENTUK} fill="none" stroke="#3CC0B0" strokeWidth="22" strokeLinejoin="round" />
          </g>

          {/* nama sungai */}
          <text fontFamily={FONT} fontSize="10.5" fontStyle="italic" fill="#4FA3C9" aria-hidden="true">
            <textPath href={`#${sungai}`} startOffset="40%">Sungai Ciliwung</textPath>
          </text>

          {/* nama kecamatan (dua baris) */}
          <g aria-hidden="true" fontFamily={FONT} fontWeight="700" textAnchor="middle" fill="#0D404F" opacity=".48" letterSpacing="1.2" fontSize="12.5">
            {KECAMATAN.map((k) => {
              const [x, y] = P(k.pos)
              return (
                <text key={k.baris.join('')} x={x} y={y}>
                  <tspan x={x} dy="0">{k.baris[0]}</tspan>
                  <tspan x={x} dy="15">{k.baris[1]}</tspan>
                </text>
              )
            })}
          </g>

          {/* contoh jalur angkot + halte + pin */}
          <g aria-hidden="true">
            <path d={kurva(jalur, false)} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            <path d={kurva(jalur, false)} fill="none" stroke="#1A936F" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            {/* Animasi pulsa aliran jalur angkot bercahaya */}
            <path
              d={kurva(jalur, false)}
              fill="none"
              stroke="#6EE7B7"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="14 26"
              style={{
                animation: 'routeFlow 2.6s linear infinite',
              }}
            />
        {halte.map((h, i) => (
          <Halte key={i} x={h.p[0]} y={h.p[1]} label={h.nama} sisi={h.sisi} />
        ))}
        <Pin x={raya[0] + 6} y={raya[1] - 14} label="Kebun Raya" />
      </g>
    </svg>
  )
}
