import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import {
  knowledgeChunk,
  knowledgeEntity,
  knowledgeGraphEdge,
  knowledgeGraphNode,
  knowledgeSource,
} from '@/db/schema'
import { EmbeddingService } from './embedding-service'
import type { EmbeddingModel } from './types'

const logger = createLogger('GraphRAG')

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string
  name: string
  type: string
  properties: Record<string, any>
  metadata: Record<string, any>
}

export interface GraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relationship: string
  weight: number
  properties: Record<string, any>
}

export interface GraphSearchResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  chunks: Array<{
    id: string
    content: string
    score: number
    sourceId: string
  }>
  confidence: number
}

export interface GraphStats {
  nodeCount: number
  edgeCount: number
  nodeTypes: Record<string, number>
  relationshipTypes: Record<string, number>
  avgDegree: number
}

// Relationship inference rules based on entity co-occurrence
const RELATIONSHIP_RULES: Record<string, Record<string, string>> = {
  person: {
    organization: 'affiliated_with',
    location: 'located_in',
    technology: 'works_with',
    product: 'associated_with',
    event: 'participated_in',
  },
  organization: {
    location: 'headquartered_in',
    technology: 'uses',
    product: 'produces',
    event: 'involved_in',
  },
  technology: {
    product: 'used_in',
    concept: 'implements',
  },
}

// ─── Graph RAG Service ──────────────────────────────────────────────────────

/**
 * Build a knowledge graph from extracted entities in a knowledge source.
 * Creates nodes from entities and infers edges from co-occurrence in chunks.
 */
