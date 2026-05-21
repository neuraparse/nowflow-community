'use client'

import { type RefObject, useEffect } from 'react'

/**
 * Activates browser GPU compositing layer on the ReactFlow viewport only during
 * active interactions (pan/zoom/drag). Static state skips will-change to
 * prevent pixelation artefacts from permanent GPU layer promotion.
 */
export function useGpuOptimization(flowWrapperRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const wrapper = flowWrapperRef.current
    if (!wrapper) return

    let wheelEndTimer: ReturnType<typeof setTimeout> | null = null

    const enable = () => {
      const vp = wrapper.querySelector<HTMLElement>('.react-flow__viewport')
      if (vp) vp.style.willChange = 'transform'
    }
    const disable = () => {
      const vp = wrapper.querySelector<HTMLElement>('.react-flow__viewport')
      if (vp) vp.style.willChange = 'auto'
    }
    const onWheel = () => {
      enable()
      if (wheelEndTimer) clearTimeout(wheelEndTimer)
      wheelEndTimer = setTimeout(disable, 150)
    }

    wrapper.addEventListener('mousedown', enable, { passive: true })
    wrapper.addEventListener('touchstart', enable, { passive: true })
    wrapper.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('mouseup', disable, { passive: true })
    window.addEventListener('touchend', disable, { passive: true })

    return () => {
      wrapper.removeEventListener('mousedown', enable)
      wrapper.removeEventListener('touchstart', enable)
      wrapper.removeEventListener('wheel', onWheel)
      window.removeEventListener('mouseup', disable)
      window.removeEventListener('touchend', disable)
      if (wheelEndTimer) clearTimeout(wheelEndTimer)
    }
  }, [flowWrapperRef])
}
