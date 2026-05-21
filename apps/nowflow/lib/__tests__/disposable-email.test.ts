import { describe, expect, it } from 'vitest'
import { disposableDomainCount, isDisposableEmail } from '@/lib/disposable-email'

describe('lib/disposable-email', () => {
  it('flags well-known throwaway providers', () => {
    expect(isDisposableEmail('attacker@mailinator.com')).toBe(true)
    expect(isDisposableEmail('x@guerrillamail.com')).toBe(true)
    expect(isDisposableEmail('a@10minutemail.com')).toBe(true)
    expect(isDisposableEmail('foo@yopmail.com')).toBe(true)
    expect(isDisposableEmail('bar@trashmail.com')).toBe(true)
    expect(isDisposableEmail('baz@sharklasers.com')).toBe(true)
  })

  it('does not flag legitimate personal / corporate providers', () => {
    // These are real providers that would have been false positives in the
    // early draft of the blocklist — keep them pinned.
    expect(isDisposableEmail('user@gmail.com')).toBe(false)
    expect(isDisposableEmail('user@outlook.com')).toBe(false)
    expect(isDisposableEmail('user@qq.com')).toBe(false)
    expect(isDisposableEmail('user@yeah.net')).toBe(false)
    expect(isDisposableEmail('student@nus.edu.sg')).toBe(false)
    expect(isDisposableEmail('user@poczta.onet.pl')).toBe(false)
    expect(isDisposableEmail('founder@example.com')).toBe(false)
  })

  it('handles edge cases without throwing', () => {
    expect(isDisposableEmail('')).toBe(false)
    expect(isDisposableEmail(null)).toBe(false)
    expect(isDisposableEmail(undefined)).toBe(false)
    expect(isDisposableEmail('no-at-sign')).toBe(false)
    expect(isDisposableEmail('trailing-at@')).toBe(false)
    expect(isDisposableEmail('User@MailInator.Com')).toBe(true) // case-insensitive
  })

  it('exposes a non-trivial blocklist size', () => {
    expect(disposableDomainCount()).toBeGreaterThan(200)
  })
})
