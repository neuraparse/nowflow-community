import { describe, expect, it } from 'vitest'
import { buildAnthropicRequestBody } from '../provider-streaming'

const shortPrompt = 'You are a helpful assistant.'
// Large enough to cross the ~1024-token heuristic (>= 4096 chars).
const largePrompt = 'system context. '.repeat(400)
const largeCatalog = 'block catalog entry. '.repeat(400)

describe('buildAnthropicRequestBody (prompt caching wire)', () => {
  it('keeps plain-string system shape when caching is not triggered', () => {
    const { body, cachedBlocks } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: shortPrompt,
      temperature: 0.7,
      maxTokens: 1000,
    })

    expect(cachedBlocks).toBe(0)
    expect(body.system).toBe(shortPrompt)
    // No cache_control anywhere in the serialized request.
    expect(JSON.stringify(body)).not.toContain('cache_control')
    // Legacy shape preserved.
    expect(body.stream).toBe(true)
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('auto-enables ephemeral cache_control when system prompt exceeds heuristic', () => {
    const { body, cachedBlocks } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: largePrompt,
      temperature: 0.7,
      maxTokens: 1000,
    })

    expect(cachedBlocks).toBe(1)
    expect(Array.isArray(body.system)).toBe(true)
    const blocks = body.system as Array<{
      type: string
      text: string
      cache_control?: { type: string }
    }>
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'text',
      text: largePrompt,
      cache_control: { type: 'ephemeral' },
    })
  })

  it('adds a second cached block when staticContext (tool/block catalog) is provided', () => {
    const { body, cachedBlocks } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [{ role: 'user', content: 'build workflow' }],
      systemPrompt: largePrompt,
      temperature: 0.5,
      maxTokens: 2000,
      options: { staticContext: largeCatalog, cacheHint: 'ephemeral' },
    })

    expect(cachedBlocks).toBe(2)
    const blocks = body.system as Array<{
      type: string
      text: string
      cache_control?: { type: string }
    }>
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toBe(largePrompt)
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[1].text).toBe(largeCatalog)
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('does not cache user messages (dynamic content)', () => {
    const { body } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'thanks' },
      ],
      systemPrompt: largePrompt,
      temperature: 0.7,
      maxTokens: 1000,
    })

    for (const msg of body.messages) {
      expect(typeof msg.content).toBe('string')
      expect(JSON.stringify(msg)).not.toContain('cache_control')
    }
  })

  it('respects explicit cacheHint=ephemeral even for short prompts', () => {
    const { body, cachedBlocks } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: shortPrompt,
      temperature: 0.7,
      maxTokens: 1000,
      options: { cacheHint: 'ephemeral' },
    })

    expect(cachedBlocks).toBe(1)
    const blocks = body.system as Array<{ cache_control?: { type: string } }>
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('disables caching when cacheHint is explicitly null, even for large prompts', () => {
    const { body, cachedBlocks } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: largePrompt,
      temperature: 0.7,
      maxTokens: 1000,
      options: { cacheHint: null },
    })

    expect(cachedBlocks).toBe(0)
    expect(typeof body.system).toBe('string')
    expect(JSON.stringify(body)).not.toContain('cache_control')
  })

  it('omits system when both systemPrompt and staticContext are empty', () => {
    const { body, cachedBlocks } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: 1000,
    })

    expect(cachedBlocks).toBe(0)
    expect('system' in body).toBe(false)
  })

  it('merges inline system-role messages into the cached primary block', () => {
    const { body, cachedBlocks } = buildAnthropicRequestBody({
      model: 'claude-opus-4-7',
      messages: [
        { role: 'system', content: 'extra rule A' },
        { role: 'user', content: 'hi' },
      ],
      systemPrompt: largePrompt,
      temperature: 0.7,
      maxTokens: 1000,
    })

    expect(cachedBlocks).toBe(1)
    const blocks = body.system as Array<{ text: string }>
    expect(blocks[0].text).toContain(largePrompt)
    expect(blocks[0].text).toContain('extra rule A')
    // system-role messages must not leak into the outbound messages array.
    expect(body.messages.every((m) => m.role !== 'system')).toBe(true)
  })
})
