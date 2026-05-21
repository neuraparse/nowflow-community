import { describe, expect, it, vi } from 'vitest'
import { formatWebhookInput } from '../workflow-execution'

// Mock all side-effect-heavy imports before loading the module under test.
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/lib/logs/execution-logger', () => ({
  persistExecutionError: vi.fn(),
  persistExecutionLogs: vi.fn(),
}))

vi.mock('@/lib/logs/trace-spans', () => ({ buildTraceSpans: vi.fn(() => []) }))

vi.mock('@/lib/execution/env-vars', () => ({ buildEffectiveEnvVars: vi.fn(async () => ({})) }))

vi.mock('@/lib/workflows/utils', () => ({ updateWorkflowRunCounts: vi.fn() }))

vi.mock('@/stores/workflows/utils', () => ({
  mergeSubblockStateAsync: vi.fn(async (blocks: any) => blocks),
}))

vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/db/schema', () => ({ userStats: {} }))

vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ eq: [col, val] }),
  sql: (() => {
    const fn = (() => ({})) as any
    return fn
  })(),
}))

vi.mock('@/executor', () => ({ Executor: class {} }))
vi.mock('@/serializer', () => ({ Serializer: class {} }))

vi.mock('next/server', () => ({ NextRequest: class {}, NextResponse: class {} }))

function makeRequest(method: string = 'POST', headers: Record<string, string> = {}) {
  return {
    method,
    headers: new Headers(headers),
  } as any
}

describe('formatWebhookInput (whatsapp)', () => {
  const baseWebhook = { provider: 'whatsapp', path: '/wh/x', providerConfig: { k: 'v' } }
  const baseWorkflow = { id: 'wf-1' }

  it('returns formatted WhatsApp input when message present', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pn-1' },
                messages: [
                  {
                    id: 'm1',
                    from: '15551234567',
                    timestamp: '170000',
                    text: { body: 'hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    }
    const result = formatWebhookInput(baseWebhook, baseWorkflow, body, makeRequest())
    expect(result).not.toBeNull()
    expect(result.whatsapp.data.messageId).toBe('m1')
    expect(result.whatsapp.data.from).toBe('15551234567')
    expect(result.whatsapp.data.phoneNumberId).toBe('pn-1')
    expect(result.whatsapp.data.text).toBe('hello')
    expect(result.whatsapp.data.timestamp).toBe('170000')
    expect(result.webhook.data.provider).toBe('whatsapp')
    expect(result.webhook.data.path).toBe('/wh/x')
    expect(result.workflowId).toBe('wf-1')
  })

  it('returns null when no whatsapp messages', () => {
    const body = { entry: [{ changes: [{ value: { messages: [] } }] }] }
    const result = formatWebhookInput(baseWebhook, baseWorkflow, body, makeRequest())
    expect(result).toBeNull()
  })

  it('returns null when body shape is missing', () => {
    const result = formatWebhookInput(baseWebhook, baseWorkflow, {}, makeRequest())
    expect(result).toBeNull()
  })
})

describe('formatWebhookInput (generic/slack)', () => {
  it('wraps arbitrary payloads in webhook container', () => {
    const wh = { provider: 'slack', path: '/s', providerConfig: { x: 1 } }
    const wf = { id: 'wf-slack' }
    const body = { type: 'event_callback', event: { type: 'message' } }
    const req = makeRequest('POST', { 'x-custom': '1' })

    const result = formatWebhookInput(wh, wf, body, req)
    expect(result.webhook.data.provider).toBe('slack')
    expect(result.webhook.data.path).toBe('/s')
    expect(result.webhook.data.payload).toEqual(body)
    expect(result.webhook.data.method).toBe('POST')
    expect(result.webhook.data.headers['x-custom']).toBe('1')
    expect(result.workflowId).toBe('wf-slack')
  })

  it('handles generic providers', () => {
    const wh = { provider: 'generic', path: '/g', providerConfig: {} }
    const wf = { id: 'wf-g' }
    const result = formatWebhookInput(wh, wf, { any: 'data' }, makeRequest())
    expect(result.webhook.data.provider).toBe('generic')
    expect(result.webhook.data.payload).toEqual({ any: 'data' })
  })
})
