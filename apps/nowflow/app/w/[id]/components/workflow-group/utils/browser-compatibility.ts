import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('browser-compatibility')
/**
 * Browser compatibility utilities for workflow group system
 * Cross-browser support for Safari, iOS, Firefox, Chrome, Edge (2025 best practices)
 */

// ============================================
// 🌐 BROWSER DETECTION UTILITIES
// ============================================

/**
 * Detect Safari browser (desktop and mobile)
 */
export const isSafari =
  typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

/**
 * Detect iOS Safari specifically
 */
export const isIOSSafari =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

/**
 * Detect iOS (any browser on iOS)
 */
export const isIOS =
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

/**
 * Detect Firefox
 */
export const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)

/**
 * Detect Chrome
 */
export const isChrome =
  typeof navigator !== 'undefined' &&
  /chrome/i.test(navigator.userAgent) &&
  !/edge|edg/i.test(navigator.userAgent)

/**
 * Detect Edge
 */
export const isEdge = typeof navigator !== 'undefined' && /edge|edg/i.test(navigator.userAgent)

/**
 * Detect WebKit-based browsers
 */
export const isWebKit = typeof navigator !== 'undefined' && /webkit/i.test(navigator.userAgent)

/**
 * Get browser info object
 */
export function getBrowserInfo(): {
  isSafari: boolean
  isIOSSafari: boolean
  isIOS: boolean
  isFirefox: boolean
  isChrome: boolean
  isEdge: boolean
  isWebKit: boolean
  supportsPointerEvents: boolean
  supportsTouchEvents: boolean
  supportsPassiveEvents: boolean
} {
  const supportsPointerEvents = typeof PointerEvent !== 'undefined'
  const supportsTouchEvents = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Passive event listeners are supported in all modern browsers since 2017
  const supportsPassiveEvents = true

  return {
    isSafari,
    isIOSSafari,
    isIOS,
    isFirefox,
    isChrome,
    isEdge,
    isWebKit,
    supportsPointerEvents,
    supportsTouchEvents,
    supportsPassiveEvents,
  }
}

// ============================================
// 🔧 iOS SAFARI SPECIFIC FIXES
// ============================================

/**
 * iOS Safari viewport height fix
 * iOS Safari's address bar causes viewport height changes during scroll
 * This provides a stable viewport height using CSS custom properties
 */
