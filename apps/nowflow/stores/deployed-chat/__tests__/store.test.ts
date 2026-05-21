import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeployedChatStore } from '@/stores/deployed-chat/store'

// Mock safe-storage to avoid touching localStorage in node env
vi.mock('@/stores/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

const initialState = useDeployedChatStore.getState()

beforeEach(() => {
  useDeployedChatStore.setState(
    {
      ...initialState,
      messagesBySubdomain: {},
    },
    true
  )
  vi.restoreAllMocks()
})

describe('useDeployedChatStore - initial state', () => {
  it('starts with an empty map of messages', () => {
    expect(useDeployedChatStore.getState().messagesBySubdomain).toEqual({})
  })
})

describe('addMessage', () => {
  it('adds a message and returns its id', () => {
    const id = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'user', content: 'hello' })

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    const messages = useDeployedChatStore.getState().messagesBySubdomain['acme']
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe(id)
    expect(messages[0].type).toBe('user')
    expect(messages[0].content).toBe('hello')
    expect(messages[0].timestamp).toBeInstanceOf(Date)
  })

  it('prepends newer messages (most recent first)', () => {
    const id1 = useDeployedChatStore.getState().addMessage('acme', { type: 'user', content: 'one' })
    const id2 = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'assistant', content: 'two' })

    const messages = useDeployedChatStore.getState().messagesBySubdomain['acme']
    expect(messages.map((m) => m.id)).toEqual([id2, id1])
  })

  it('isolates messages per subdomain', () => {
    useDeployedChatStore.getState().addMessage('one', { type: 'user', content: 'a' })
    useDeployedChatStore.getState().addMessage('two', { type: 'user', content: 'b' })

    const state = useDeployedChatStore.getState()
    expect(state.messagesBySubdomain['one']).toHaveLength(1)
    expect(state.messagesBySubdomain['two']).toHaveLength(1)
    expect(state.messagesBySubdomain['one'][0].content).toBe('a')
    expect(state.messagesBySubdomain['two'][0].content).toBe('b')
  })

  it('caps message history at 100 messages per subdomain', () => {
    for (let i = 0; i < 105; i++) {
      useDeployedChatStore.getState().addMessage('acme', {
        type: 'user',
        content: `msg-${i}`,
      })
    }

    const messages = useDeployedChatStore.getState().messagesBySubdomain['acme']
    expect(messages).toHaveLength(100)
    // Most recent is at index 0
    expect(messages[0].content).toBe('msg-104')
    expect(messages[99].content).toBe('msg-5')
  })

  it('accepts object content', () => {
    const payload = { text: 'hi', meta: { tokens: 3 } }
    const id = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'assistant', content: payload })

    const stored = useDeployedChatStore.getState().messagesBySubdomain['acme'][0]
    expect(stored.id).toBe(id)
    expect(stored.content).toEqual(payload)
  })
})

describe('getMessages', () => {
  it('returns empty array for unknown subdomain', () => {
    expect(useDeployedChatStore.getState().getMessages('missing')).toEqual([])
  })

  it('returns messages in chronological order (oldest first)', () => {
    const id1 = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'user', content: 'first' })
    const id2 = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'assistant', content: 'second' })

    const ordered = useDeployedChatStore.getState().getMessages('acme')
    expect(ordered.map((m) => m.id)).toEqual([id1, id2])
  })

  it('does not mutate the underlying state array', () => {
    useDeployedChatStore.getState().addMessage('acme', { type: 'user', content: 'a' })
    useDeployedChatStore.getState().addMessage('acme', { type: 'user', content: 'b' })

    const before = useDeployedChatStore.getState().messagesBySubdomain['acme']
    const beforeOrder = before.map((m) => m.id)
    useDeployedChatStore.getState().getMessages('acme')
    const afterOrder = useDeployedChatStore.getState().messagesBySubdomain['acme'].map((m) => m.id)
    expect(afterOrder).toEqual(beforeOrder)
  })
})

