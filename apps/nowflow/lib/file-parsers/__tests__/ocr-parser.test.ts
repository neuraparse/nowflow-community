/**
 * Unit tests for OCR-parser pure helpers (isValidWord, needsOcr).
 * We do NOT test the actual OCR pipeline (tesseract, ollama, pdftoppm) — these
 * require native binaries / network. We only cover the pure exported helpers.
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidWord, needsOcr } from '../ocr-parser'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  })),
}))

vi.mock('@/lib/environment', () => ({
  isProd: false,
  isDev: true,
  isTest: true,
}))

vi.mock('@/lib/ollama-detection', () => ({
  getOllamaHost: () => 'http://localhost:11434',
}))

// scoreWord is called in the bigram check — return a high score so that
// isValidWord does not reject legitimate-looking inputs in these tests.
vi.mock('@/lib/utils/gibberish-detector', () => ({
  scoreWord: vi.fn((word: string) => {
    // Known gibberish test tokens — return low score
    if (/^(xvkj|ztpq|mxzv|qQaeg|nVibIA)/i.test(word)) return 0.5
    return 5.0
  }),
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  mkdtemp: vi.fn(),
  readdir: vi.fn(),
  rmdir: vi.fn(),
}))

// Mock global fetch (imported file uses fetch for ollama)
global.fetch = vi.fn() as any

describe('isValidWord', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('accepts common English words', () => {
    expect(isValidWord('hello')).toBe(true)
    expect(isValidWord('world')).toBe(true)
    expect(isValidWord('language')).toBe(true)
  })

  it('accepts known abbreviations case-insensitively', () => {
    expect(isValidWord('AI')).toBe(true)
    expect(isValidWord('ai')).toBe(true)
    expect(isValidWord('API')).toBe(true)
    expect(isValidWord('NVIDIA')).toBe(true)
  })

  it('accepts URLs and domains', () => {
    expect(isValidWord('https://example.com')).toBe(true)
    expect(isValidWord('www.example.com')).toBe(true)
    expect(isValidWord('example.com')).toBe(true)
  })

  it('accepts emails', () => {
    expect(isValidWord('user@example.com')).toBe(true)
  })

  it('accepts version numbers', () => {
    expect(isValidWord('v1.0')).toBe(true)
    expect(isValidWord('1.2.3')).toBe(true)
  })

  it('accepts technical specs', () => {
    expect(isValidWord('100%')).toBe(true)
    expect(isValidWord('50MB')).toBe(true)
  })

  it('accepts single valid standalone characters', () => {
    expect(isValidWord('a')).toBe(true)
    expect(isValidWord('A')).toBe(true)
    expect(isValidWord('I')).toBe(true)
    expect(isValidWord('5')).toBe(true)
  })

  it('rejects random single characters', () => {
    expect(isValidWord('x')).toBe(false)
    expect(isValidWord('q')).toBe(false)
  })

  it('accepts common 2-letter words', () => {
    expect(isValidWord('of')).toBe(true)
    expect(isValidWord('in')).toBe(true)
    expect(isValidWord('is')).toBe(true)
  })

  it('rejects uncommon 2-letter combos', () => {
    expect(isValidWord('xq')).toBe(false)
    expect(isValidWord('zp')).toBe(false)
    expect(isValidWord('oO')).toBe(false)
  })

  it('rejects words with 3+ repeated characters', () => {
    expect(isValidWord('aaaah')).toBe(false)
    expect(isValidWord('flaaaghon')).toBe(false)
  })

  it('rejects mostly-identical-character noise', () => {
    expect(isValidWord('ASSA')).toBe(false)
    expect(isValidWord('EERE')).toBe(false)
  })

  it('rejects randomly mixed case words', () => {
    expect(isValidWord('nVibIA')).toBe(false)
    expect(isValidWord('qQaeg')).toBe(false)
  })

  it('rejects 3-char words without a vowel', () => {
    expect(isValidWord('bcd')).toBe(false)
    expect(isValidWord('fgh')).toBe(false)
  })

  it('rejects long consonant runs', () => {
    expect(isValidWord('bcdfghjk')).toBe(false)
  })

  it('rejects empty / symbol-only inputs', () => {
    expect(isValidWord('')).toBe(false)
    expect(isValidWord('!@#$')).toBe(false)
  })
})

describe('needsOcr', () => {
  it('returns true when content is null and file is large', () => {
    expect(needsOcr(null, 50000)).toBe(true)
  })

  it('returns false when content is null and file is small', () => {
    expect(needsOcr(null, 500)).toBe(false)
  })

  it('returns true when content undefined and file large', () => {
    expect(needsOcr(undefined, 100000)).toBe(true)
  })

  it('returns true for tiny content in a large file', () => {
    expect(needsOcr('hi', 100000)).toBe(true)
  })

  it('returns false when content is rich and readable', () => {
    const rich = 'This is a clean piece of readable text '.repeat(20)
    expect(needsOcr(rich, 100000)).toBe(false)
  })

  it('returns true when content has mostly non-ascii chars in a large file', () => {
    const binaryish = '\u0001\u0002\u0003\u0004'.repeat(200)
    expect(needsOcr(binaryish, 100000)).toBe(true)
  })

  it('returns false for small files regardless of content', () => {
    expect(needsOcr('', 100)).toBe(false)
    expect(needsOcr('text', 100)).toBe(false)
  })

  it('returns false for non-string content types but small filesize', () => {
    // Guard path: returns `fileSize > 10000`
    expect(needsOcr(123 as any, 5000)).toBe(false)
    expect(needsOcr(123 as any, 50000)).toBe(true)
  })
})