export function initIOSViewportFix(): () => void {
  if (typeof window === 'undefined') return () => {}

  const setViewportHeight = () => {
    // Use visualViewport if available (more accurate on iOS)
    const vh = window.visualViewport?.height || window.innerHeight
    document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`)
    document.documentElement.style.setProperty('--viewport-height', `${vh}px`)
  }

  // Set initial value
  setViewportHeight()

  // Update on resize and orientation change
  window.addEventListener('resize', setViewportHeight)
  window.addEventListener('orientationchange', setViewportHeight)

  // Use visualViewport API if available (better for iOS)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setViewportHeight)
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('resize', setViewportHeight)
    window.removeEventListener('orientationchange', setViewportHeight)
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', setViewportHeight)
    }
  }
}

/**
 * iOS Safari drag cancellation fix
 * Prevents drag operations from being cancelled when the address bar shows/hides
 */
export function createIOSDragGuard(): {
  startDrag: () => void
  endDrag: () => void
  shouldIgnoreResize: () => boolean
} {
  let isDragging = false
  let initialViewportHeight = 0
  const RESIZE_THRESHOLD = 50 // pixels - address bar is typically ~50-100px

  return {
    startDrag: () => {
      isDragging = true
      initialViewportHeight = window.innerHeight
    },
    endDrag: () => {
      isDragging = false
      initialViewportHeight = 0
    },
    shouldIgnoreResize: () => {
      if (!isDragging || !isIOSSafari) return false

      const currentHeight = window.innerHeight
      const heightDiff = Math.abs(currentHeight - initialViewportHeight)

      // If height changed significantly during drag, it's likely the address bar
      return heightDiff > RESIZE_THRESHOLD
    },
  }
}

// ============================================
// 🎯 POINTER EVENTS UTILITIES
// ============================================

/**
 * Get unified coordinates from any pointer/touch/mouse event
 */
export function getEventCoordinates(
  e:
    | PointerEvent
    | TouchEvent
    | MouseEvent
    | React.PointerEvent
    | React.TouchEvent
    | React.MouseEvent
): { x: number; y: number } {
  if ('touches' in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  if ('changedTouches' in e && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
  }
  if ('clientX' in e) {
    return { x: e.clientX, y: e.clientY }
  }
  return { x: 0, y: 0 }
}

/**
 * Create cross-browser drag handlers
 * Returns unified handlers that work across all browsers
 */
export function createCrossBrowserDragHandlers(options: {
  onDragStart?: (
    coords: { x: number; y: number },
    e: PointerEvent | TouchEvent | MouseEvent
  ) => void
  onDragMove?: (coords: { x: number; y: number }, e: PointerEvent | TouchEvent | MouseEvent) => void
  onDragEnd?: (coords: { x: number; y: number }, e: PointerEvent | TouchEvent | MouseEvent) => void
  element?: HTMLElement | null
}): {
  handlePointerDown: (e: PointerEvent | React.PointerEvent) => void
  handleMouseDown: (e: MouseEvent | React.MouseEvent) => void
  handleTouchStart: (e: TouchEvent | React.TouchEvent) => void
  cleanup: () => void
} {
  const { onDragStart, onDragMove, onDragEnd, element } = options
  let isDragging = false
  let activePointerId: number | null = null
  const iosDragGuard = createIOSDragGuard()

  const handleMove = (e: PointerEvent | TouchEvent | MouseEvent) => {
    if (!isDragging) return

    // iOS Safari resize guard
    if (iosDragGuard.shouldIgnoreResize()) return

    e.preventDefault()
    const coords = getEventCoordinates(e)
    onDragMove?.(coords, e)
  }

  const handleEnd = (e: PointerEvent | TouchEvent | MouseEvent) => {
    if (!isDragging) return

    isDragging = false
    iosDragGuard.endDrag()

    // Release pointer capture
    if (activePointerId !== null && element) {
      try {
        element.releasePointerCapture(activePointerId)
      } catch {
        // Ignore
      }
      activePointerId = null
    }

    const coords = getEventCoordinates(e)
    onDragEnd?.(coords, e)

    // Remove listeners
    document.removeEventListener('pointermove', handleMove)
    document.removeEventListener('pointerup', handleEnd)
    document.removeEventListener('pointercancel', handleEnd)
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleEnd)
    document.removeEventListener('touchmove', handleMove)
    document.removeEventListener('touchend', handleEnd)
    document.removeEventListener('touchcancel', handleEnd)
  }

  const startDrag = (e: PointerEvent | TouchEvent | MouseEvent) => {
    isDragging = true
    iosDragGuard.startDrag()

    const coords = getEventCoordinates(e)
    onDragStart?.(coords, e)

    // Add listeners
    document.addEventListener('pointermove', handleMove, { passive: false })
    document.addEventListener('pointerup', handleEnd)
    document.addEventListener('pointercancel', handleEnd)
    document.addEventListener('mousemove', handleMove, { passive: false })
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
    document.addEventListener('touchcancel', handleEnd)
  }

  return {
    handlePointerDown: (e: PointerEvent | React.PointerEvent) => {
      e.preventDefault()

      // Store pointer ID for capture
      if ('pointerId' in e) {
        activePointerId = e.pointerId
        if (element) {
          try {
            element.setPointerCapture(e.pointerId)
          } catch {
            // Fallback
          }
        }
      }

      startDrag(e as PointerEvent)
    },
    handleMouseDown: (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault()
      startDrag(e as MouseEvent)
    },
    handleTouchStart: (e: TouchEvent | React.TouchEvent) => {
      e.preventDefault()
      startDrag(e as TouchEvent)
    },
    cleanup: () => {
      handleEnd({} as PointerEvent)
    },
  }
}

/**
 * Check if the browser supports required features
 */
export function checkBrowserCompatibility(): {
  isSupported: boolean
  missingFeatures: string[]
  warnings: string[]
} {
  const missingFeatures: string[] = []
  const warnings: string[] = []

  // crypto.randomUUID, requestAnimationFrame, IntersectionObserver
  // are natively supported in all modern browsers since 2022

  if (!window.ResizeObserver) {
    warnings.push('ResizeObserver not available - some responsive features may not work')
  }

  // Check for CSS features
  if (!CSS.supports('backdrop-filter', 'blur(10px)')) {
    warnings.push('backdrop-filter not supported - some visual effects may be degraded')
  }

  if (!CSS.supports('transform', 'translate3d(0, 0, 0)')) {
    warnings.push('3D transforms not supported - animations may be less smooth')
  }

  // Check for touch support
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  if (isTouchDevice && !window.TouchEvent) {
    warnings.push('Touch events may not work properly')
  }

  return {
    isSupported: missingFeatures.length === 0,
    missingFeatures,
    warnings,
  }
}

/**
 * Get device type and capabilities
 */
export function getDeviceInfo(): {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  hasTouch: boolean
  screenSize: 'small' | 'medium' | 'large'
  pixelRatio: number
} {
  const userAgent = navigator.userAgent.toLowerCase()
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
  const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  const screenWidth = window.innerWidth
  let screenSize: 'small' | 'medium' | 'large' = 'medium'

  if (screenWidth < 768) {
    screenSize = 'small'
  } else if (screenWidth >= 1200) {
    screenSize = 'large'
  }

  return {
    isMobile: isMobile && !isTablet,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    hasTouch,
    screenSize,
    pixelRatio: window.devicePixelRatio || 1,
  }
}

/**
 * Optimize performance based on device capabilities
 */
export function getPerformanceSettings(): {
  enableAnimations: boolean
  enableBlur: boolean
  enableShadows: boolean
  maxGroupsToRender: number
  debounceDelay: number
} {
  const deviceInfo = getDeviceInfo()
  const isLowEndDevice = deviceInfo.pixelRatio < 2 && deviceInfo.screenSize === 'small'

  return {
    enableAnimations: !isLowEndDevice,
    enableBlur: !isLowEndDevice && CSS.supports('backdrop-filter', 'blur(10px)'),
    enableShadows: !isLowEndDevice,
    maxGroupsToRender: isLowEndDevice ? 50 : 200,
    debounceDelay: isLowEndDevice ? 300 : 150,
  }
}

/**
 * Add touch gesture support for mobile devices
 */
export function addTouchGestureSupport(
  element: HTMLElement,
  callbacks: {
    onTap?: (e: TouchEvent) => void
    onDoubleTap?: (e: TouchEvent) => void
    onLongPress?: (e: TouchEvent) => void
    onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', e: TouchEvent) => void
  }
): () => void {
  let touchStartTime = 0
  let touchStartPos = { x: 0, y: 0 }
  let longPressTimer: NodeJS.Timeout | null = null
  let lastTapTime = 0

  const handleTouchStart = (e: TouchEvent) => {
    touchStartTime = Date.now()
    const touch = e.touches[0]
    touchStartPos = { x: touch.clientX, y: touch.clientY }

    // Start long press timer
    longPressTimer = setTimeout(() => {
      callbacks.onLongPress?.(e)
    }, 500)
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const touchEndTime = Date.now()
    const touchDuration = touchEndTime - touchStartTime

    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }

    // Handle tap
    if (touchDuration < 300) {
      const timeSinceLastTap = touchEndTime - lastTapTime

      if (timeSinceLastTap < 300) {
        // Double tap
        callbacks.onDoubleTap?.(e)
      } else {
        // Single tap
        callbacks.onTap?.(e)
      }

      lastTapTime = touchEndTime
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    // Clear long press timer on move
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }

    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartPos.x
    const deltaY = touch.clientY - touchStartPos.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // Detect swipe
    if (distance > 50) {
      const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI
      let direction: 'left' | 'right' | 'up' | 'down'

      if (angle >= -45 && angle <= 45) {
        direction = 'right'
      } else if (angle >= 45 && angle <= 135) {
        direction = 'down'
      } else if (angle >= -135 && angle <= -45) {
        direction = 'up'
      } else {
        direction = 'left'
      }

      callbacks.onSwipe?.(direction, e)
    }
  }

  element.addEventListener('touchstart', handleTouchStart, { passive: true })
  element.addEventListener('touchend', handleTouchEnd, { passive: true })
  element.addEventListener('touchmove', handleTouchMove, { passive: true })

  // Return cleanup function
  return () => {
    element.removeEventListener('touchstart', handleTouchStart)
    element.removeEventListener('touchend', handleTouchEnd)
    element.removeEventListener('touchmove', handleTouchMove)

    if (longPressTimer) {
      clearTimeout(longPressTimer)
    }
  }
}

/**
 * Polyfills for older browsers
 * All previously polyfilled APIs (crypto.randomUUID, IntersectionObserver)
 * are natively supported in all modern browsers since 2022.
 */
export function loadPolyfills(): Promise<void> {
  return Promise.resolve()
}

/**
 * Initialize browser compatibility and optimizations
 */
export async function initializeBrowserSupport(): Promise<{
  compatibility: ReturnType<typeof checkBrowserCompatibility>
  deviceInfo: ReturnType<typeof getDeviceInfo>
  performanceSettings: ReturnType<typeof getPerformanceSettings>
}> {
  // Load polyfills first
  await loadPolyfills()

  const compatibility = checkBrowserCompatibility()
  const deviceInfo = getDeviceInfo()
  const performanceSettings = getPerformanceSettings()

  // Log compatibility info
  if (compatibility.warnings.length > 0) {
    logger.warn('Browser compatibility warnings:', compatibility.warnings)
  }

  if (!compatibility.isSupported) {
    logger.error('Browser not fully supported. Missing features:', compatibility.missingFeatures)
  }

  return {
    compatibility,
    deviceInfo,
    performanceSettings,
  }
}
