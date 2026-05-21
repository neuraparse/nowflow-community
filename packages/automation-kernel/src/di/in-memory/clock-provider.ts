import type { ClockProvider } from '../clock-provider'

/**
 * Default `ClockProvider` backed by `Date.now` and `setTimeout`. Suitable
 * for production hosts and as a smoke-test default.
 */
export class SystemClockProvider implements ClockProvider {
  now(): number {
    return Date.now()
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'))
        return
      }
      const handle = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, ms)
      const onAbort = () => {
        clearTimeout(handle)
        reject(new Error('Aborted'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
}