export async function buildKnowledgeGraph(sourceId: string): Promise<{
  nodesCreated: number
  edgesCreated: number
}> {
  const startTime = Date.now()
  logger.info('Building knowledge graph', { sourceId })

  // Fetch source config for embedding model
  const [source] = await db
    .select({ embeddingModel: knowledgeSource.embeddingModel })
    .from(knowledgeSource)
    .where(eq(knowledgeSource.id, sourceId))
    .limit(1)

  if (!source) {
    throw new Error(`Knowledge source not found: ${sourceId}`)
  }

  // Fetch all entities for this source
  const entities = await db
    .select()
    .from(knowledgeEntity)
    .where(eq(knowledgeEntity.sourceId, sourceId))

  if (entities.length === 0) {
    logger.info('No entities found, skipping graph build', { sourceId })
    return { nodesCreated: 0, edgesCreated: 0 }
  }

  // Clear existing graph data for this source
  const existingNodes = await db
    .select({ id: knowledgeGraphNode.id })
    .from(knowledgeGraphNode)
    .where(eq(knowledgeGraphNode.sourceId, sourceId))

  if (existingNodes.length > 0) {
    const nodeIds = existingNodes.map((n: { id: string }) => n.id)
    await db
      .delete(knowledgeGraphEdge)
      .where(
        or(
          inArray(knowledgeGraphEdge.sourceNodeId, nodeIds),
          inArray(knowledgeGraphEdge.targetNodeId, nodeIds)
        )
      )
    await db.delete(knowledgeGraphNode).where(eq(knowledgeGraphNode.sourceId, sourceId))
  }

  // Deduplicate entities by name+label (across documents)
  const entityMap = new Map<
    string,
    {
      name: string
      type: string
      score: number
      occurrences: number
      chunkIndices: number[]
      documentIds: string[]
    }
  >()

  for (const entity of entities) {
    const key = `${entity.label}::${entity.entityText.toLowerCase().trim()}`
    const existing = entityMap.get(key)
    if (existing) {
      existing.occurrences += entity.occurrenceCount
      existing.score = Math.max(existing.score, entity.score)
      if (entity.chunkIndices) {
        existing.chunkIndices.push(...entity.chunkIndices)
      }
      if (!existing.documentIds.includes(entity.documentId)) {
        existing.documentIds.push(entity.documentId)
      }
    } else {
      entityMap.set(key, {
        name: entity.entityText,
        type: entity.label,
        score: entity.score,
        occurrences: entity.occurrenceCount,
        chunkIndices: entity.chunkIndices ? [...entity.chunkIndices] : [],
        documentIds: [entity.documentId],
      })
    }
  }

  // Generate embeddings for node names and create nodes
  const entityEntries = Array.from(entityMap.values())
  const nodeNames = entityEntries.map((e) => e.name)
  const embeddingModel = (source.embeddingModel || 'ollama-nomic-embed-text') as EmbeddingModel

  let embeddings: number[][] = []
  try {
    embeddings = await EmbeddingService.generateEmbeddings(nodeNames, embeddingModel)
  } catch (error: any) {
    logger.warn('Failed to generate node embeddings, continuing without', {
      error: error?.message,
    })
    embeddings = nodeNames.map(() => [])
  }

  // Insert nodes
  const nodeRows = entityEntries.map((entry, i) => ({
    sourceId,
    name: entry.name,
    type: entry.type,
    properties: {
      score: entry.score,
      occurrences: entry.occurrences,
    },
    embedding: embeddings[i]?.length > 0 ? embeddings[i] : null,
    metadata: {
      documentIds: entry.documentIds,
      chunkIndices: [...new Set(entry.chunkIndices)],
    },
  }))

  const insertedNodes = await db.insert(knowledgeGraphNode).values(nodeRows).returning({
    id: knowledgeGraphNode.id,
    name: knowledgeGraphNode.name,
    type: knowledgeGraphNode.type,
  })

  // Build a lookup for node IDs
  const nodeLookup = new Map<string, string>()
  for (const node of insertedNodes) {
    nodeLookup.set(`${node.type}::${node.name.toLowerCase().trim()}`, node.id)
  }

  // Infer edges from co-occurrence in the same chunks
  const edgeSet = new Map<
    string,
    {
      sourceNodeId: string
      targetNodeId: string
      relationship: string
      weight: number
      coOccurrences: number
    }
  >()

  for (const entryA of entityEntries) {
    for (const entryB of entityEntries) {
      if (entryA === entryB) continue

      const keyA = `${entryA.type}::${entryA.name.toLowerCase().trim()}`
      const keyB = `${entryB.type}::${entryB.name.toLowerCase().trim()}`
      const nodeIdA = nodeLookup.get(keyA)
      const nodeIdB = nodeLookup.get(keyB)
      if (!nodeIdA || !nodeIdB) continue

      // Check chunk co-occurrence
      const chunksA = new Set(entryA.chunkIndices)
      const sharedChunks = entryB.chunkIndices.filter((c) => chunksA.has(c))
      if (sharedChunks.length === 0) continue

      // Determine relationship type
      const relationship = inferRelationship(entryA.type, entryB.type)
      const edgeKey = [nodeIdA, nodeIdB, relationship].sort().join('::')

      const existing = edgeSet.get(edgeKey)
      if (existing) {
        existing.coOccurrences += sharedChunks.length
        existing.weight = Math.min(existing.coOccurrences / 10, 1.0)
      } else {
        edgeSet.set(edgeKey, {
          sourceNodeId: nodeIdA,
          targetNodeId: nodeIdB,
          relationship,
          weight: Math.min(sharedChunks.length / 10, 1.0),
          coOccurrences: sharedChunks.length,
        })
      }
    }
  }

  // Insert edges
  let edgesCreated = 0
  if (edgeSet.size > 0) {
    const edgeRows = Array.from(edgeSet.values()).map((edge) => ({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      relationship: edge.relationship,
      weight: edge.weight,
      properties: { coOccurrences: edge.coOccurrences },
      metadata: {},
    }))

    await db.insert(knowledgeGraphEdge).values(edgeRows)
    edgesCreated = edgeRows.length
  }

  const elapsed = Date.now() - startTime
  logger.info('Knowledge graph built', {
    sourceId,
    nodesCreated: insertedNodes.length,
    edgesCreated,
    elapsed: `${elapsed}ms`,
  })

  return { nodesCreated: insertedNodes.length, edgesCreated }
}

