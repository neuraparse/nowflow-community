import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '../src/logger'

describe('createLogger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>
  let infoSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an object with debug/info/warn/error methods', () => {
    const logger = createLogger('test-module')

    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('debug() logs with module prefix and DEBUG level', () => {
    const logger = createLogger('my-mod')
    logger.debug('hello')

    expect(debugSpy).toHaveBeenCalledTimes(1)
    const firstArg = debugSpy.mock.calls[0][0] as string
    expect(firstArg).toContain('[DEBUG]')
    expect(firstArg).toContain('[my-mod]')
    expect(debugSpy.mock.calls[0][1]).toBe('hello')
  })

  it('info() logs with module prefix and INFO level', () => {
    const logger = createLogger('svc')
    logger.info('ready')

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const firstArg = infoSpy.mock.calls[0][0] as string
    expect(firstArg).toContain('[INFO]')
    expect(firstArg).toContain('[svc]')
    expect(infoSpy.mock.calls[0][1]).toBe('ready')
  })

  it('warn() logs with module prefix and WARN level', () => {
    const logger = createLogger('svc')
    logger.warn('heads-up')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const firstArg = warnSpy.mock.calls[0][0] as string
    expect(firstArg).toContain('[WARN]')
    expect(firstArg).toContain('[svc]')
  })

  it('error() logs with module prefix and ERROR level', () => {
    const logger = createLogger('svc')
    logger.error('boom')

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const firstArg = errorSpy.mock.calls[0][0] as string
    expect(firstArg).toContain('[ERROR]')
    expect(firstArg).toContain('[svc]')
  })

  it('includes meta object in log arguments when provided', () => {
    const logger = createLogger('svc')
    logger.info('processed', { userId: 42, durationMs: 10 })

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const args = infoSpy.mock.calls[0]
    expect(args[1]).toBe('processed')
    expect(args[2]).toEqual({ userId: 42, durationMs: 10 })
  })

  it('omits meta when empty object is provided', () => {
    const logger = createLogger('svc')
    logger.info('plain', {})

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const args = infoSpy.mock.calls[0]
    expect(args.length).toBe(2)
  })

  it('includes an ISO timestamp in the prefix', () => {
    const logger = createLogger('svc')
    logger.info('msg')

    const firstArg = infoSpy.mock.calls[0][0] as string
    expect(firstArg).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
  })

  it('each logger is scoped to its module name', () => {
    const a = createLogger('mod-a')
    const b = createLogger('mod-b')

    a.info('one')
    b.info('two')

    expect(infoSpy.mock.calls[0][0] as string).toContain('[mod-a]')
    expect(infoSpy.mock.calls[1][0] as string).toContain('[mod-b]')
  })
})
