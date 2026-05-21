/**
 * Browser Detection Utilities for Safari Compatibility
 *
 * Use these utilities to detect browsers and apply browser-specific fixes.
 * Safari has unique rendering quirks that require special handling.
 */

/**
 * Detect if the current browser is Safari
 */
export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

/**
 * Detect if the current browser is running on iOS (iPhone/iPad)
 */
export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

/**
 * Detect if the current browser is mobile Safari
 */
export const isMobileSafari = (): boolean => {
  return isSafari() && isIOS()
}

/**
 * Get Safari version number
 * Returns null if not Safari or version cannot be determined
 */
export const getSafariVersion = (): number | null => {
  if (!isSafari()) return null
  const match = navigator.userAgent.match(/Version\/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Get iOS version number
 * Returns null if not iOS or version cannot be determined
 */
export const getIOSVersion = (): number | null => {
  if (!isIOS()) return null
  const match = navigator.userAgent.match(/OS (\d+)_/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Check if Safari version supports a specific feature
 */
export const safariSupportsFeature = (feature: keyof typeof SAFARI_FEATURES): boolean => {
  const version = getSafariVersion()
  if (!version) return true // Not Safari, assume supported
  return version >= SAFARI_FEATURES[feature]
}

/**
 * Safari feature support map
 * Keys: feature name, Values: minimum Safari version
 */
export const SAFARI_FEATURES = {
  gap: 14.1, // Flexbox gap support
  cssNesting: 16.4, // Native CSS nesting
  colorMix: 16.4, // color-mix() function
  property: 16.4, // @property support
  containerQueries: 16.0, // Container queries
  hasSelector: 15.4, // :has() selector
} as const

/**
 * Detect if browser is Chrome/Edge (Chromium-based)
 */
export const isChromium = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Chrome\/|Chromium\/|Edg\//i.test(navigator.userAgent)
}

/**
 * Detect if browser is Firefox
 */
export const isFirefox = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Firefox/i.test(navigator.userAgent)
}

/**
 * Get a CSS class for the current browser (for conditional styling)
 */
export const getBrowserClass = (): string => {
  if (isMobileSafari()) return 'mobile-safari'
  if (isSafari()) return 'safari'
  if (isChromium()) return 'chromium'
  if (isFirefox()) return 'firefox'
  return 'unknown-browser'
}

/**
 * Add browser-specific class to document element
 * Call this in your root layout or _app.tsx
 */
export const initBrowserDetection = (): void => {
  if (typeof document === 'undefined') return
  const browserClass = getBrowserClass()
  document.documentElement.classList.add(browserClass)

  // Add Safari version class for more specific targeting
  const safariVersion = getSafariVersion()
  if (safariVersion) {
    document.documentElement.classList.add(`safari-${safariVersion}`)
  }

  // Add iOS version class
  const iosVersion = getIOSVersion()
  if (iosVersion) {
    document.documentElement.classList.add(`ios-${iosVersion}`)
  }
}

/**
 * Force Safari to reflow/repaint an element
 * Useful for fixing rendering bugs
 */
export const forceSafariReflow = (element: HTMLElement): void => {
  if (!isSafari()) return

  // Trigger reflow by reading offsetHeight
  element.style.display = 'none'
  element.offsetHeight // Force reflow
  element.style.display = ''
}

/**
 * Check if the device has a notch (iPhone X and newer)
 */
export const hasNotch = (): boolean => {
  if (!isIOS()) return false

  // Check for safe area insets (notch indicator)
  const div = document.createElement('div')
  div.style.paddingTop = 'env(safe-area-inset-top)'
  document.body.appendChild(div)
  const hasSafeArea = getComputedStyle(div).paddingTop !== '0px'
  document.body.removeChild(div)

  return hasSafeArea
}

/**
 * Detect if running in standalone mode (PWA on iOS)
 */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}