/**
 * Query the knowledge graph to find relevant nodes and their neighborhoods.
 */
export async function queryGraph(
  sourceId: string,
  query: string,
  maxNodes: number = 20
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  // Find nodes matching the query by name similarity
  const matchingNodes = await db
    .select({
      id: knowledgeGraphNode.id,
      name: knowledgeGraphNode.name,
      type: knowledgeGraphNode.type,
      properties: knowledgeGraphNode.properties,
      metadata: knowledgeGraphNode.metadata,
    })
    .from(knowledgeGraphNode)
    .where(
      and(eq(knowledgeGraphNode.sourceId, sourceId), ilike(knowledgeGraphNode.name, `%${query}%`))
    )
    .limit(maxNodes)

  if (matchingNodes.length === 0) {
    return { nodes: [], edges: [] }
  }

  type MatchingNode = (typeof matchingNodes)[number]
  const nodeIds = matchingNodes.map((n: MatchingNode) => n.id)

  // Get edges connecting these nodes and their neighbors
  const edges = await db
    .select({
      id: knowledgeGraphEdge.id,
      sourceNodeId: knowledgeGraphEdge.sourceNodeId,
      targetNodeId: knowledgeGraphEdge.targetNodeId,
      relationship: knowledgeGraphEdge.relationship,
      weight: knowledgeGraphEdge.weight,
      properties: knowledgeGraphEdge.properties,
    })
    .from(knowledgeGraphEdge)
    .where(
      or(
        inArray(knowledgeGraphEdge.sourceNodeId, nodeIds),
        inArray(knowledgeGraphEdge.targetNodeId, nodeIds)
      )
    )

  // Collect neighbor node IDs
  const neighborIds = new Set<string>()
  for (const edge of edges) {
    neighborIds.add(edge.sourceNodeId)
    neighborIds.add(edge.targetNodeId)
  }
  // Remove already-fetched nodes
  for (const id of nodeIds) neighborIds.delete(id)

  let neighborNodes: typeof matchingNodes = []
  if (neighborIds.size > 0) {
    neighborNodes = await db
      .select({
        id: knowledgeGraphNode.id,
        name: knowledgeGraphNode.name,
        type: knowledgeGraphNode.type,
        properties: knowledgeGraphNode.properties,
        metadata: knowledgeGraphNode.metadata,
      })
      .from(knowledgeGraphNode)
      .where(inArray(knowledgeGraphNode.id, Array.from(neighborIds)))
  }

  const allNodes = [...matchingNodes, ...neighborNodes].map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    properties: (n.properties as Record<string, any>) || {},
    metadata: (n.metadata as Record<string, any>) || {},
  }))

  type EdgeRow = (typeof edges)[number]
  const allEdges = edges.map((e: EdgeRow) => ({
    id: e.id,
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    relationship: e.relationship,
    weight: e.weight,
    properties: (e.properties as Record<string, any>) || {},
  }))

  return { nodes: allNodes, edges: allEdges }
}

/**
 * Get a subgraph around a specific node or topic.
 */
