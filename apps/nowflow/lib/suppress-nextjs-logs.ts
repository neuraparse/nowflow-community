/**
 * Suppress verbose Next.js development logs
 * This module filters out noisy Next.js cache and revalidation logs
 */

// Store original console methods
const originalConsoleLog = console.log
const originalConsoleInfo = console.info
const originalConsoleWarn = console.warn

// Patterns to suppress
const SUPPRESS_PATTERNS = [
  /use-cache: initializing cache handlers/,
  /use-cache: setting ".*" cache handler from default/,
  /use-cache: cache handlers already initialized/,
  /using filesystem cache handler/,
  /using memory store for fetch cache/,
  /memory store already initialized/,
  /IncrementalCache: using filesystem cache handler/,
  /FileSystemCache: memory store already initialized/,
  /FileSystemCache: using memory store/,
  /pending revalidates promise finished for:/,
  /Cache miss for/,
  /Cache hit for/,
  /Revalidating/,
  /Cache entry expired/,
  /Cache entry not found/,
  /\[baseline-browser-mapping\] The data in this module is over two months old/,
]

// Check if a message should be suppressed
function shouldSuppress(message: string): boolean {
  return SUPPRESS_PATTERNS.some((pattern) => pattern.test(message))
}

// Filter function for console methods
function createFilteredConsole(originalMethod: typeof console.log) {
  return function (...args: any[]) {
    // Convert all arguments to string for pattern matching
    const message = args
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ')

    // Suppress in both development and production
    if (shouldSuppress(message)) {
      return // Suppress this log
    }

    // Call original method for non-suppressed logs
    originalMethod.apply(console, args)
  }
}

// Apply filtering in all environments to reduce log noise
if (typeof process !== 'undefined') {
  console.log = createFilteredConsole(originalConsoleLog)
  console.info = createFilteredConsole(originalConsoleInfo)
  console.warn = createFilteredConsole(originalConsoleWarn)
}

// Export function to restore original console (for testing)
export function restoreConsole() {
  console.log = originalConsoleLog
  console.info = originalConsoleInfo
  console.warn = originalConsoleWarn
}

// Export function to re-apply filtering
export function suppressNextJSLogs() {
  if (process.env.NODE_ENV === 'development') {
    console.log = createFilteredConsole(originalConsoleLog)
    console.info = createFilteredConsole(originalConsoleInfo)
    console.warn = createFilteredConsole(originalConsoleWarn)
  }
}
