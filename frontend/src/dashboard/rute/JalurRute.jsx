// Timeline "Jalur Rute" (urutan halte/jalan dari daftar trayek).
export default function JalurRute({ halte }) {
  return (
    <ol className="mt-3">
      {halte.map((h, i) => {
        const ujung = i === 0 || i === halte.length - 1
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {i < halte.length - 1 && <span className="absolute top-4 left-[6px] h-full w-0.5 bg-primary/70" />}
            <span className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-primary ${ujung ? 'bg-primary' : 'bg-white'}`} />
            <span className="text-[14px] text-dark">{h}</span>
          </li>
        )
      })}
    </ol>
  )
}