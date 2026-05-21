/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forceSafariReflow,
  getBrowserClass,
  getIOSVersion,
  getSafariVersion,
  hasNotch,
  initBrowserDetection,
  isChromium,
  isFirefox,
  isIOS,
  isMobileSafari,
  isSafari,
  isStandalone,
  SAFARI_FEATURES,
  safariSupportsFeature,
} from '@/lib/browser-detect'

const USER_AGENTS = {
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  macSafari14:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
  iPhoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  iPadSafari:
    'Mozilla/5.0 (iPad; CPU OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1',
  chrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
}

const setUserAgent = (ua: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  })
}

describe('browser-detect', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.className = ''
    delete (window as any).MSStream
  })

  describe('isSafari', () => {
    it('returns true for macOS Safari', () => {
      setUserAgent(USER_AGENTS.macSafari)
      expect(isSafari()).toBe(true)
    })

    it('returns true for iPhone Safari', () => {
      setUserAgent(USER_AGENTS.iPhoneSafari)
      expect(isSafari()).toBe(true)
    })

    it('returns false for Chrome', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(isSafari()).toBe(false)
    })

    it('returns false for Firefox', () => {
      setUserAgent(USER_AGENTS.firefox)
      expect(isSafari()).toBe(false)
    })

    it('returns false for Android Chrome (which contains "Safari" but also "android")', () => {
      setUserAgent(USER_AGENTS.androidChrome)
      expect(isSafari()).toBe(false)
    })
  })

  describe('isIOS', () => {
    it('returns true for iPhone', () => {
      setUserAgent(USER_AGENTS.iPhoneSafari)
      expect(isIOS()).toBe(true)
    })

    it('returns true for iPad', () => {
      setUserAgent(USER_AGENTS.iPadSafari)
      expect(isIOS()).toBe(true)
    })

    it('returns false for macOS Safari', () => {
      setUserAgent(USER_AGENTS.macSafari)
      expect(isIOS()).toBe(false)
    })

    it('returns false when MSStream is defined (IE mobile)', () => {
      setUserAgent(USER_AGENTS.iPhoneSafari)
      ;(window as any).MSStream = {}
      expect(isIOS()).toBe(false)
    })

    it('returns false for Chrome desktop', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(isIOS()).toBe(false)
    })
  })

  describe('isMobileSafari', () => {
    it('returns true for iPhone Safari', () => {
      setUserAgent(USER_AGENTS.iPhoneSafari)
      expect(isMobileSafari()).toBe(true)
    })

    it('returns false for macOS Safari (Safari but not iOS)', () => {
      setUserAgent(USER_AGENTS.macSafari)
      expect(isMobileSafari()).toBe(false)
    })

    it('returns false for Chrome', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(isMobileSafari()).toBe(false)
    })
  })

  describe('getSafariVersion', () => {
    it('parses Safari 17 version from UA', () => {
      setUserAgent(USER_AGENTS.macSafari)
      expect(getSafariVersion()).toBe(17)
    })

    it('parses Safari 14 version from UA', () => {
      setUserAgent(USER_AGENTS.macSafari14)
      expect(getSafariVersion()).toBe(14)
    })

    it('returns null for non-Safari browsers', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(getSafariVersion()).toBeNull()
    })
  })

  describe('getIOSVersion', () => {
    it('parses iOS 17 version from iPhone UA', () => {
      setUserAgent(USER_AGENTS.iPhoneSafari)
      expect(getIOSVersion()).toBe(17)
    })

    it('parses iOS 16 version from iPad UA', () => {
      setUserAgent(USER_AGENTS.iPadSafari)
      expect(getIOSVersion()).toBe(16)
    })

    it('returns null for non-iOS browsers', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(getIOSVersion()).toBeNull()
    })
  })

  describe('safariSupportsFeature', () => {
    it('returns true for non-Safari browsers (assumed supported)', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(safariSupportsFeature('gap')).toBe(true)
      expect(safariSupportsFeature('hasSelector')).toBe(true)
    })

    it('returns true when version meets the feature minimum', () => {
      setUserAgent(USER_AGENTS.macSafari) // version 17
      expect(safariSupportsFeature('gap')).toBe(true)
      expect(safariSupportsFeature('hasSelector')).toBe(true)
      expect(safariSupportsFeature('containerQueries')).toBe(true)
    })

    it('returns false when version is below the feature minimum', () => {
      setUserAgent(USER_AGENTS.macSafari14) // version 14
      expect(safariSupportsFeature('hasSelector')).toBe(false)
      expect(safariSupportsFeature('cssNesting')).toBe(false)
    })

    it('exposes a numeric minimum for each known feature', () => {
      for (const key of Object.keys(SAFARI_FEATURES) as Array<keyof typeof SAFARI_FEATURES>) {
        expect(typeof SAFARI_FEATURES[key]).toBe('number')
      }
    })
  })

  describe('isChromium', () => {
    it('returns true for real Chrome (UA contains Safari compat token)', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(isChromium()).toBe(true)
    })

    it('returns true for real Edge (UA contains Safari + Edg tokens)', () => {
      setUserAgent(USER_AGENTS.edge)
      expect(isChromium()).toBe(true)
    })

    it('returns true for Android Chrome', () => {
      setUserAgent(USER_AGENTS.androidChrome)
      expect(isChromium()).toBe(true)
    })

    it('returns false for macOS Safari', () => {
      setUserAgent(USER_AGENTS.macSafari)
      expect(isChromium()).toBe(false)
    })

    it('returns false for Firefox', () => {
      setUserAgent(USER_AGENTS.firefox)
      expect(isChromium()).toBe(false)
    })
  })

  describe('isFirefox', () => {
    it('returns true for Firefox', () => {
      setUserAgent(USER_AGENTS.firefox)
      expect(isFirefox()).toBe(true)
    })

    it('returns false for Chrome', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(isFirefox()).toBe(false)
    })

    it('returns false for Safari', () => {
      setUserAgent(USER_AGENTS.macSafari)
      expect(isFirefox()).toBe(false)
    })
  })

  describe('getBrowserClass', () => {
    it('returns "mobile-safari" for iPhone Safari', () => {
      setUserAgent(USER_AGENTS.iPhoneSafari)
      expect(getBrowserClass()).toBe('mobile-safari')
    })

    it('returns "safari" for macOS Safari', () => {
      setUserAgent(USER_AGENTS.macSafari)
      expect(getBrowserClass()).toBe('safari')
    })

    it('returns "chromium" for Chrome', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(getBrowserClass()).toBe('chromium')
    })

    it('returns "chromium" for Edge', () => {
      setUserAgent(USER_AGENTS.edge)
      expect(getBrowserClass()).toBe('chromium')
    })

    it('returns "firefox" for Firefox', () => {
      setUserAgent(USER_AGENTS.firefox)
      expect(getBrowserClass()).toBe('firefox')
    })
  })

  describe('initBrowserDetection', () => {
    it('adds the browser class to the document element', () => {
      setUserAgent(USER_AGENTS.chrome)
      initBrowserDetection()
      expect(document.documentElement.classList.contains('chromium')).toBe(true)
    })

    it('adds both safari and safari-version classes when on Safari', () => {
      setUserAgent(USER_AGENTS.macSafari)
      initBrowserDetection()
      expect(document.documentElement.classList.contains('safari')).toBe(true)
      expect(document.documentElement.classList.contains('safari-17')).toBe(true)
    })

    it('adds ios-version class on iOS', () => {
      setUserAgent(USER_AGENTS.iPhoneSafari)
      initBrowserDetection()
      expect(document.documentElement.classList.contains('mobile-safari')).toBe(true)
      expect(document.documentElement.classList.contains('ios-17')).toBe(true)
    })
  })

  describe('forceSafariReflow', () => {
    it('does nothing when not Safari', () => {
      setUserAgent(USER_AGENTS.chrome)
      const el = document.createElement('div')
      el.style.display = 'block'
      forceSafariReflow(el)
      // Display should remain unchanged (or at least not be forced)
      expect(el.style.display).toBe('block')
    })

    it('toggles display on Safari to force a reflow', () => {
      setUserAgent(USER_AGENTS.macSafari)
      const el = document.createElement('div')
      el.style.display = 'block'
      forceSafariReflow(el)
      // After reflow trick, display has been reset to empty string
      expect(el.style.display).toBe('')
    })
  })

  describe('hasNotch', () => {
    it('returns false when not iOS', () => {
      setUserAgent(USER_AGENTS.chrome)
      expect(hasNotch()).toBe(false)
    })
  })

  describe('isStandalone', () => {
    beforeEach(() => {
      // jsdom defines matchMedia only when needed
      if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          value: vi.fn().mockReturnValue({ matches: false }),
        })
      }
    })

    it('returns true when navigator.standalone is true (iOS PWA)', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: true,
        configurable: true,
      })
      expect(isStandalone()).toBe(true)
    })

    it('returns true when display-mode standalone matches', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: false,
        configurable: true,
      })
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn().mockReturnValue({ matches: true }),
      })
      expect(isStandalone()).toBe(true)
    })

    it('returns false when neither indicator is present', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: false,
        configurable: true,
      })
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn().mockReturnValue({ matches: false }),
      })
      expect(isStandalone()).toBe(false)
    })
  })
})