export async function getSubgraph(
  sourceId: string,
  centerNodeId: string,
  depth: number = 2,
  maxNodes: number = 50
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const visitedNodeIds = new Set<string>()
  const allEdges: GraphEdge[] = []
  let currentIds = [centerNodeId]

  for (let d = 0; d < depth && currentIds.length > 0; d++) {
    for (const id of currentIds) visitedNodeIds.add(id)

    if (visitedNodeIds.size >= maxNodes) break

    const edges = await db
      .select({
        id: knowledgeGraphEdge.id,
        sourceNodeId: knowledgeGraphEdge.sourceNodeId,
        targetNodeId: knowledgeGraphEdge.targetNodeId,
        relationship: knowledgeGraphEdge.relationship,
        weight: knowledgeGraphEdge.weight,
        properties: knowledgeGraphEdge.properties,
      })
      .from(knowledgeGraphEdge)
      .where(
        or(
          inArray(knowledgeGraphEdge.sourceNodeId, currentIds),
          inArray(knowledgeGraphEdge.targetNodeId, currentIds)
        )
      )

    const nextIds: string[] = []
    for (const edge of edges) {
      allEdges.push({
        id: edge.id,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        relationship: edge.relationship,
        weight: edge.weight,
        properties: (edge.properties as Record<string, any>) || {},
      })
      if (!visitedNodeIds.has(edge.sourceNodeId)) nextIds.push(edge.sourceNodeId)
      if (!visitedNodeIds.has(edge.targetNodeId)) nextIds.push(edge.targetNodeId)
    }

    currentIds = [...new Set(nextIds)].slice(0, maxNodes - visitedNodeIds.size)
  }

  // Fetch all visited nodes
  const nodeIdList = Array.from(visitedNodeIds)
  const nodes =
    nodeIdList.length > 0
      ? await db
          .select({
            id: knowledgeGraphNode.id,
            name: knowledgeGraphNode.name,
            type: knowledgeGraphNode.type,
            properties: knowledgeGraphNode.properties,
            metadata: knowledgeGraphNode.metadata,
          })
          .from(knowledgeGraphNode)
          .where(inArray(knowledgeGraphNode.id, nodeIdList))
      : []

  type NodeRow = {
    id: string
    name: string
    type: string
    properties: unknown
    metadata: unknown
  }
  return {
    nodes: nodes.map((n: NodeRow) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      properties: (n.properties as Record<string, any>) || {},
      metadata: (n.metadata as Record<string, any>) || {},
    })),
    edges: deduplicateEdges(allEdges),
  }
}

/**
 * Combine vector search with graph traversal for enhanced RAG.
 * Finds relevant chunks via embedding similarity, then expands context
 * using the knowledge graph to include related entities.
 */
