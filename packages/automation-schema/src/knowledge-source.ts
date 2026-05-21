import { z } from 'zod'

/**
 * L2 KnowledgeSource contract.
 *
 * Represents an ingestible corpus (file upload, crawled URL, SaaS integration)
 * that is chunked and embedded for retrieval by agent profiles. The executor
 * resolves `knowledgeSourceIds` on an agent profile to these records.
 */
export const KnowledgeSourceKindSchema = z.enum([
  'file',
  'url',
  'notion',
  'confluence',
  'gdrive',
  'text',
])
export type KnowledgeSourceKind = z.infer<typeof KnowledgeSourceKindSchema>

export const ChunkingStrategySchema = z.enum(['semantic', 'fixed', 'markdown'])
export type ChunkingStrategy = z.infer<typeof ChunkingStrategySchema>

export const KnowledgeSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  kind: KnowledgeSourceKindSchema,
  sourceConfig: z.record(z.string(), z.unknown()),
  chunkingStrategy: ChunkingStrategySchema,
  embeddingModel: z.string(),
  workspaceId: z.string(),
  createdAt: z.string(),
})
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>
