import { describe, expect, it, vi } from 'vitest'
import {
  detectAndMaskPII,
  detectPII,
  maskPII,
  type PIIMatch,
  processObjectForPII,
} from '../pii-detector'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('detectPII', () => {
  it('detects email addresses', () => {
    const result = detectPII('Contact me at alice@example.com today')
    expect(result.hasPI).toBe(true)
    const emailMatch = result.matches.find((m) => m.type === 'email')
    expect(emailMatch?.value).toBe('alice@example.com')
    expect(emailMatch?.confidence).toBeCloseTo(0.95)
  })

  it('detects SSNs with correct confidence', () => {
    const result = detectPII('My SSN is 123-45-6789', ['ssn'])
    expect(result.hasPI).toBe(true)
    const ssn = result.matches.find((m) => m.type === 'ssn')
    expect(ssn?.value).toBe('123-45-6789')
  })

  it('rejects invalid SSNs starting with 000', () => {
    const result = detectPII('SSN: 000-12-3456', ['ssn'])
    expect(result.hasPI).toBe(false)
  })

  it('rejects invalid SSNs starting with 666', () => {
    const result = detectPII('SSN: 666-12-3456', ['ssn'])
    expect(result.hasPI).toBe(false)
  })

  it('detects valid credit cards passing Luhn check', () => {
    // 4242 4242 4242 4242 is a well-known Luhn-valid Visa test number
    const result = detectPII('Card: 4242424242424242', ['credit_card'])
    expect(result.hasPI).toBe(true)
    const cc = result.matches.find((m) => m.type === 'credit_card')
    expect(cc).toBeDefined()
  })

  it('rejects credit cards that fail Luhn', () => {
    const result = detectPII('Card: 4242424242424241', ['credit_card'])
    expect(result.hasPI).toBe(false)
  })

  it('validates IP addresses', () => {
    const valid = detectPII('IP is 192.168.1.1', ['ip_address'])
    expect(valid.hasPI).toBe(true)

    const invalid = detectPII('IP is 999.999.999.999', ['ip_address'])
    expect(invalid.hasPI).toBe(false)
  })

  it('returns empty when no PII present', () => {
    const result = detectPII('Nothing sensitive here')
    expect(result.hasPI).toBe(false)
    expect(result.matches).toHaveLength(0)
  })

  it('returns maskedText equal to input when not combined with mask', () => {
    const result = detectPII('email: a@b.co')
    expect(result.maskedText).toBe('email: a@b.co')
  })

  it('uses default types when none specified', () => {
    // name/address/ip_address/passport/date_of_birth not default
    const text = '192.168.0.1 and a@b.co'
    const result = detectPII(text)
    expect(result.matches.some((m) => m.type === 'email')).toBe(true)
    expect(result.matches.some((m) => m.type === 'ip_address')).toBe(false)
  })

  it('only detects requested types', () => {
    const result = detectPII('a@b.com and 123-45-6789', ['email'])
    expect(result.matches.every((m) => m.type === 'email')).toBe(true)
  })

  it('skips pii types with no patterns (name/address)', () => {
    const result = detectPII('John Smith lives at 123 Main St', ['name', 'address'])
    expect(result.hasPI).toBe(false)
  })

  it('deduplicates overlapping matches, keeping higher confidence', () => {
    // Phone and credit card can both match 16-digit numbers; dedupe should pick one
    const result = detectPII('4242424242424242', ['phone', 'credit_card'])
    // Should produce only one match covering that range
    expect(result.matches.length).toBe(1)
  })
})

