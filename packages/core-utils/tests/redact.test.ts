import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../src/redact'

const MASK = '***REDACTED***'

describe('redactSecrets', () => {
  it('masks `apiKey` nested at multiple depths', () => {
    const input = {
      apiKey: 'top-secret',
      nested: {
        apiKey: 'nested-secret',
        deeper: {
          apiKey: 'deeper-secret',
          value: 'ok',
        },
      },
    }

    const out = redactSecrets(input) as any

    expect(out.apiKey).toBe(MASK)
    expect(out.nested.apiKey).toBe(MASK)
    expect(out.nested.deeper.apiKey).toBe(MASK)
    expect(out.nested.deeper.value).toBe('ok')
  })

  it('masks credentials inside arrays of objects', () => {
    const input = {
      connections: [
        { name: 'a', password: 'p1', token: 't1' },
        { name: 'b', password: 'p2', token: 't2' },
      ],
    }

    const out = redactSecrets(input) as any

    expect(Array.isArray(out.connections)).toBe(true)
    expect(out.connections[0].name).toBe('a')
    expect(out.connections[0].password).toBe(MASK)
    expect(out.connections[0].token).toBe(MASK)
    expect(out.connections[1].password).toBe(MASK)
    expect(out.connections[1].token).toBe(MASK)
  })

  it('handles circular references without infinite loop', () => {
    const input: any = { name: 'x', apiKey: 'secret' }
    input.self = input

    const out = redactSecrets(input) as any

    expect(out.name).toBe('x')
    expect(out.apiKey).toBe(MASK)
    expect(out.self).toBe('[Circular]')
  })

  it('handles circular references inside arrays', () => {
    const inner: any = { password: 'p' }
    inner.back = inner
    const input = { list: [inner] }

    const out = redactSecrets(input) as any

    expect(out.list[0].password).toBe(MASK)
    expect(out.list[0].back).toBe('[Circular]')
  })

  it('accepts a custom `keys` list as an override', () => {
    const input = { mySecretField: 'hide-me', apiKey: 'exposed-now', name: 'bob' }

    const out = redactSecrets(input, ['mysecretfield']) as any

    expect(out.mySecretField).toBe(MASK)
    // Default list not applied when override provided.
    expect(out.apiKey).toBe('exposed-now')
    expect(out.name).toBe('bob')
  })

  it('allows non-sensitive keys to pass through unchanged', () => {
    const input = {
      name: 'alice',
      description: 'some description',
      userId: 'u_123',
    }

    const out = redactSecrets(input) as any

    expect(out.name).toBe('alice')
    expect(out.description).toBe('some description')
    expect(out.userId).toBe('u_123')
  })

  it('returns primitives as-is', () => {
    expect(redactSecrets('hello')).toBe('hello')
    expect(redactSecrets(42)).toBe(42)
    expect(redactSecrets(true)).toBe(true)
    expect(redactSecrets(null)).toBe(null)
    expect(redactSecrets(undefined)).toBe(undefined)
  })

  it('matches key names case-insensitively', () => {
    const input = { APIKEY: 'a', Api_Key: 'b', ApiKey: 'c' }

    const out = redactSecrets(input) as any

    expect(out.APIKEY).toBe(MASK)
    expect(out.Api_Key).toBe(MASK)
    expect(out.ApiKey).toBe(MASK)
  })

  it('masks keys with sensitive substrings', () => {
    const input = { myApiKey: 'x', userToken: 'y', dbPassword: 'z' }

    const out = redactSecrets(input) as any

    expect(out.myApiKey).toBe(MASK)
    expect(out.userToken).toBe(MASK)
    expect(out.dbPassword).toBe(MASK)
  })

  it('does not mutate the original object', () => {
    const input = { apiKey: 'secret', nested: { token: 'tok' } }

    redactSecrets(input)

    expect(input.apiKey).toBe('secret')
    expect(input.nested.token).toBe('tok')
  })
})
