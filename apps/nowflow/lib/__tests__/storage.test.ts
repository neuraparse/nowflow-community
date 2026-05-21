import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('storage helpers', () => {
  const originalWindow = (globalThis as any).window
  const originalLocalStorage = (globalThis as any).localStorage
  const originalEnv = process.env.USE_LOCAL_STORAGE

  afterEach(() => {
    vi.resetModules()
    ;(globalThis as any).window = originalWindow
    ;(globalThis as any).localStorage = originalLocalStorage
    if (originalEnv === undefined) {
      delete process.env.USE_LOCAL_STORAGE
    } else {
      process.env.USE_LOCAL_STORAGE = originalEnv
    }
  })

  beforeEach(() => {
    vi.resetModules()
    delete (globalThis as any).window
    delete (globalThis as any).localStorage
    delete process.env.USE_LOCAL_STORAGE
  })

  it('server context: returns false when USE_LOCAL_STORAGE env is unset', async () => {
    const mod = await import('@/lib/storage')
    expect(mod.getLocalStorageFlag()).toBe(false)
    expect(mod.storageMode.isLocal).toBe(false)
    expect(mod.storageMode.isDatabase).toBe(true)
  })

  it('server context: returns true when USE_LOCAL_STORAGE=true', async () => {
    process.env.USE_LOCAL_STORAGE = 'true'
    const mod = await import('@/lib/storage')
    expect(mod.getLocalStorageFlag()).toBe(true)
    expect(mod.storageMode.isLocal).toBe(true)
    expect(mod.storageMode.isDatabase).toBe(false)
  })

  it('client context: reads flag from localStorage when present', async () => {
    const getItem = vi.fn().mockReturnValue('true')
    ;(globalThis as any).window = {}
    ;(globalThis as any).localStorage = { getItem }

    const mod = await import('@/lib/storage')
    expect(mod.getLocalStorageFlag()).toBe(true)
    expect(getItem).toHaveBeenCalledWith('USE_LOCAL_STORAGE')
  })

  it('client context: returns false when localStorage flag is not "true"', async () => {
    ;(globalThis as any).window = {}
    ;(globalThis as any).localStorage = {
      getItem: vi.fn().mockReturnValue(null),
    }

    const mod = await import('@/lib/storage')
    expect(mod.getLocalStorageFlag()).toBe(false)
    expect(mod.storageMode.isDatabase).toBe(true)
  })

  it('storageMode.isLocal is the inverse of isDatabase', async () => {
    process.env.USE_LOCAL_STORAGE = 'true'
    const mod = await import('@/lib/storage')
    expect(mod.storageMode.isLocal).toBe(!mod.storageMode.isDatabase)
  })
})
