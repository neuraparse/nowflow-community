/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useBrowserInfo,
  useHasNotch,
  useIsStandalone,
  useSafariReflow,
  useSafariRenderFix,
  useSafariSafeUpdate,
  useViewportHeight,
} from '@/hooks/use-safari-fix'

const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FIREFOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'

const setUserAgent = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => ua,
  })
}

const originalUA = navigator.userAgent

describe('use-safari-fix hooks', () => {
  afterEach(() => {
    setUserAgent(originalUA)
    vi.restoreAllMocks()
  })

  describe('useSafariReflow', () => {
    it('returns a ref object', () => {
      setUserAgent(CHROME_UA)
      const { result } = renderHook(() => useSafariReflow<HTMLDivElement>([]))
      expect(result.current).toEqual({ current: null })
    })

    it('does not throw when no element is attached regardless of browser', () => {
      setUserAgent(SAFARI_UA)
      expect(() => {
        renderHook(() => useSafariReflow<HTMLDivElement>([1, 2]))
      }).not.toThrow()
    })
  })

  describe('useBrowserInfo', () => {
    it('detects Safari user agent', () => {
      setUserAgent(SAFARI_UA)
      const { result } = renderHook(() => useBrowserInfo())

      expect(result.current.isSafari).toBe(true)
      expect(result.current.isChromium).toBe(false)
      expect(result.current.isFirefox).toBe(false)
      expect(result.current.safariVersion).toBe(17)
    })

    it('detects Chromium user agent', () => {
      setUserAgent(CHROME_UA)
      const { result } = renderHook(() => useBrowserInfo())

      expect(result.current.isSafari).toBe(false)
      expect(result.current.isChromium).toBe(true)
      expect(result.current.isFirefox).toBe(false)
    })

    it('detects Firefox user agent', () => {
      setUserAgent(FIREFOX_UA)
      const { result } = renderHook(() => useBrowserInfo())

      expect(result.current.isSafari).toBe(false)
      expect(result.current.isChromium).toBe(false)
      expect(result.current.isFirefox).toBe(true)
    })

    it('detects iOS Safari', () => {
      setUserAgent(IOS_SAFARI_UA)
      const { result } = renderHook(() => useBrowserInfo())

      expect(result.current.isSafari).toBe(true)
      expect(result.current.isIOS).toBe(true)
    })
  })

  describe('useSafariRenderFix', () => {
    it('increments the render key when dependency changes on Safari', () => {
      setUserAgent(SAFARI_UA)
      const { result, rerender } = renderHook(({ dep }) => useSafariRenderFix(dep), {
        initialProps: { dep: 'a' },
      })

      const initial = result.current
      rerender({ dep: 'b' })
      expect(result.current).toBeGreaterThan(initial)
    })

    it('does not increment the render key on non-Safari browsers', () => {
      setUserAgent(CHROME_UA)
      const { result, rerender } = renderHook(({ dep }) => useSafariRenderFix(dep), {
        initialProps: { dep: 'a' },
      })

      const initial = result.current
      rerender({ dep: 'b' })
      expect(result.current).toBe(initial)
    })
  })

  describe('useHasNotch', () => {
    it('returns false on non-iOS browsers', () => {
      setUserAgent(CHROME_UA)
      const { result } = renderHook(() => useHasNotch())
      expect(result.current).toBe(false)
    })

    it('does not throw on iOS even when safe-area env is unsupported', () => {
      setUserAgent(IOS_SAFARI_UA)
      expect(() => renderHook(() => useHasNotch())).not.toThrow()
    })
  })

  describe('useIsStandalone', () => {
    const setMatchMedia = (matches: boolean) => {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches,
          media: query,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onchange: null,
        })),
      })
    }

    it('returns false when not in standalone display mode', () => {
      setUserAgent(CHROME_UA)
      setMatchMedia(false)

      const { result } = renderHook(() => useIsStandalone())
      expect(result.current).toBe(false)
    })

    it('returns true when display-mode matches standalone', () => {
      setUserAgent(CHROME_UA)
      setMatchMedia(true)

      const { result } = renderHook(() => useIsStandalone())
      expect(result.current).toBe(true)
    })
  })

  describe('useSafariSafeUpdate', () => {
    it('calls the callback synchronously on non-Safari browsers', () => {
      setUserAgent(CHROME_UA)
      const { result } = renderHook(() => useSafariSafeUpdate())
      const cb = vi.fn()

      act(() => {
        result.current(cb)
      })

      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('defers the callback via setTimeout on Safari', () => {
      setUserAgent(SAFARI_UA)
      vi.useFakeTimers()
      try {
        const { result } = renderHook(() => useSafariSafeUpdate())
        const cb = vi.fn()

        act(() => {
          result.current(cb)
        })

        expect(cb).not.toHaveBeenCalled()

        act(() => {
          vi.advanceTimersByTime(0)
        })

        expect(cb).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('useViewportHeight', () => {
    it('returns the current window.innerHeight', () => {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 844,
      })

      const { result } = renderHook(() => useViewportHeight())
      expect(result.current).toBe(844)
    })

    it('updates when a resize event fires', () => {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 600,
      })

      const { result } = renderHook(() => useViewportHeight())
      expect(result.current).toBe(600)

      act(() => {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: 900,
        })
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current).toBe(900)
    })
  })
})
