/**
 * Knowledge Sources System
 *
 * Centralized document management and semantic search for AI agents.
 *
 * Features:
 * - Document upload and storage (PDF, DOCX, TXT, MD, etc.)
 * - Automatic text extraction and chunking
 * - Semantic search with vector embeddings
 * - Access control (private, workspace, public)
 * - Agent integration
 *
 * Usage:
 * ```typescript
 * import { KnowledgeSourceService } from '@/lib/knowledge'
 *
 * const service = new KnowledgeSourceService(userId, workspaceId)
 *
 * // Create a knowledge source
 * const source = await service.createSource({
 *   name: 'Product Documentation',
 *   description: 'Official product docs',
 *   visibility: 'workspace'
 * })
 *
 * // Add documents
 * const doc = await service.addDocument({
 *   sourceId: source.id,
 *   name: 'user-guide.pdf',
 *   type: 'file',
 *   filePath: '/uploads/user-guide.pdf',
 *   fileSize: 1024000
 * })
 *
 * // Link to agent
 * await service.linkAgentToSource(agentId, workflowId, source.id)
 * ```
 */

export * from './types'
export * from './knowledge-source-service'
export * from './text-chunker'
export * from './embedding-service'
export * from './semantic-search-service'
export * from './entity-extraction-service'