export async function graphSearch(
  sourceId: string,
  query: string,
  maxResults: number = 10
): Promise<GraphSearchResult> {
  const startTime = Date.now()

  // Step 1: Get source config
  const [source] = await db
    .select({ embeddingModel: knowledgeSource.embeddingModel })
    .from(knowledgeSource)
    .where(eq(knowledgeSource.id, sourceId))
    .limit(1)

  if (!source) {
    throw new Error(`Knowledge source not found: ${sourceId}`)
  }

  const embeddingModel = (source.embeddingModel || 'ollama-nomic-embed-text') as EmbeddingModel

  // Step 2: Generate query embedding
  const queryEmbedding = await EmbeddingService.generateEmbedding(query, embeddingModel)

  // Step 3: Vector search on chunks
  const vectorResults = await db
    .select({
      id: knowledgeChunk.id,
      content: knowledgeChunk.content,
      sourceId: knowledgeChunk.sourceId,
      score: sql`1 - (${knowledgeChunk.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
    })
    .from(knowledgeChunk)
    .where(eq(knowledgeChunk.sourceId, sourceId))
    .orderBy(sql`${knowledgeChunk.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
    .limit(maxResults)

  // Step 4: Vector search on graph nodes to find relevant entities
  const graphNodes = await db
    .select({
      id: knowledgeGraphNode.id,
      name: knowledgeGraphNode.name,
      type: knowledgeGraphNode.type,
      properties: knowledgeGraphNode.properties,
      metadata: knowledgeGraphNode.metadata,
      score: sql`1 - (${knowledgeGraphNode.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
    })
    .from(knowledgeGraphNode)
    .where(
      and(
        eq(knowledgeGraphNode.sourceId, sourceId),
        sql`${knowledgeGraphNode.embedding} IS NOT NULL`
      )
    )
    .orderBy(sql`${knowledgeGraphNode.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
    .limit(10)

  // Step 5: Get edges for the top graph nodes
  type GraphNodeRow = (typeof graphNodes)[number]
  const topNodeIds = graphNodes.map((n: GraphNodeRow) => n.id)
  let edges: GraphEdge[] = []

  if (topNodeIds.length > 0) {
    const edgeRows = await db
      .select({
        id: knowledgeGraphEdge.id,
        sourceNodeId: knowledgeGraphEdge.sourceNodeId,
        targetNodeId: knowledgeGraphEdge.targetNodeId,
        relationship: knowledgeGraphEdge.relationship,
        weight: knowledgeGraphEdge.weight,
        properties: knowledgeGraphEdge.properties,
      })
      .from(knowledgeGraphEdge)
      .where(
        or(
          inArray(knowledgeGraphEdge.sourceNodeId, topNodeIds),
          inArray(knowledgeGraphEdge.targetNodeId, topNodeIds)
        )
      )

    type EdgeRow = (typeof edgeRows)[number]
    edges = edgeRows.map((e: EdgeRow) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      relationship: e.relationship,
      weight: e.weight,
      properties: (e.properties as Record<string, any>) || {},
    }))
  }

  const nodes: GraphNode[] = graphNodes.map((n: GraphNodeRow) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    properties: (n.properties as Record<string, any>) || {},
    metadata: (n.metadata as Record<string, any>) || {},
  }))

  type ChunkRow = (typeof vectorResults)[number]
  const chunks = vectorResults.map((r: ChunkRow) => ({
    id: r.id,
    content: r.content,
    score: Number(r.score) || 0,
    sourceId: r.sourceId,
  }))

  // Calculate confidence from combined scores
  const avgChunkScore =
    chunks.length > 0
      ? chunks.reduce((sum: number, c: { score: number }) => sum + c.score, 0) / chunks.length
      : 0
  const avgNodeScore =
    graphNodes.length > 0
      ? graphNodes.reduce((sum: number, n: GraphNodeRow) => sum + (Number(n.score) || 0), 0) /
        graphNodes.length
      : 0
  const confidence = Math.min(avgChunkScore * 0.6 + avgNodeScore * 0.4, 1)

  const elapsed = Date.now() - startTime
  logger.debug('Graph search completed', {
    sourceId,
    chunks: chunks.length,
    nodes: nodes.length,
    edges: edges.length,
    confidence: confidence.toFixed(3),
    elapsed: `${elapsed}ms`,
  })

  return { nodes, edges, chunks, confidence }
}

/**
 * Deduplicate and merge similar entities in the graph.
 * Merges nodes with similar names (fuzzy match) and transfers their edges.
 */
export async function mergeEntities(
  sourceId: string,
  similarityThreshold: number = 0.85
): Promise<{ mergedCount: number }> {
  const nodes = await db
    .select({
      id: knowledgeGraphNode.id,
      name: knowledgeGraphNode.name,
      type: knowledgeGraphNode.type,
      properties: knowledgeGraphNode.properties,
      metadata: knowledgeGraphNode.metadata,
      embedding: knowledgeGraphNode.embedding,
    })
    .from(knowledgeGraphNode)
    .where(eq(knowledgeGraphNode.sourceId, sourceId))

  const mergeTargets = new Map<string, string>() // nodeId -> canonical nodeId

  // Group by type, then find similar nodes within each type
  const byType = new Map<string, typeof nodes>()
  for (const node of nodes) {
    const group = byType.get(node.type) || []
    group.push(node)
    byType.set(node.type, group)
  }

  for (const [, typeNodes] of byType) {
    for (let i = 0; i < typeNodes.length; i++) {
      if (mergeTargets.has(typeNodes[i].id)) continue

      for (let j = i + 1; j < typeNodes.length; j++) {
        if (mergeTargets.has(typeNodes[j].id)) continue

        // Check embedding similarity if both have embeddings
        if (typeNodes[i].embedding && typeNodes[j].embedding) {
          const similarity = EmbeddingService.cosineSimilarity(
            typeNodes[i].embedding as number[],
            typeNodes[j].embedding as number[]
          )
          if (similarity >= similarityThreshold) {
            mergeTargets.set(typeNodes[j].id, typeNodes[i].id)
            continue
          }
        }

        // Fallback: simple string similarity
        const nameA = typeNodes[i].name.toLowerCase().trim()
        const nameB = typeNodes[j].name.toLowerCase().trim()
        if (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA)) {
          mergeTargets.set(typeNodes[j].id, typeNodes[i].id)
        }
      }
    }
  }

  // Perform merges: re-point edges and delete merged nodes
  let mergedCount = 0
  for (const [fromId, toId] of mergeTargets) {
    // Update edges pointing to the merged node
    await db
      .update(knowledgeGraphEdge)
      .set({ sourceNodeId: toId })
      .where(eq(knowledgeGraphEdge.sourceNodeId, fromId))

    await db
      .update(knowledgeGraphEdge)
      .set({ targetNodeId: toId })
      .where(eq(knowledgeGraphEdge.targetNodeId, fromId))

    // Delete the merged node
    await db.delete(knowledgeGraphNode).where(eq(knowledgeGraphNode.id, fromId))

    mergedCount++
  }

  // Clean up self-referencing edges that may have been created
  if (mergedCount > 0) {
    await db
      .delete(knowledgeGraphEdge)
      .where(sql`${knowledgeGraphEdge.sourceNodeId} = ${knowledgeGraphEdge.targetNodeId}`)
  }

  logger.info('Entity merge completed', { sourceId, mergedCount })
  return { mergedCount }
}

/**
 * Get statistics about the knowledge graph for a source.
 */
export async function getGraphStats(sourceId: string): Promise<GraphStats> {
  const [nodeCountResult] = await db
    .select({ count: sql`cast(count(*) as integer)` })
    .from(knowledgeGraphNode)
    .where(eq(knowledgeGraphNode.sourceId, sourceId))

  const nodeTypes = await db
    .select({
      type: knowledgeGraphNode.type,
      count: sql`cast(count(*) as integer)`,
    })
    .from(knowledgeGraphNode)
    .where(eq(knowledgeGraphNode.sourceId, sourceId))
    .groupBy(knowledgeGraphNode.type)

  // Get all node IDs for this source to filter edges
  const nodeIds = await db
    .select({ id: knowledgeGraphNode.id })
    .from(knowledgeGraphNode)
    .where(eq(knowledgeGraphNode.sourceId, sourceId))

  const nodeIdList = nodeIds.map((n: { id: string }) => n.id)
  let edgeCount = 0
  let relationshipTypes: Array<{ relationship: string; count: number }> = []

  if (nodeIdList.length > 0) {
    const [edgeCountResult] = await db
      .select({ count: sql`cast(count(*) as integer)` })
      .from(knowledgeGraphEdge)
      .where(inArray(knowledgeGraphEdge.sourceNodeId, nodeIdList))

    edgeCount = edgeCountResult?.count || 0

    relationshipTypes = await db
      .select({
        relationship: knowledgeGraphEdge.relationship,
        count: sql`cast(count(*) as integer)`,
      })
      .from(knowledgeGraphEdge)
      .where(inArray(knowledgeGraphEdge.sourceNodeId, nodeIdList))
      .groupBy(knowledgeGraphEdge.relationship)
  }

  const nodeCount = nodeCountResult?.count || 0

  return {
    nodeCount,
    edgeCount,
    nodeTypes: Object.fromEntries(
      nodeTypes.map((t: { type: string; count: unknown }) => [t.type, Number(t.count) || 0])
    ),
    relationshipTypes: Object.fromEntries(relationshipTypes.map((r) => [r.relationship, r.count])),
    avgDegree: nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function inferRelationship(typeA: string, typeB: string): string {
  const rules = RELATIONSHIP_RULES[typeA]
  if (rules && rules[typeB]) return rules[typeB]

  const reverseRules = RELATIONSHIP_RULES[typeB]
  if (reverseRules && reverseRules[typeA]) return reverseRules[typeA]

  return 'related_to'
}

function deduplicateEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>()
  return edges.filter((edge) => {
    const key = `${edge.sourceNodeId}::${edge.targetNodeId}::${edge.relationship}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
