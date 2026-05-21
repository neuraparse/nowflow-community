import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  copyToClipboard,
  generateUUID,
  getColorForCategory,
  getRotatingApiKey,
  getTimezoneAbbreviation,
} from '@/lib/utils'

describe('generateUUID', () => {
  it('returns a UUID v4-like string', () => {
    const id = generateUUID()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('generates unique values on consecutive calls', () => {
    const a = generateUUID()
    const b = generateUUID()
    expect(a).not.toBe(b)
  })

  it('falls back when crypto.randomUUID is unavailable', () => {
    const originalRandomUUID = (globalThis as any).crypto?.randomUUID
    // Remove randomUUID while leaving the rest of crypto intact
    if ((globalThis as any).crypto) {
      ;(globalThis as any).crypto.randomUUID = undefined
    }
    try {
      const id = generateUUID()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    } finally {
      if ((globalThis as any).crypto) {
        ;(globalThis as any).crypto.randomUUID = originalRandomUUID
      }
    }
  })
})

describe('copyToClipboard', () => {
  // Node 21+ exposes globalThis.navigator as a getter-only property, so a
  // plain `globalThis.navigator = ...` assignment throws. Use
  // defineProperty for all three globals so the test works on any Node
  // that ships a built-in WHATWG navigator.
  const setGlobal = (name: 'navigator' | 'window' | 'document', value: unknown) => {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    })
  }

  const originalNavigator = (globalThis as any).navigator
  const originalWindow = (globalThis as any).window
  const originalDocument = (globalThis as any).document

  afterEach(() => {
    setGlobal('navigator', originalNavigator)
    setGlobal('window', originalWindow)
    setGlobal('document', originalDocument)
  })

  it('uses modern clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setGlobal('navigator', { clipboard: { writeText } })
    setGlobal('window', { isSecureContext: true })

    const result = await copyToClipboard('hello')
    expect(result).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to document.execCommand when clipboard API unavailable', async () => {
    setGlobal('navigator', {})
    setGlobal('window', { isSecureContext: false })

    const textArea: any = {
      style: {},
      focus: vi.fn(),
      select: vi.fn(),
    }
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const execCommand = vi.fn().mockReturnValue(true)

    setGlobal('document', {
      createElement: vi.fn().mockReturnValue(textArea),
      body: { appendChild, removeChild },
      execCommand,
    })

    const result = await copyToClipboard('fallback-text')
    expect(result).toBe(true)
    expect(textArea.value).toBe('fallback-text')
    expect(appendChild).toHaveBeenCalledWith(textArea)
    expect(removeChild).toHaveBeenCalledWith(textArea)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns false when both paths throw', async () => {
    setGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('nope')),
      },
    })
    setGlobal('window', { isSecureContext: true })

    const result = await copyToClipboard('x')
    expect(result).toBe(false)
  })
})

describe('getTimezoneAbbreviation', () => {
  it('returns UTC for UTC', () => {
    expect(getTimezoneAbbreviation('UTC')).toBe('UTC')
  })

  it('returns the full IANA name for unknown timezones', () => {
    expect(getTimezoneAbbreviation('Mars/Olympus_Mons')).toBe('Mars/Olympus_Mons')
  })

  it('returns PST or PDT for America/Los_Angeles depending on date', () => {
    const januaryDate = new Date('2024-01-15T12:00:00Z')
    const julyDate = new Date('2024-07-15T12:00:00Z')

    const january = getTimezoneAbbreviation('America/Los_Angeles', januaryDate)
    const july = getTimezoneAbbreviation('America/Los_Angeles', julyDate)

    expect(['PST', 'PDT']).toContain(january)
    expect(['PST', 'PDT']).toContain(july)
  })

  it('returns the standard abbreviation for a non-DST zone (Tokyo)', () => {
    expect(getTimezoneAbbreviation('Asia/Tokyo')).toBe('JST')
  })
})

describe('getRotatingApiKey', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY_1
    delete process.env.OPENAI_API_KEY_2
    delete process.env.OPENAI_API_KEY_3
    delete process.env.ANTHROPIC_API_KEY_1
    delete process.env.ANTHROPIC_API_KEY_2
    delete process.env.ANTHROPIC_API_KEY_3
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.useRealTimers()
  })

  it('throws for an unsupported provider', () => {
    expect(() => getRotatingApiKey('gemini')).toThrow(
      /No rotation implemented for provider: gemini/
    )
  })

  it('throws when no keys are configured for openai', () => {
    expect(() => getRotatingApiKey('openai')).toThrow(/No API keys configured/)
  })

  it('throws when no keys are configured for anthropic', () => {
    expect(() => getRotatingApiKey('anthropic')).toThrow(/No API keys configured/)
  })

  it('returns an openai key when configured', () => {
    process.env.OPENAI_API_KEY_1 = 'key-1'
    process.env.OPENAI_API_KEY_2 = 'key-2'

    const key = getRotatingApiKey('openai')
    expect(['key-1', 'key-2']).toContain(key)
  })

  it('returns an anthropic key when configured', () => {
    process.env.ANTHROPIC_API_KEY_1 = 'a-key'
    const key = getRotatingApiKey('anthropic')
    expect(key).toBe('a-key')
  })
})

describe('getColorForCategory', () => {
  it('returns mapped color for known category', () => {
    expect(getColorForCategory('marketing')).toBe('#EC4899')
  })

  it('returns the fallback color for unknown categories', () => {
    expect(getColorForCategory('nonexistent-category')).toBe('#6B7280')
  })
})
