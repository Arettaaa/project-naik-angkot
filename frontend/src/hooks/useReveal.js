import { useEffect } from 'react'

// Animasi muncul saat discroll, hanya untuk elemen yang ditandai `data-muncul` (nilainya = urutan, untuk jeda bertahap).
// Memakai transisi CSS opacity + transform (diproses GPU), tiap elemen dianimasikan sekali saja.
export default function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const els = [...root.querySelectorAll('[data-muncul]')]
    els.forEach((el) => {
      el.classList.add('muncul-siap')
      el.style.transitionDelay = `${Math.min(Number(el.dataset.muncul) || 0, 6) * 90}ms`
    })

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          io.unobserve(e.target)
          e.target.classList.add('muncul')
          e.target.addEventListener('transitionend', () => e.target.classList.add('muncul-selesai'), { once: true })
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))

    return () => {
      io.disconnect()
      els.forEach((el) => el.classList.remove('muncul-siap', 'muncul', 'muncul-selesai'))
    }
  }, [rootRef])
}
