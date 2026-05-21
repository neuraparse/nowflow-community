/**
 * Global error handlers for development stability
 */

// Note: This file is loaded via require() from next.config.ts before path aliases are available.
// Cannot use createLogger here — must use raw console.
const logger = {
  error: (...args: unknown[]) => console.error('[ErrorHandlers]', ...args),
  warn: (...args: unknown[]) => console.warn('[ErrorHandlers]', ...args),
}

// Handle uncaught exceptions gracefully
if (process.env.NODE_ENV === 'development') {
  process.on('uncaughtException', (error) => {
    // Only log non-connection reset errors
    if (error.message !== 'aborted' && !error.message.includes('ECONNRESET')) {
      logger.error('Uncaught Exception:', error)
    }
    // Don't exit in development
  })

  process.on('unhandledRejection', (reason, promise) => {
    // Only log non-connection reset errors
    if (
      reason &&
      typeof reason === 'object' &&
      'message' in reason &&
      reason.message !== 'aborted' &&
      !String(reason).includes('ECONNRESET')
    ) {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
    }
    // Don't exit in development
  })
}

export function setupErrorHandlers() {
  // This function can be called to ensure handlers are set up
  // Currently handlers are set up on import
}
