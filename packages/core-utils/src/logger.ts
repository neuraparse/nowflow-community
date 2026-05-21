/**
 * Minimal structured logger interface for L1 primitives.
 * Wraps console for now; can be swapped for a real backend later
 * without changing call sites.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void
  info: (message: string, meta?: Record<string, unknown>) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
  error: (message: string, meta?: Record<string, unknown>) => void
}

function format(level: LogLevel, module: string, message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [${level.toUpperCase()}] [${module}]`
  return meta && Object.keys(meta).length > 0 ? [prefix, message, meta] : [prefix, message]
}

export function createLogger(module: string): Logger {
  return {
    debug(message, meta) {
      // eslint-disable-next-line no-console
      console.debug(...format('debug', module, message, meta))
    },
    info(message, meta) {
      // eslint-disable-next-line no-console
      console.info(...format('info', module, message, meta))
    },
    warn(message, meta) {
      // eslint-disable-next-line no-console
      console.warn(...format('warn', module, message, meta))
    },
    error(message, meta) {
      // eslint-disable-next-line no-console
      console.error(...format('error', module, message, meta))
    },
  }
}
