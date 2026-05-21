import { describe, expect, it, vi } from 'vitest'
import { PineconeBlock } from '../pinecone'

vi.mock('@/components/icons', () => ({ PineconeIcon: () => null }))

describe('PineconeBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(PineconeBlock).toBeDefined()
    expect(typeof PineconeBlock.type).toBe('string')
    expect(typeof PineconeBlock.name).toBe('string')
    expect(PineconeBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(PineconeBlock.subBlocks)).toBe(true)
    expect(PineconeBlock.tools).toBeDefined()
  })

  it('has type matching filename (pinecone)', () => {
    expect(PineconeBlock.type).toBe('pinecone')
  })

  it('exposes all five pinecone tools in access list', () => {
    expect(PineconeBlock.tools.access).toEqual(
      expect.arrayContaining([
        'pinecone_generate_embeddings',
        'pinecone_upsert_text',
        'pinecone_search_text',
        'pinecone_search_vector',
        'pinecone_fetch',
      ])
    )
  })

  it('tool selector dispatches based on operation', () => {
    const tool = PineconeBlock.tools.config!.tool
    expect(tool({ operation: 'generate' })).toBe('pinecone_generate_embeddings')
    expect(tool({ operation: 'upsert_text' })).toBe('pinecone_upsert_text')
    expect(tool({ operation: 'search_text' })).toBe('pinecone_search_text')
    expect(tool({ operation: 'search_vector' })).toBe('pinecone_search_vector')
    expect(tool({ operation: 'fetch' })).toBe('pinecone_fetch')
  })

  it('tool selector throws on unknown operation', () => {
    const tool = PineconeBlock.tools.config!.tool
    expect(() => tool({ operation: 'invalid_op' })).toThrow(/Invalid operation/)
    expect(() => tool({})).toThrow(/Invalid operation/)
  })

  it('declares apiKey as a password subBlock', () => {
    const apiKey = PineconeBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect(apiKey).toBeDefined()
    expect((apiKey as any).password).toBe(true)
  })
})
