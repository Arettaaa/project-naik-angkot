import { useEffect } from 'react'

// animasi muncul per section saat discorl.
export default function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const SKIP = '.cara-kerja-step, .leaflet-container, .hero-illustration, [aria-hidden="true"], nav'
    const sections = [...root.querySelectorAll('section')].filter((s) => !s.parentElement?.closest('section'))
    const grup = new Map()

    sections.forEach((sec) => {
      const els = [...sec.querySelectorAll('h1, h2, p, a, button, img, [data-reveal]')].filter(
        (el) => !el.closest(SKIP) && !el.parentElement.closest('h1, h2, p, a, button') && el.offsetParent !== null,
      )
      els.forEach((el) => (el.style.opacity = '0'))
      grup.set(sec, els)
    })

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          io.unobserve(e.target)
          ;(grup.get(e.target) ?? []).forEach((el, i) => {
            const delay = Math.min(i, 8) * 90
            const gambar = el.tagName === 'IMG'
            el.style.opacity = ''
            el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay, easing: 'ease-out', fill: 'backwards' })
            el.animate(
              [{ transform: gambar ? 'scale(0.9)' : `translateY(${el.tagName === 'H2' || el.tagName === 'H1' ? 36 : 24}px)` }, { transform: 'none' }],
              { duration: 800, delay, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards', composite: 'add' },
            )
          })
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    sections.forEach((s) => io.observe(s))

    return () => {
      io.disconnect()
      grup.forEach((els) => els.forEach((el) => (el.style.opacity = '')))
    }
  }, [rootRef])
}