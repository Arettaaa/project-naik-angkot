// Timeline "Jalur yang dilewati" (urutan jalan). Klik satu nama -> peta terbang ke titiknya & popup terbuka.
export default function JalurRute({ halte, warna = '#1A936F', onPilih }) {
  return (
    <ol className="mt-2.5">
      {halte.map((h, i) => {
        const ujung = i === 0 || i === halte.length - 1
        return (
          <li key={i} className="relative">
            {i < halte.length - 1 && <span className="absolute top-[18px] left-[13px] h-full w-0.5" style={{ backgroundColor: warna, opacity: 0.55 }} />}
            <button
              type="button"
              onClick={() => onPilih?.(i)}
              className="relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-[#F3F6F6]"
              title="Lihat di peta"
            >
              <span
                className="relative h-3.5 w-3.5 shrink-0 rounded-full border-[3px]"
                style={{ borderColor: warna, backgroundColor: ujung ? warna : '#fff' }}
              />
              <span className={`text-[13.5px] ${ujung ? 'font-semibold text-dark' : 'text-dark/85'}`}>{h}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
