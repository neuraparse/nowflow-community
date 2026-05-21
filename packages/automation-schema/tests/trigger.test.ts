import { describe, expect, it } from 'vitest'
import {
  PollTriggerSchema,
  ScheduleTriggerSchema,
  TriggerConfigSchema,
  WebhookTriggerSchema,
} from '../src/trigger'

const envelope = {
  id: 't1',
  workflowId: 'w1',
  isActive: true,
  workspaceId: 'ws1',
}

describe('WebhookTriggerSchema variant', () => {
  it('parses a webhook trigger', () => {
    const parsed = TriggerConfigSchema.parse({
      ...envelope,
      kind: 'webhook',
      path: '/hooks/abc',
    })
    expect(parsed.kind).toBe('webhook')
  })

  it('fails when `path` is missing', () => {
    const result = TriggerConfigSchema.safeParse({ ...envelope, kind: 'webhook' })
    expect(result.success).toBe(false)
  })

  it('accepts an optional rate limit', () => {
    const parsed = WebhookTriggerSchema.parse({
      kind: 'webhook',
      path: '/x',
      rateLimit: { perMinute: 60, perHour: 1000 },
    })
    expect(parsed.rateLimit?.perMinute).toBe(60)
  })
})

describe('ScheduleTriggerSchema variant', () => {
  it('parses a schedule trigger', () => {
    const parsed = TriggerConfigSchema.parse({
      ...envelope,
      kind: 'schedule',
      cronExpression: '0 * * * *',
      timezone: 'UTC',
    })
    expect(parsed.kind).toBe('schedule')
  })

  it('fails when cronExpression is missing', () => {
    const result = TriggerConfigSchema.safeParse({
      ...envelope,
      kind: 'schedule',
      timezone: 'UTC',
    })
    expect(result.success).toBe(false)
  })

  it('fails when timezone is missing', () => {
    const result = TriggerConfigSchema.safeParse({
      ...envelope,
      kind: 'schedule',
      cronExpression: '0 * * * *',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-string cron expression (this is the only shape check — validity of the cron string is downstream)', () => {
    const result = ScheduleTriggerSchema.safeParse({
      kind: 'schedule',
      cronExpression: 12345,
      timezone: 'UTC',
    })
    expect(result.success).toBe(false)
  })
})

describe('PollTriggerSchema variant', () => {
  it('parses a poll trigger', () => {
    const parsed = TriggerConfigSchema.parse({
      ...envelope,
      kind: 'poll',
      pollingIntervalSec: 60,
      provider: 'gmail',
      providerConfig: { label: 'inbox' },
    })
    expect(parsed.kind).toBe('poll')
  })

  it('fails when provider is missing', () => {
    const result = TriggerConfigSchema.safeParse({
      ...envelope,
      kind: 'poll',
      pollingIntervalSec: 60,
      providerConfig: {},
    })
    expect(result.success).toBe(false)
  })

  it('fails when pollingIntervalSec is missing', () => {
    const result = PollTriggerSchema.safeParse({
      kind: 'poll',
      provider: 'gmail',
      providerConfig: {},
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional lastSeenIdentifiers', () => {
    const parsed = PollTriggerSchema.parse({
      kind: 'poll',
      pollingIntervalSec: 30,
      provider: 'gmail',
      providerConfig: {},
      lastSeenIdentifiers: ['id-1', 'id-2'],
    })
    expect(parsed.lastSeenIdentifiers).toHaveLength(2)
  })
})

describe('TriggerConfigSchema discriminated union', () => {
  it('rejects an unknown kind', () => {
    const result = TriggerConfigSchema.safeParse({ ...envelope, kind: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('fails when the envelope is missing workflowId', () => {
    const { workflowId: _omit, ...bad } = envelope
    const result = TriggerConfigSchema.safeParse({
      ...bad,
      kind: 'webhook',
      path: '/x',
    })
    expect(result.success).toBe(false)
  })

  it('fails when the envelope is missing workspaceId', () => {
    const { workspaceId: _omit, ...bad } = envelope
    const result = TriggerConfigSchema.safeParse({
      ...bad,
      kind: 'schedule',
      cronExpression: '0 * * * *',
      timezone: 'UTC',
    })
    expect(result.success).toBe(false)
  })
})