describe('maskPII', () => {
  const matches: PIIMatch[] = [
    { type: 'email', value: 'a@b.co', start: 8, end: 14, confidence: 0.95 },
  ]

  it('asterisks mask replaces chars 1:1', () => {
    const text = 'contact a@b.co now'
    const masked = maskPII(text, matches, 'asterisk')
    expect(masked).toBe('contact ****** now')
  })

  it('redact mask replaces with type label', () => {
    const text = 'contact a@b.co now'
    const masked = maskPII(text, matches, 'redact')
    expect(masked).toBe('contact [EMAIL_REDACTED] now')
  })

  it('hash mask replaces with hash label', () => {
    const text = 'contact a@b.co now'
    const masked = maskPII(text, matches, 'hash')
    expect(masked).toMatch(/^contact \[EMAIL_HASH_[a-f0-9]+\] now$/)
  })

  it('remove mask deletes the match', () => {
    const text = 'contact a@b.co now'
    const masked = maskPII(text, matches, 'remove')
    expect(masked).toBe('contact  now')
  })

  it('returns text unchanged when no matches', () => {
    expect(maskPII('hello world', [], 'asterisk')).toBe('hello world')
  })

  it('handles multiple matches preserving order', () => {
    const text = 'A: a@b.co, B: c@d.co'
    const matches: PIIMatch[] = [
      { type: 'email', value: 'a@b.co', start: 3, end: 9, confidence: 0.95 },
      { type: 'email', value: 'c@d.co', start: 14, end: 20, confidence: 0.95 },
    ]
    const masked = maskPII(text, matches, 'redact')
    expect(masked).toBe('A: [EMAIL_REDACTED], B: [EMAIL_REDACTED]')
  })

  it('defaults to asterisk when mode is unknown', () => {
    const masked = maskPII('contact a@b.co now', matches, 'bogus' as any)
    expect(masked).toBe('contact ****** now')
  })
})

describe('detectAndMaskPII', () => {
  it('combines detection and masking in one call', () => {
    const result = detectAndMaskPII('Email a@b.co please', ['email'], 'redact')
    expect(result.hasPI).toBe(true)
    expect(result.maskedText).toBe('Email [EMAIL_REDACTED] please')
  })

  it('returns original text when no PII detected', () => {
    const result = detectAndMaskPII('nothing here', ['email'], 'redact')
    expect(result.hasPI).toBe(false)
    expect(result.maskedText).toBe('nothing here')
  })
})

describe('processObjectForPII', () => {
  it('processes string values in a nested object', () => {
    const obj = {
      user: {
        name: 'Alice',
        contact: 'alice@example.com',
      },
      comments: ['Hello', 'reach me at bob@example.com'],
    }
    const { result, matches, fieldsProcessed } = processObjectForPII(obj, ['email'], 'redact')
    expect(fieldsProcessed).toBe(4)
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(result.user.contact).toBe('[EMAIL_REDACTED]')
    expect(result.comments[1]).toContain('[EMAIL_REDACTED]')
    // Non-PII strings untouched
    expect(result.user.name).toBe('Alice')
  })

  it('skips exempt fields', () => {
    const obj = { contact: 'a@b.co', raw: 'a@b.co' }
    const { result } = processObjectForPII(obj, ['email'], 'redact', ['raw'])
    expect(result.contact).toBe('[EMAIL_REDACTED]')
    expect(result.raw).toBe('a@b.co')
  })

  it('passes through primitive non-strings unchanged', () => {
    const obj = { count: 5, active: true, missing: null }
    const { result, matches } = processObjectForPII(obj, ['email'])
    expect(result.count).toBe(5)
    expect(result.active).toBe(true)
    expect(result.missing).toBe(null)
    expect(matches).toHaveLength(0)
  })

  it('annotates matches with their path', () => {
    const obj = { user: { email: 'a@b.co' } }
    const { matches } = processObjectForPII(obj, ['email'], 'redact')
    expect(matches[0].value).toContain('user.email')
  })

  it('handles arrays at the root', () => {
    const arr = ['alice@example.com', 'bob']
    const { result } = processObjectForPII(arr, ['email'], 'redact')
    expect(result[0]).toBe('[EMAIL_REDACTED]')
    expect(result[1]).toBe('bob')
  })
})