describe('clearMessages', () => {
  it('removes all messages for a specific subdomain', () => {
    useDeployedChatStore.getState().addMessage('one', { type: 'user', content: 'a' })
    useDeployedChatStore.getState().addMessage('two', { type: 'user', content: 'b' })

    useDeployedChatStore.getState().clearMessages('one')

    const state = useDeployedChatStore.getState()
    expect(state.messagesBySubdomain['one']).toBeUndefined()
    expect(state.messagesBySubdomain['two']).toHaveLength(1)
  })

  it('is a no-op for a subdomain with no messages', () => {
    useDeployedChatStore.getState().addMessage('one', { type: 'user', content: 'a' })
    useDeployedChatStore.getState().clearMessages('unknown')

    expect(useDeployedChatStore.getState().messagesBySubdomain['one']).toHaveLength(1)
  })
})

describe('clearAllMessages', () => {
  it('removes messages across all subdomains', () => {
    useDeployedChatStore.getState().addMessage('one', { type: 'user', content: 'a' })
    useDeployedChatStore.getState().addMessage('two', { type: 'user', content: 'b' })

    useDeployedChatStore.getState().clearAllMessages()

    expect(useDeployedChatStore.getState().messagesBySubdomain).toEqual({})
  })
})

describe('appendMessageContent', () => {
  it('appends string content onto an existing message', () => {
    const id = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'assistant', content: 'Hello' })

    useDeployedChatStore.getState().appendMessageContent('acme', id, ', world')

    const message = useDeployedChatStore
      .getState()
      .messagesBySubdomain['acme'].find((m) => m.id === id)!
    expect(message.content).toBe('Hello, world')
  })

  it('coerces non-string content using String(...) when appending', () => {
    // Seed a message with object content directly so we can test the branch
    useDeployedChatStore.setState({
      messagesBySubdomain: {
        acme: [
          {
            id: 'm1',
            content: { foo: 'bar' },
            type: 'assistant',
            timestamp: new Date(),
          },
        ],
      },
    })

    useDeployedChatStore.getState().appendMessageContent('acme', 'm1', ' tail')

    const message = useDeployedChatStore
      .getState()
      .messagesBySubdomain['acme'].find((m) => m.id === 'm1')!
    // String({ foo: 'bar' }) yields '[object Object]'
    expect(message.content).toBe('[object Object] tail')
  })

  it('uses appended content directly when existing content is falsy', () => {
    useDeployedChatStore.setState({
      messagesBySubdomain: {
        acme: [
          {
            id: 'm1',
            // empty string is falsy for the else branch after type check
            content: '',
            type: 'assistant',
            timestamp: new Date(),
          },
        ],
      },
    })

    useDeployedChatStore.getState().appendMessageContent('acme', 'm1', 'first-chunk')

    const message = useDeployedChatStore
      .getState()
      .messagesBySubdomain['acme'].find((m) => m.id === 'm1')!
    // String concatenation path: '' + 'first-chunk' -> 'first-chunk'
    expect(message.content).toBe('first-chunk')
  })

  it('does not modify other messages in the same subdomain', () => {
    const id1 = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'assistant', content: 'A' })
    const id2 = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'assistant', content: 'B' })

    useDeployedChatStore.getState().appendMessageContent('acme', id1, 'X')

    const messages = useDeployedChatStore.getState().messagesBySubdomain['acme']
    const m1 = messages.find((m) => m.id === id1)!
    const m2 = messages.find((m) => m.id === id2)!
    expect(m1.content).toBe('AX')
    expect(m2.content).toBe('B')
  })

  it('is a no-op when subdomain is unknown', () => {
    useDeployedChatStore.getState().appendMessageContent('nope', 'any', 'x')
    expect(useDeployedChatStore.getState().messagesBySubdomain['nope']).toEqual([])
  })

  it('is a no-op when message id is unknown in a known subdomain', () => {
    const id = useDeployedChatStore
      .getState()
      .addMessage('acme', { type: 'assistant', content: 'original' })

    useDeployedChatStore.getState().appendMessageContent('acme', 'not-an-id', 'x')

    const messages = useDeployedChatStore.getState().messagesBySubdomain['acme']
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe(id)
    expect(messages[0].content).toBe('original')
  })
})
