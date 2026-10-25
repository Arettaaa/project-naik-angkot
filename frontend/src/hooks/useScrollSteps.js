import { useCallback, useEffect, useState } from 'react'

function getReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function useScrollSteps(sectionRef, stepsRef, stepCount) {
  const [visibleCount, setVisibleCount] = useState(getReducedMotion() ? stepCount : 0)

  const revealThrough = useCallback((index) => {
    setVisibleCount((current) => Math.max(current, index + 1))
  }, [])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = (event) => {
      if (event.matches) setVisibleCount(stepCount)
    }
    motionQuery.addEventListener('change', onMotionChange)

    let animationFrame = 0
    let thresholds = []
    let observer

    const updateDesktopVisibility = () => {
      const scrollY = window.scrollY
      let reached = -1
      thresholds.forEach((threshold, index) => {
        if (scrollY >= threshold) reached = index
      })
      if (reached >= 0) revealThrough(reached)
    }

    const scheduleDesktopUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0
        updateDesktopVisibility()
      })
    }

    const refresh = () => {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        observer?.disconnect()
        observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const index = stepsRef.current.indexOf(entry.target)
            if (index >= 0) revealThrough(index)
            observer.unobserve(entry.target)
          })
        }, { threshold: 0.2 })
        stepsRef.current.forEach((step) => {
          if (step) observer.observe(step)
        })
        return
      }

      observer?.disconnect()
      let previousThreshold = Number.NEGATIVE_INFINITY
      thresholds = stepsRef.current.map((step) => {
        if (!step) return Number.POSITIVE_INFINITY
        const transform = getComputedStyle(step).transform
        const translationY = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
        const documentTop = step.getBoundingClientRect().top + window.scrollY - translationY
        const threshold = Math.max(
          documentTop - window.innerHeight * 0.85,
          previousThreshold + window.innerHeight * 0.22,
        )
        previousThreshold = threshold
        return threshold
      })
      scheduleDesktopUpdate()
    }

    const resizeObserver = new ResizeObserver(refresh)
    if (sectionRef.current) resizeObserver.observe(sectionRef.current)
    stepsRef.current.forEach((step) => {
      if (step) resizeObserver.observe(step)
    })

    window.addEventListener('scroll', scheduleDesktopUpdate, { passive: true })
    window.addEventListener('resize', refresh, { passive: true })
    window.addEventListener('load', refresh, { once: true })
    document.fonts?.ready.then(refresh)
    document.fonts?.addEventListener?.('loadingdone', refresh)
    const fallbackTimer = window.setTimeout(() => setVisibleCount(stepCount), 8000)
    refresh()

    return () => {
      motionQuery.removeEventListener('change', onMotionChange)
      window.removeEventListener('scroll', scheduleDesktopUpdate)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('load', refresh)
      document.fonts?.removeEventListener?.('loadingdone', refresh)
      resizeObserver.disconnect()
      observer?.disconnect()
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(fallbackTimer)
    }
  }, [revealThrough, sectionRef, stepCount, stepsRef])

  return visibleCount
}
