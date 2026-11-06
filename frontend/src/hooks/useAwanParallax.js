import { useEffect } from 'react'

// Awan muncul & naik halus seiring scroll. --awan-p bergerak 1 -> 0 (1 = awan rendah & transparan,
// 0 = posisi akhir). Nilainya di-"lerp" tiap frame supaya geraknya mengalir (tidak patah-patah saat scroll mouse).
export default function useAwanParallax(sectionRef, layerRef, akhir = 0.2) {
  useEffect(() => {
    const section = sectionRef.current
    const layer = layerRef.current
    if (!section || !layer) return

    const diam = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (diam.matches) {
      layer.style.setProperty('--awan-p', '0')
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
      layer.style.setProperty('--awan-p', sekarang.toFixed(4))
      frame = sekarang === target ? 0 : window.requestAnimationFrame(jalan)
    }
    const mulai = () => {
      if (!frame) frame = window.requestAnimationFrame(jalan)
    }

    mulai()
    window.addEventListener('scroll', mulai, { passive: true })
    window.addEventListener('resize', mulai, { passive: true })
    return () => {
      window.removeEventListener('scroll', mulai)
      window.removeEventListener('resize', mulai)
      window.cancelAnimationFrame(frame)
    }
  }, [sectionRef, layerRef, akhir])
}
