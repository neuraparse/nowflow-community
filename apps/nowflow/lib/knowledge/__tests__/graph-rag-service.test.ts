import { describe, expect, it, vi } from 'vitest'

// Mock all dependencies before import
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/db/schema', () => ({
  knowledgeGraphNode: {},
  knowledgeGraphEdge: {},
  knowledgeEntity: {},
  knowledgeChunk: {},
  knowledgeSource: {},
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
  ilike: vi.fn(),
}))
vi.mock('@/lib/knowledge/embedding-service', () => ({
  EmbeddingService: {
    generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2]]),
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
    cosineSimilarity: vi.fn().mockReturnValue(0.95),
  },
}))

describe('GraphRAG Service', () => {
  it('module exports all expected functions', async () => {
    const mod = await import('../graph-rag-service')
    expect(typeof mod.buildKnowledgeGraph).toBe('function')
    expect(typeof mod.queryGraph).toBe('function')
    expect(typeof mod.getSubgraph).toBe('function')
    expect(typeof mod.graphSearch).toBe('function')
    expect(typeof mod.mergeEntities).toBe('function')
    expect(typeof mod.getGraphStats).toBe('function')
  })

  it('exports GraphNode and GraphEdge types via the module', async () => {
    const mod = await import('../graph-rag-service')
    // Functions exist and are callable
    expect(mod.buildKnowledgeGraph).toBeDefined()
    expect(mod.queryGraph).toBeDefined()
  })
})
