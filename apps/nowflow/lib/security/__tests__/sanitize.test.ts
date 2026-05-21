import { describe, expect, it, vi } from 'vitest'
import { deepSanitize, sanitizeWorkflowState, SENSITIVE_FIELD_PATTERNS } from '../sanitize'

const REDACTED = '***REDACTED***'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

const buildState = (subBlocks: Record<string, { value: unknown }>) => ({
  blocks: {
    blockA: {
      id: 'blockA',
      type: 'api_call',
      subBlocks,
    },
  },
  edges: [],
  meta: { name: 'wf' },
})

describe('sanitizeWorkflowState', () => {
  it('clears common credential fields (apiKey/token/password/secret/authorization)', () => {
    const state = buildState({
      apiKey: { value: 'live-key' },
      token: { value: 'github-token-value' },
      password: { value: 'hunter2' },
      secret: { value: 'super-secret' },
      authorization: { value: 'Bearer XXX' },
      message: { value: 'Hello world' },
    })

    const out = sanitizeWorkflowState(state)

    expect(out.blocks.blockA.subBlocks.apiKey.value).toBe('')
    expect(out.blocks.blockA.subBlocks.token.value).toBe('')
    expect(out.blocks.blockA.subBlocks.password.value).toBe('')
    expect(out.blocks.blockA.subBlocks.secret.value).toBe('')
    expect(out.blocks.blockA.subBlocks.authorization.value).toBe('')
    // non-sensitive field retained
    expect(out.blocks.blockA.subBlocks.message.value).toBe('Hello world')
  })

  it('clears credential-like keys case-insensitively and via substring match', () => {
    const state = buildState({
      ApiKey: { value: 'AAA' },
      ACCESS_TOKEN: { value: 'BBB' },
      myPrivateKey: { value: 'CCC' },
      client_secret: { value: 'DDD' },
      connectionString: { value: 'postgres://u:p@h/db' },
    })

    const out = sanitizeWorkflowState(state)

    expect(out.blocks.blockA.subBlocks.ApiKey.value).toBe('')
    expect(out.blocks.blockA.subBlocks.ACCESS_TOKEN.value).toBe('')
    expect(out.blocks.blockA.subBlocks.myPrivateKey.value).toBe('')
    expect(out.blocks.blockA.subBlocks.client_secret.value).toBe('')
    expect(out.blocks.blockA.subBlocks.connectionString.value).toBe('')
  })

  it('does not mutate the input object (deep clone)', () => {
    const state = buildState({ apiKey: { value: 'original-key' } })
    const snapshot = JSON.stringify(state)
    sanitizeWorkflowState(state)
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('returns null/undefined unchanged', () => {
    expect(sanitizeWorkflowState(null as any)).toBeNull()
    expect(sanitizeWorkflowState(undefined as any)).toBeUndefined()
  })

  it('returns primitive state unchanged', () => {
    expect(sanitizeWorkflowState('hello' as any)).toBe('hello')
    expect(sanitizeWorkflowState(42 as any)).toBe(42)
  })

  it('leaves state without blocks intact', () => {
    const state = { meta: { name: 'empty' } }
    const out = sanitizeWorkflowState(state)
    expect(out).toEqual(state)
    expect(out).not.toBe(state) // still cloned
  })

  it('leaves empty-string / falsy sensitive values alone (no log spam)', () => {
    const state = buildState({
      apiKey: { value: '' },
      token: { value: null },
    })
    const out = sanitizeWorkflowState(state)
    expect(out.blocks.blockA.subBlocks.apiKey.value).toBe('')
    expect(out.blocks.blockA.subBlocks.token.value).toBeNull()
  })

  it('handles blocks missing subBlocks gracefully', () => {
    const state = {
      blocks: {
        naked: { id: 'naked', type: 'starter' },
      },
    }
    expect(() => sanitizeWorkflowState(state)).not.toThrow()
  })

  it('exports the sensitive field pattern list for auditing', () => {
    expect(SENSITIVE_FIELD_PATTERNS).toContain('apikey')
    expect(SENSITIVE_FIELD_PATTERNS).toContain('password')
    expect(SENSITIVE_FIELD_PATTERNS).toContain('token')
    expect(SENSITIVE_FIELD_PATTERNS).toContain('secret')
    expect(SENSITIVE_FIELD_PATTERNS).toContain('authorization')
  })

  // ---------------------------------------------------------------------------
  // Shape-agnostic deep-walk cases (appended)
  // ---------------------------------------------------------------------------

  it('masks top-level apiKey at the root of the state object', () => {
    const state = { apiKey: 'root-key', name: 'wf' } as any
    const out = sanitizeWorkflowState(state)
    expect(out.apiKey).toBe(REDACTED)
    expect(out.name).toBe('wf')
  })

  it('masks deeply nested credentials in custom block shapes', () => {
    const state = {
      config: { auth: { bearerToken: 'super-secret' } },
      blocks: {
        x: {
          id: 'x',
          customConfig: {
            transport: { headers: { authorization: 'Bearer ZZZ' } },
          },
        },
      },
    } as any

    const out = sanitizeWorkflowState(state)
    expect(out.config.auth.bearerToken).toBe(REDACTED)
    expect(out.blocks.x.customConfig.transport.headers.authorization).toBe(REDACTED)
  })

  it('masks credentials inside arrays of objects at odd paths', () => {
    const state = {
      integrations: [
        { name: 'a', apiKey: 'key-A' },
        { name: 'b', nested: [{ access_token: 'tok-B' }] },
      ],
    } as any

    const out = sanitizeWorkflowState(state)
    expect(out.integrations[0].apiKey).toBe(REDACTED)
    expect(out.integrations[0].name).toBe('a')
    expect(out.integrations[1].nested[0].access_token).toBe(REDACTED)
  })

  it('handles circular references without infinite loops', () => {
    const state: any = { name: 'wf', apiKey: 'root-secret' }
    state.self = state
    state.ring = { back: state }

    expect(() => sanitizeWorkflowState(state)).not.toThrow()
    const out = sanitizeWorkflowState(state)
    expect(out.apiKey).toBe(REDACTED)
    // Circular link preserved as an object (not infinite depth).
    expect(typeof out.self).toBe('object')
    expect(typeof out.ring.back).toBe('object')
  })

  it('passes Map and Set values through (cloned, with masking only on string Map keys)', () => {
    const inner = new Map<string, unknown>([
      ['apiKey', 'should-mask'],
      ['label', 'keep-me'],
    ])
    const tags = new Set(['a', 'b'])
    const out = deepSanitize({ inner, tags })

    expect(out.inner).toBeInstanceOf(Map)
    expect(out.inner).not.toBe(inner)
    expect(out.inner.get('apiKey')).toBe(REDACTED)
    expect(out.inner.get('label')).toBe('keep-me')

    expect(out.tags).toBeInstanceOf(Set)
    expect(out.tags).not.toBe(tags)
    expect(Array.from(out.tags).sort()).toEqual(['a', 'b'])
  })

  it('preserves lookalike safe keys (apiUrl, tokenType, secretName)', () => {
    const state = {
      apiUrl: 'https://api.example.com',
      tokenType: 'Bearer',
      secretName: 'my-vault-ref',
      credentialName: 'prod-cred',
      authorizationUrl: 'https://auth.example.com/authorize',
    } as any

    const out = sanitizeWorkflowState(state)
    expect(out.apiUrl).toBe('https://api.example.com')
    expect(out.tokenType).toBe('Bearer')
    expect(out.secretName).toBe('my-vault-ref')
    expect(out.credentialName).toBe('prod-cred')
    expect(out.authorizationUrl).toBe('https://auth.example.com/authorize')
  })

  it('supports additionalKeys option to extend the sensitive pattern list', () => {
    const state = {
      dbUrl: 'postgres://u:p@h/db',
      customThing: 'normal',
    } as any

    // Default list should not mask dbUrl.
    const defaultOut = sanitizeWorkflowState(state)
    expect(defaultOut.dbUrl).toBe('postgres://u:p@h/db')

    // With additionalKeys, dbUrl is masked.
    const extendedOut = sanitizeWorkflowState(state, { additionalKeys: ['dburl'] })
    expect(extendedOut.dbUrl).toBe(REDACTED)
    expect(extendedOut.customThing).toBe('normal')
  })

  it('deepSanitize pass-through for Dates and primitives', () => {
    const d = new Date('2024-01-01T00:00:00Z')
    const out = deepSanitize({ when: d, count: 5, on: true, name: 'ok', empty: null })
    expect(out.when).toBeInstanceOf(Date)
    expect((out.when as Date).getTime()).toBe(d.getTime())
    expect(out.count).toBe(5)
    expect(out.on).toBe(true)
    expect(out.name).toBe('ok')
    expect(out.empty).toBeNull()
  })

  it('does not mask sensitive keys whose value is a non-primitive object', () => {
    // A nested structure under a "secret" key should not be wholesale masked —
    // we recurse into it and only mask primitives at their own key sites.
    const state = {
      secret: { nestedSafe: 'keep', nestedApiKey: 'mask-me' },
    } as any
    const out = sanitizeWorkflowState(state)
    expect(typeof out.secret).toBe('object')
    expect(out.secret.nestedSafe).toBe('keep')
    expect(out.secret.nestedApiKey).toBe(REDACTED)
  })
})
