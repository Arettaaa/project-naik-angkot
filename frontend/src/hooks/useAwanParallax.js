import { useEffect } from 'react'

// Lapisan (awan/laut) naik halus seiring scroll. p bergerak 1 -> 0 (1 = posisi rendah, 0 = posisi akhir),
// di-"lerp" tiap frame supaya geraknya mengalir. Jarak geser diambil dari atribut data-geser (mis. "9vw"),
// lalu ditulis langsung ke transform (tanpa variabel CSS) supaya browser tidak menghitung ulang gaya.
export default function useAwanParallax(sectionRef, layerRef, akhir = 0.2) {
  useEffect(() => {
    const section = sectionRef.current
    const layer = layerRef.current
    if (!section || !layer) return

    const diam = window.matchMedia('(prefers-reduced-motion: reduce)')
    const jarak = layer.dataset.geser || '8cqw'
    const tulis = (p) => {
      layer.style.transform = `translate3d(0, calc(${p} * ${jarak}), 0)`
    }
    if (diam.matches) {
      tulis(0)
      return
    }

    let frame = 0
    let sekarang = null
    let target = 1

    const hitungTarget = () => {
      const top = section.getBoundingClientRect().top
      const vh = window.innerHeight
      // mulai saat section baru masuk dari bawah layar, selesai saat puncaknya di ~20% tinggi layar
      const p = (top - vh * akhir) / (vh * (1 - akhir))
      target = Math.min(1, Math.max(0, p))
    }

    const jalan = () => {
      hitungTarget()
      if (sekarang === null) sekarang = target
      sekarang += (target - sekarang) * 0.12
      if (Math.abs(target - sekarang) < 0.001) sekarang = target
      tulis(sekarang.toFixed(4))
      frame = sekarang === target ? 0 : window.requestAnimationFrame(jalan)
    }
    const mulai = () => {
      if (!frame) frame = window.requestAnimationFrame(jalan)
    }

    mulai()
    // hanya dengarkan scroll saat bagian ini dekat layar
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        window.addEventListener('scroll', mulai, { passive: true })
        mulai()
      } else window.removeEventListener('scroll', mulai)
    }, { rootMargin: '30% 0px 30% 0px' })
    io.observe(section)
    window.addEventListener('resize', mulai, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', mulai)
      window.removeEventListener('resize', mulai)
      window.cancelAnimationFrame(frame)
    }
  }, [sectionRef, layerRef, akhir])
}
