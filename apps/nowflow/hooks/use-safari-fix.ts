'use client'

import { useEffect, useRef, useState } from 'react'
import { forceSafariReflow, getSafariVersion, isIOS, isSafari } from '@/lib/browser-detect'

// Safari-Specific React Hooks — utilities for working around Safari/iOS quirks.

/**
 * Force Safari to reflow when dependencies change
 * Useful for fixing rendering bugs
 *
 * @example
 * const ref = useSafariReflow([isOpen, activeTab])
 * return <div ref={ref}>Content</div>
 */
export function useSafariReflow<T extends HTMLElement>(
  deps: any[] = []
): React.RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!isSafari() || !ref.current) return
    forceSafariReflow(ref.current)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return ref
}

/**
 * Get browser information
 * Updates when browser is detected
 */
export function useBrowserInfo() {
  const [info, setInfo] = useState({
    isSafari: false,
    isIOS: false,
    safariVersion: null as number | null,
    isChromium: false,
    isFirefox: false,
  })

  useEffect(() => {
    setInfo({
      isSafari: isSafari(),
      isIOS: isIOS(),
      safariVersion: getSafariVersion(),
      isChromium: /Chrome|Chromium|Edg/i.test(navigator.userAgent),
      isFirefox: /Firefox/i.test(navigator.userAgent),
    })
  }, [])

  return info
}

/**
 * Force re-render on Safari when props change
 * Fixes React 18 render skip bug on Safari 16.4+
 *
 * @example
 * const key = useSafariRenderFix(criticalProp)
 * return <Component key={key} />
 */
export function useSafariRenderFix(dependency: any): number {
  const [renderKey, setRenderKey] = useState(0)

  useEffect(() => {
    if (!isSafari()) return
    setRenderKey((prev) => prev + 1)
  }, [dependency])

  return renderKey
}

/**
 * Detect if device has a notch (iPhone X and newer)
 */
export function useHasNotch(): boolean {
  const [hasNotch, setHasNotch] = useState(false)

  useEffect(() => {
    if (!isIOS()) return

    const div = document.createElement('div')
    div.style.paddingTop = 'env(safe-area-inset-top)'
    document.body.appendChild(div)
    const hasSafeArea = getComputedStyle(div).paddingTop !== '0px'
    document.body.removeChild(div)

    setHasNotch(hasSafeArea)
  }, [])

  return hasNotch
}

/**
 * Detect if running in standalone mode (PWA)
 */
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    setIsStandalone(
      (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches
    )
  }, [])

  return isStandalone
}

/**
 * Safe DOM manipulation for Safari
 * Wraps DOM operations in setTimeout to avoid WebKit quirks
 *
 * @example
 * const safeUpdate = useSafariSafeUpdate()
 * safeUpdate(() => {
 *   element.scrollIntoView()
 * })
 */
export function useSafariSafeUpdate() {
  return (callback: () => void) => {
    if (isSafari()) {
      setTimeout(callback, 0) // Micro-task queue
    } else {
      callback()
    }
  }
}

/**
 * Detect viewport height changes (useful for mobile Safari URL bar)
 * Returns the current viewport height in pixels
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const updateHeight = () => {
      setHeight(window.innerHeight)
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('orientationchange', updateHeight)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('orientationchange', updateHeight)
    }
  }, [])

  return height
}

/**
 * Prevent iOS Safari zoom on input focus
 * Returns input props to spread on input elements
 *
 * @example
 * const inputProps = usePreventIOSZoom()
 * return <input {...inputProps} type="email" />
 */
export function usePreventIOSZoom() {
  return {
    style: { fontSize: 'max(16px, 1em)' } as React.CSSProperties,
  }
}
