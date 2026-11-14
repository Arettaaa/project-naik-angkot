import useTema from '../hooks/useTema'

const Matahari = ({ className = 'h-3.5 w-3.5' }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

const Bulan = ({ className = 'h-3.5 w-3.5' }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
)

// Saklar tema. variant="saklar": saklar geser (matahari ⇄ bulan); variant="ikon": tombol bulat (hemat ruang di HP).
// Warna memakai inline style supaya tidak ikut tertimpa aturan tema gelap.
export default function TombolTema({ variant = 'saklar', ukuran = 'md', className = '' }) {
  const [tema, ganti] = useTema()
  const gelap = tema === 'dark'
  const label = gelap ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'

  if (variant === 'ikon') {
    return (
      <button
        type="button"
        onClick={ganti}
        aria-label={label}
        title={label}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${className}`}
        style={{ backgroundColor: gelap ? '#14311C' : '#FFF1C9', color: gelap ? '#D3E8A0' : '#B7791F', boxShadow: gelap ? 'inset 0 0 0 1px rgba(107,168,62,0.4)' : 'none' }}
      >
        {gelap ? <Bulan className="h-5 w-5" /> : <Matahari className="h-5 w-5" />}
      </button>
    )
  }

  const kecil = ukuran === 'sm'
  const lebar = kecil ? 52 : 60
  const tinggi = kecil ? 28 : 32
  const bulat = tinggi - 6
  const geser = lebar - bulat - 6

  return (
    <button
      type="button"
      role="switch"
      aria-checked={gelap}
      aria-label={label}
      title={label}
      onClick={ganti}
      className={`relative inline-flex shrink-0 cursor-pointer items-center rounded-full outline-offset-2 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-[#1A936F] ${className}`}
      style={{
        width: lebar,
        height: tinggi,
        backgroundColor: gelap ? '#14311C' : '#FFF1C9',
        boxShadow: `inset 0 0 0 1px ${gelap ? 'rgba(107,168,62,0.45)' : '#F3DFAC'}`,
      }}
    >
      {/* ikon samar di dua ujung: pengguna paham ini pilihan terang/gelap */}
      <span aria-hidden="true" className="absolute left-[7px] transition-opacity duration-300" style={{ color: '#B7791F', opacity: gelap ? 0.55 : 0 }}>
        <Matahari className={kecil ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </span>
      <span aria-hidden="true" className="absolute right-[7px] transition-opacity duration-300" style={{ color: '#6BA83E', opacity: gelap ? 0 : 0.7 }}>
        <Bulan className={kecil ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </span>
      <span
        aria-hidden="true"
        className="absolute top-[3px] left-[3px] flex items-center justify-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-all duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]"
        style={{
          width: bulat,
          height: bulat,
          transform: `translateX(${gelap ? geser : 0}px) rotate(${gelap ? 360 : 0}deg)`,
          backgroundColor: gelap ? '#D3E8A0' : '#FFB020',
          color: gelap ? '#14311C' : '#FFFFFF',
        }}
      >
        {gelap ? <Bulan className={kecil ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> : <Matahari className={kecil ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      </span>
    </button>
  )
}

