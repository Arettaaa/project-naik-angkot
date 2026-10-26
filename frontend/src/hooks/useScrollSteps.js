import { useEffect, useReducer, useRef } from 'react'

function getReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function reducer(state, action) {
  switch (action.type) {
    case 'reveal':
      return { ...state, visibleCount: Math.min(state.visibleCount + 1, action.count) }
    case 'reveal-all':
      return { visibleCount: action.count, isResetting: false }
    case 'reset':
      return { visibleCount: 0, isResetting: true }
    case 'reset-complete':
      return { ...state, isResetting: false }
    default:
      return state
  }
}

export default function useScrollSteps(sectionRef, stepsRef, stepCount) {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    visibleCount: getReducedMotion() ? stepCount : 0,
    isResetting: false,
  }))
  const visibleCountRef = useRef(state.visibleCount)

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0
    let thresholds = []
    let stepObserver
    let sectionInRange = false
    let sectionBounds = { top: 0, bottom: 0 }
    let disposed = false
    let fallbackTimer = 0
    let revealTimer = 0
    let resetFrame = 0
    let targetCount = visibleCountRef.current

    const clearRevealTimer = () => {
      if (revealTimer) window.clearTimeout(revealTimer)
      revealTimer = 0
    }

    const revealNext = () => {
      revealTimer = 0
      if (visibleCountRef.current >= targetCount || motionQuery.matches) return

      visibleCountRef.current += 1
      dispatch({ type: 'reveal', count: targetCount })
      if (visibleCountRef.current >= stepCount) {
        window.clearTimeout(fallbackTimer)
        fallbackTimer = 0
      }
      if (visibleCountRef.current < targetCount) {
        revealTimer = window.setTimeout(revealNext, 180)
      }
    }

    const revealThrough = (index) => {
      targetCount = Math.max(targetCount, Math.min(index + 1, stepCount))
      if (motionQuery.matches) {
        visibleCountRef.current = stepCount
        clearRevealTimer()
        window.clearTimeout(fallbackTimer)
        fallbackTimer = 0
        dispatch({ type: 'reveal-all', count: stepCount })
      } else {
        if (targetCount >= stepCount) {
          window.clearTimeout(fallbackTimer)
          fallbackTimer = 0
        }
        if (!revealTimer && visibleCountRef.current < targetCount) revealNext()
      }
    }

    const resetSteps = () => {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = 0
      clearRevealTimer()
      if (motionQuery.matches) {
        targetCount = stepCount
        visibleCountRef.current = stepCount
        dispatch({ type: 'reveal-all', count: stepCount })
        return
      }

      targetCount = 0
      visibleCountRef.current = 0
      dispatch({ type: 'reset' })
      window.cancelAnimationFrame(resetFrame)
      resetFrame = window.requestAnimationFrame(() => {
        resetFrame = 0
        dispatch({ type: 'reset-complete' })
      })
    }

    const updateSectionRange = (inRange) => {
      if (sectionInRange === inRange) return
      sectionInRange = inRange

      if (inRange) {
        fallbackTimer = window.setTimeout(() => revealThrough(stepCount - 1), 3000)
        return
      }

      stepObserver?.disconnect()
      resetSteps()
    }

    const measureSectionBounds = () => {
      if (!sectionRef.current) return

      const sectionRect = sectionRef.current.getBoundingClientRect()
      sectionBounds = {
        top: sectionRect.top + window.scrollY,
        bottom: sectionRect.bottom + window.scrollY,
      }
    }

    const measureDesktopThresholds = () => {
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
    }

    const scheduleScrollUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0
        measureSectionBounds()
        if (!window.matchMedia('(max-width: 1023px)').matches) measureDesktopThresholds()
        const scrollY = window.scrollY
        const inRange = sectionBounds.bottom >= scrollY - 100
          && sectionBounds.top <= scrollY + window.innerHeight + 100
        updateSectionRange(inRange)
        if (!sectionInRange || window.matchMedia('(max-width: 1023px)').matches) return

        let reached = -1
        thresholds.forEach((threshold, index) => {
          if (scrollY >= threshold) reached = index
        })
        if (reached >= 0) revealThrough(reached)
      })
    }

    const refresh = () => {
      measureSectionBounds()

      if (window.matchMedia('(max-width: 1023px)').matches) {
        stepObserver?.disconnect()
        stepObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const index = stepsRef.current.indexOf(entry.target)
            if (index >= 0) revealThrough(index)
            stepObserver.unobserve(entry.target)
          })
        }, { threshold: 0.2 })
        stepsRef.current.forEach((step) => {
          if (step) stepObserver.observe(step)
        })
        return
      }

      stepObserver?.disconnect()
      measureDesktopThresholds()
      scheduleScrollUpdate()
    }

    const onSectionIntersection = () => {
      scheduleScrollUpdate()
    }

    const onMotionChange = (event) => {
      if (event.matches) {
        targetCount = stepCount
        visibleCountRef.current = stepCount
        clearRevealTimer()
        window.clearTimeout(fallbackTimer)
        dispatch({ type: 'reveal-all', count: stepCount })
      }
    }

    const sectionObserver = new IntersectionObserver(onSectionIntersection, {
      rootMargin: '100px 0px 100px 0px',
      threshold: 0,
    })
    if (sectionRef.current) sectionObserver.observe(sectionRef.current)

    const resizeObserver = new ResizeObserver(refresh)
    if (sectionRef.current) resizeObserver.observe(sectionRef.current)
    stepsRef.current.forEach((step) => {
      if (step) resizeObserver.observe(step)
    })

    const onScroll = scheduleScrollUpdate
    const onLoad = () => refresh()
    const onFontsReady = () => {
      if (!disposed) refresh()
    }

    motionQuery.addEventListener('change', onMotionChange)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', refresh, { passive: true })
    window.addEventListener('load', onLoad, { once: true })
    document.fonts?.ready.then(onFontsReady)
    document.fonts?.addEventListener?.('loadingdone', onLoad)

    return () => {
      disposed = true
      motionQuery.removeEventListener('change', onMotionChange)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('load', onLoad)
      document.fonts?.removeEventListener?.('loadingdone', onLoad)
      sectionObserver.disconnect()
      resizeObserver.disconnect()
      stepObserver?.disconnect()
      window.cancelAnimationFrame(animationFrame)
      window.cancelAnimationFrame(resetFrame)
      window.clearTimeout(fallbackTimer)
      clearRevealTimer()
    }
  }, [sectionRef, stepCount, stepsRef])

  return state
}
