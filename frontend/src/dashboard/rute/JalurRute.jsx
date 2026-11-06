// Timeline "Jalur Rute" (urutan halte/jalan). Klik satu nama -> peta terbang ke titiknya & popup terbuka.
export default function JalurRute({ halte, onPilih }) {
  return (
    <ol className="mt-3">
      {halte.map((h, i) => {
        const ujung = i === 0 || i === halte.length - 1
        return (
          <li key={i} className="relative pb-1 last:pb-0">
            {i < halte.length - 1 && <span className="absolute top-4 left-[6px] h-full w-0.5 bg-primary/70" />}
            <button
              type="button"
              onClick={() => onPilih?.(i)}
              className="relative flex w-full cursor-pointer gap-3 rounded-lg py-1.5 text-left transition hover:bg-[#F3F6F6]"
              title="Lihat di peta"
            >
              <span className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-primary ${ujung ? 'bg-primary' : 'bg-white'}`} />
              <span className="text-[14px] text-dark">{h}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
