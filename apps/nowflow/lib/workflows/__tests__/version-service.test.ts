import { describe, expect, it, vi } from 'vitest'
import { formatSemanticVersion, parseSemanticVersion } from '@/lib/workflows/version-service'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('uuid', () => ({ v4: () => 'uuid-fixed' }))

vi.mock('@/db', () => ({ db: {} }))

vi.mock('@/db/schema', () => ({
  workflow: {},
  workflowVersion: {},
  workflowVersionDiff: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  or: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  like: vi.fn(),
  inArray: vi.fn(),
}))

vi.mock('@/lib/workflows/diff-engine', () => ({
  computeWorkflowDiff: vi.fn(),
  generateDiffSummary: vi.fn(),
}))

describe('parseSemanticVersion', () => {
  it('parses a full major.minor.patch string', () => {
    expect(parseSemanticVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it('fills missing components with zero', () => {
    expect(parseSemanticVersion('4')).toEqual({ major: 4, minor: 0, patch: 0 })
    expect(parseSemanticVersion('4.5')).toEqual({ major: 4, minor: 5, patch: 0 })
  })

  it('treats non-numeric parts as zero', () => {
    expect(parseSemanticVersion('a.b.c')).toEqual({ major: 0, minor: 0, patch: 0 })
    expect(parseSemanticVersion('')).toEqual({ major: 0, minor: 0, patch: 0 })
  })

  it('handles large numbers', () => {
    expect(parseSemanticVersion('100.200.300')).toEqual({ major: 100, minor: 200, patch: 300 })
  })
})

describe('formatSemanticVersion', () => {
  it('joins components with dots', () => {
    expect(formatSemanticVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3')
    expect(formatSemanticVersion({ major: 0, minor: 0, patch: 0 })).toBe('0.0.0')
  })

  it('is inverse of parseSemanticVersion for well-formed input', () => {
    const input = '7.8.9'
    expect(formatSemanticVersion(parseSemanticVersion(input))).toBe(input)
  })
})
