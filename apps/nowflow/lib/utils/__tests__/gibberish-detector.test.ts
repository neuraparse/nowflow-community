import { describe, expect, it } from 'vitest'
import { isGibberish, isValidWordBigram, scoreWord } from '../gibberish-detector'

describe('scoreWord', () => {
  it('returns 0 for empty strings', () => {
    expect(scoreWord('')).toBe(0)
  })

  it('returns 0 for single-character input', () => {
    expect(scoreWord('a')).toBe(0)
  })

  it('returns 0 when input reduces to less than 2 alphanumeric chars', () => {
    // Punctuation-only, underscore, etc. strip away
    expect(scoreWord('!!')).toBe(0)
    expect(scoreWord('_')).toBe(0)
    expect(scoreWord('a!')).toBe(0)
  })

  it('returns a positive number for an obvious English word', () => {
    expect(scoreWord('hello')).toBeGreaterThan(0)
    expect(scoreWord('world')).toBeGreaterThan(0)
  })

  it('scores real English words above the default gibberish threshold (1.8)', () => {
    const words = ['hello', 'world', 'computer', 'language', 'testing', 'function']
    for (const w of words) {
      expect(scoreWord(w)).toBeGreaterThan(1.8)
    }
  })

  it('scores obvious gibberish below the default gibberish threshold (1.8)', () => {
    const words = ['qxzvk', 'zzxjqk', 'bvcxzq', 'jqxkbv']
    for (const w of words) {
      expect(scoreWord(w)).toBeLessThan(1.8)
    }
  })

  it('is case insensitive', () => {
    expect(scoreWord('HELLO')).toBe(scoreWord('hello'))
    expect(scoreWord('HeLLo')).toBe(scoreWord('hello'))
  })

  it('ignores non-alphanumeric characters', () => {
    expect(scoreWord('hello!')).toBe(scoreWord('hello'))
    expect(scoreWord('he-llo')).toBe(scoreWord('hello'))
  })

  it('normalizes digits to a common bucket (# placeholder)', () => {
    // Different digits should produce the same score since all digits are
    // normalized to '#' internally.
    expect(scoreWord('abc123')).toBe(scoreWord('abc456'))
  })
})

describe('isGibberish', () => {
  it('returns false for empty strings (no latin chars)', () => {
    expect(isGibberish('')).toBe(false)
  })

  it('returns false for very short latin strings (<=2 chars)', () => {
    expect(isGibberish('a')).toBe(false)
    expect(isGibberish('ab')).toBe(false)
    expect(isGibberish('xy')).toBe(false)
  })

  it('uses a stricter threshold (+0.5) for exactly 3-char words', () => {
    // 'the' is one of the most common English words and must pass.
    expect(isGibberish('the')).toBe(false)
    // 'qxz' is a nonsensical 3-letter sequence and should fail even the
    // looser default threshold plus 0.5.
    expect(isGibberish('qxz')).toBe(true)
  })

  it('detects obvious gibberish on longer strings', () => {
    expect(isGibberish('qxzvkjbwp')).toBe(true)
    expect(isGibberish('zzxjqkbvcx')).toBe(true)
    expect(isGibberish('xkqjvbzqxk')).toBe(true)
  })

  it('accepts common English words as non-gibberish', () => {
    const real = [
      'hello',
      'world',
      'computer',
      'language',
      'testing',
      'keyboard',
      'function',
      'variable',
      'testing123',
    ]
    for (const w of real) {
      expect(isGibberish(w)).toBe(false)
    }
  })

  it('passes non-Latin scripts (CJK) through as non-gibberish', () => {
    expect(isGibberish('你好')).toBe(false)
    expect(isGibberish('こんにちは')).toBe(false)
    expect(isGibberish('안녕하세요')).toBe(false)
  })

  it('passes Arabic script through as non-gibberish', () => {
    expect(isGibberish('مرحبا')).toBe(false)
  })

  it('passes Cyrillic script through as non-gibberish', () => {
    expect(isGibberish('привет')).toBe(false)
  })

  it('passes emoji-only input through as non-gibberish', () => {
    expect(isGibberish('🚀🔥')).toBe(false)
  })

  it('passes digit-only input through as non-gibberish (no latin chars)', () => {
    expect(isGibberish('12345')).toBe(false)
  })

  it('honors a custom (lower) threshold to be more permissive', () => {
    // A value that's gibberish at default threshold may pass with threshold 0.
    const marginal = 'qxzvkjbwp'
    expect(isGibberish(marginal)).toBe(true)
    expect(isGibberish(marginal, 0)).toBe(false)
  })

  it('honors a custom (higher) threshold to be more strict', () => {
    // Even a real word can be flagged with an absurdly high threshold.
    expect(isGibberish('hello', 9)).toBe(true)
  })
})

describe('isValidWordBigram', () => {
  it('is the inverse of isGibberish', () => {
    const samples = ['hello', 'qxzvkjbwp', 'the', 'qxz', 'ab', '', '你好']
    for (const w of samples) {
      expect(isValidWordBigram(w)).toBe(!isGibberish(w))
    }
  })

  it('forwards the threshold argument', () => {
    const marginal = 'qxzvkjbwp'
    expect(isValidWordBigram(marginal)).toBe(false)
    expect(isValidWordBigram(marginal, 0)).toBe(true)
  })
})
