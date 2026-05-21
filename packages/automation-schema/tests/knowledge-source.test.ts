import { describe, expect, it } from 'vitest'
import {
  ChunkingStrategySchema,
  KnowledgeSourceKindSchema,
  KnowledgeSourceSchema,
} from '../src/knowledge-source'

const base = {
  id: 'ks1',
  name: 'Docs',
  sourceConfig: {},
  chunkingStrategy: 'semantic' as const,
  embeddingModel: 'text-embedding-3-small',
  workspaceId: 'ws1',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('KnowledgeSourceKindSchema', () => {
  it('accepts all 6 kinds', () => {
    for (const kind of ['file', 'url', 'notion', 'confluence', 'gdrive', 'text']) {
      expect(KnowledgeSourceKindSchema.safeParse(kind).success).toBe(true)
    }
  })

  it('rejects an unknown kind', () => {
    expect(KnowledgeSourceKindSchema.safeParse('slack').success).toBe(false)
  })
})

describe('ChunkingStrategySchema', () => {
  it('accepts semantic/fixed/markdown', () => {
    for (const s of ['semantic', 'fixed', 'markdown']) {
      expect(ChunkingStrategySchema.safeParse(s).success).toBe(true)
    }
  })

  it('rejects an unknown strategy', () => {
    expect(ChunkingStrategySchema.safeParse('paragraph').success).toBe(false)
  })
})

describe('KnowledgeSourceSchema', () => {
  it('parses each of the 6 kinds', () => {
    for (const kind of ['file', 'url', 'notion', 'confluence', 'gdrive', 'text'] as const) {
      const parsed = KnowledgeSourceSchema.parse({ ...base, kind })
      expect(parsed.kind).toBe(kind)
    }
  })

  it('fails when id is missing', () => {
    const { id: _omit, ...bad } = { ...base, kind: 'file' as const }
    expect(KnowledgeSourceSchema.safeParse(bad).success).toBe(false)
  })

  it('fails when workspaceId is missing', () => {
    const { workspaceId: _omit, ...bad } = { ...base, kind: 'file' as const }
    expect(KnowledgeSourceSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects an invalid chunkingStrategy', () => {
    const result = KnowledgeSourceSchema.safeParse({
      ...base,
      kind: 'file',
      chunkingStrategy: 'paragraph',
    })
    expect(result.success).toBe(false)
  })

  it('accepts an ISO timestamp for createdAt', () => {
    const parsed = KnowledgeSourceSchema.parse({
      ...base,
      kind: 'url',
      createdAt: '2026-04-24T12:34:56.789Z',
    })
    expect(parsed.createdAt).toBe('2026-04-24T12:34:56.789Z')
  })

  it('accepts an optional description', () => {
    const parsed = KnowledgeSourceSchema.parse({
      ...base,
      kind: 'text',
      description: 'Pasted docs',
    })
    expect(parsed.description).toBe('Pasted docs')
  })

  it('rejects a non-string createdAt', () => {
    const result = KnowledgeSourceSchema.safeParse({
      ...base,
      kind: 'file',
      createdAt: 1234567890,
    })
    expect(result.success).toBe(false)
  })
})
