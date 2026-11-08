import { useEffect, useRef, useState } from 'react'

const STEP_STAGGER_MS = 220
const HYSTERESIS_PX = 36

export default function useScrollSteps(sectionRef, stepRefs, stepCount) {
  const [visibleCount, setVisibleCount] = useState(0)
  const visibleRef = useRef(0)
  const targetRef = useRef(0)
  const lastStepTimeRef = useRef(0)
  const timerRef = useRef(0)

  useEffect(() => {
    let rafId = 0

    const clearStepTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = 0
      }
    }

    const syncTowardTarget = () => {
      clearStepTimer()
      const current = visibleRef.current
      const target = targetRef.current

      if (current === target) return

      if (target < current) {
        visibleRef.current = target
        setVisibleCount(target)
        return
      }

      const now = performance.now()
      const elapsed = now - lastStepTimeRef.current

      if (elapsed >= STEP_STAGGER_MS) {
        const next = current + 1
        visibleRef.current = next
        lastStepTimeRef.current = now
        setVisibleCount(next)

        if (next < targetRef.current) {
          timerRef.current = window.setTimeout(syncTowardTarget, STEP_STAGGER_MS)
        }
      } else {
        timerRef.current = window.setTimeout(syncTowardTarget, STEP_STAGGER_MS - elapsed)
      }
    }

    const computeTargetCount = () => {
      const sectionEl = sectionRef.current
      if (!sectionEl) return 0

      const vh = window.innerHeight || document.documentElement.clientHeight || 800
      const isDesktop = window.innerWidth >= 1024
      const rect = sectionEl.getBoundingClientRect()

      if (rect.top > vh * 0.92) {
        return 0
      }

      if (!isDesktop) {
        let count = 0
        const currentTarget = targetRef.current
        for (let i = 0; i < stepCount; i += 1) {
          const el = stepRefs.current?.[i]
          if (!el) continue
          const stepRect = el.getBoundingClientRect()
          const triggerY = i < currentTarget ? vh * 0.82 + HYSTERESIS_PX : vh * 0.82
          if (stepRect.top <= triggerY) {
            count = i + 1
          }
        }
        return count
      }

      const sectionHeight = Math.max(rect.height, 400)
      const startTop = vh * 0.86 - sectionHeight * 0.48
      const endTop = Math.min(
        startTop - 260,
        Math.max(vh * 0.90 - sectionHeight * 0.82, -sectionHeight * 0.12),
      )
      const totalSpan = Math.max(startTop - endTop, 220)
      const stepSpan = totalSpan / Math.max(stepCount - 1, 1)

      let count = 0
      const currentTarget = targetRef.current
      for (let i = 0; i < stepCount; i += 1) {
        const baseThreshold = startTop - i * stepSpan
        const threshold = i < currentTarget ? baseThreshold + HYSTERESIS_PX : baseThreshold
        if (rect.top <= threshold) {
          count = i + 1
        }
      }

      const docEl = document.documentElement
      if (window.scrollY + vh >= docEl.scrollHeight - 24 && rect.top < vh * 0.5) {
        count = stepCount
      }

      return count
    }

    const handleScrollOrResize = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        const nextTarget = computeTargetCount()
        if (nextTarget !== targetRef.current) {
          targetRef.current = nextTarget
          syncTowardTarget()
        }
      })
    }

    handleScrollOrResize()
    window.addEventListener('scroll', handleScrollOrResize, { passive: true })
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      clearStepTimer()
      window.removeEventListener('scroll', handleScrollOrResize)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [sectionRef, stepRefs, stepCount])

  return visibleCount
}

