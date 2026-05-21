import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  SchemaTable,
  text,
  timestamp,
  tsvector,
  uniqueIndex,
  uuid,
  vector,
} from './_common'
import { user } from './users'
import { workflow } from './workflows'
import { workspace } from './workspaces'

// ============================================================================
// KNOWLEDGE SOURCES TABLES
// ============================================================================

export const knowledgeSource = pgTable(
  'knowledge_source',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Owner */
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Workspace association for team access */
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),

    /** Display Information */
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),

    /** Access Control */
    visibility: text('visibility').notNull().default('private'), // 'private' | 'workspace' | 'public'
    allowedUserIds: text('allowed_user_ids').array(),

    /** Metadata */
    documentCount: integer('document_count').notNull().default(0),
    totalSize: integer('total_size').notNull().default(0),
    usageCount: integer('usage_count').notNull().default(0),

    /** Embedding Configuration */
    embeddingModel: text('embedding_model').default('openai-ada-002'),
    chunkSize: integer('chunk_size').notNull().default(1000),
    chunkOverlap: integer('chunk_overlap').notNull().default(200),

    /** Entity Extraction Configuration */
    entityLabels: text('entity_labels').array(),
    entityThreshold: real('entity_threshold').default(0.5),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('knowledge_source_user_id_idx').on(table.userId),
      workspaceIdIdx: index('knowledge_source_workspace_id_idx').on(table.workspaceId),
      visibilityIdx: index('knowledge_source_visibility_idx').on(table.visibility),
      userWorkspaceIdx: index('knowledge_source_user_workspace_idx').on(
        table.userId,
        table.workspaceId
      ),
    }
  }
)

export const knowledgeDocument = pgTable(
  'knowledge_document',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Parent Knowledge Source */
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSource.id, { onDelete: 'cascade' }),

    /** Document Information */
    name: text('name').notNull(),
    type: text('type').notNull(), // 'file' | 'url' | 'text'

    /** File Information (for type='file') */
    filePath: text('file_path'),
    fileUrl: text('file_url'),
    fileType: text('file_type'),
    fileSize: integer('file_size'),

    /** Content */
    rawContent: text('raw_content'),
    processedContent: text('processed_content'),

    /** Processing Status */
    status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'ready' | 'failed'
    errorMessage: text('error_message'),

    /** Metadata */
    metadata: jsonb('metadata'),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    processedAt: timestamp('processed_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      sourceIdIdx: index('knowledge_document_source_id_idx').on(table.sourceId),
      statusIdx: index('knowledge_document_status_idx').on(table.status),
      sourceStatusIdx: index('knowledge_document_source_status_idx').on(
        table.sourceId,
        table.status
      ),
    }
  }
)

export const knowledgeChunk = pgTable(
  'knowledge_chunk',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Parent Document */
    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocument.id, { onDelete: 'cascade' }),

    /** Parent Source (denormalized for faster queries) */
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSource.id, { onDelete: 'cascade' }),

    /** Chunk Content */
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),

    /** Vector Embedding for semantic search */
    embedding: vector('embedding', { dimensions: 1536 }),

    /** Full-text search vector for hybrid search */
    searchVector: tsvector('search_vector'),

    /** Metadata */
    metadata: jsonb('metadata'),
    tokenCount: integer('token_count'),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      documentIdIdx: index('knowledge_chunk_document_id_idx').on(table.documentId),
      sourceIdIdx: index('knowledge_chunk_source_id_idx').on(table.sourceId),
      documentChunkIdx: index('knowledge_chunk_document_chunk_idx').on(
        table.documentId,
        table.chunkIndex
      ),
    }
  }
)

export const knowledgeEntity = pgTable(
  'knowledge_entity',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Parent Document */
    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocument.id, { onDelete: 'cascade' }),

    /** Knowledge Source (denormalized for efficient queries) */
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSource.id, { onDelete: 'cascade' }),

    /** Entity text */
    entityText: text('entity_text').notNull(),

    /** Entity label/type */
    label: text('label').notNull(),

    /** Confidence score from the configured entity extraction provider (0-1) */
    score: real('score').notNull().default(0),

    /** Number of times this entity appears in the document */
    occurrenceCount: integer('occurrence_count').notNull().default(1),

    /** Chunk indices where this entity appears */
    chunkIndices: integer('chunk_indices').array(),

    /** Extra metadata */
    metadata: jsonb('metadata'),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      documentIdIdx: index('knowledge_entity_document_id_idx').on(table.documentId),
      sourceIdIdx: index('knowledge_entity_source_id_idx').on(table.sourceId),
      labelIdx: index('knowledge_entity_label_idx').on(table.label),
      entityTextIdx: index('knowledge_entity_text_idx').on(table.entityText),
      sourceLabelIdx: index('knowledge_entity_source_label_idx').on(table.sourceId, table.label),
      documentEntityUnique: uniqueIndex('knowledge_entity_doc_text_label_unique').on(
        table.documentId,
        table.entityText,
        table.label
      ),
    }
  }
)

// ============================================================================
// KNOWLEDGE GRAPH
// ============================================================================

export const knowledgeGraphNode = pgTable(
  'knowledge_graph_node',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Parent Knowledge Source */
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSource.id, { onDelete: 'cascade' }),

    /** Node name */
    name: text('name').notNull(),

    /** Node type */
    type: text('type').notNull(),

    /** Node properties */
    properties: jsonb('properties').default('{}'),

    /** Vector embedding for semantic similarity search */
    embedding: vector('embedding', { dimensions: 1536 }),

    /** Extra metadata */
    metadata: jsonb('metadata').default('{}'),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      sourceIdIdx: index('knowledge_graph_node_source_id_idx').on(table.sourceId),
      typeIdx: index('knowledge_graph_node_type_idx').on(table.type),
      nameIdx: index('knowledge_graph_node_name_idx').on(table.name),
      sourceTypeIdx: index('knowledge_graph_node_source_type_idx').on(table.sourceId, table.type),
      sourceNameTypeUnique: uniqueIndex('knowledge_graph_node_source_name_type_unique').on(
        table.sourceId,
        table.name,
        table.type
      ),
    }
  }
)

export const knowledgeGraphEdge = pgTable(
  'knowledge_graph_edge',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Source node */
    sourceNodeId: uuid('source_node_id')
      .notNull()
      .references(() => knowledgeGraphNode.id, { onDelete: 'cascade' }),

    /** Target node */
    targetNodeId: uuid('target_node_id')
      .notNull()
      .references(() => knowledgeGraphNode.id, { onDelete: 'cascade' }),

    /** Relationship type */
    relationship: text('relationship').notNull(),

    /** Edge weight / strength (0-1) */
    weight: real('weight').notNull().default(1.0),

    /** Edge properties */
    properties: jsonb('properties').default('{}'),

    /** Extra metadata */
    metadata: jsonb('metadata').default('{}'),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      sourceNodeIdx: index('knowledge_graph_edge_source_node_idx').on(table.sourceNodeId),
      targetNodeIdx: index('knowledge_graph_edge_target_node_idx').on(table.targetNodeId),
      relationshipIdx: index('knowledge_graph_edge_relationship_idx').on(table.relationship),
      edgeUnique: uniqueIndex('knowledge_graph_edge_unique').on(
        table.sourceNodeId,
        table.targetNodeId,
        table.relationship
      ),
    }
  }
)

export const agentKnowledgeSource = pgTable(
  'agent_knowledge_source',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Agent Information */
    agentId: text('agent_id').notNull(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),

    /** Knowledge Source */
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSource.id, { onDelete: 'cascade' }),

    /** Search Configuration */
    searchEnabled: boolean('search_enabled').notNull().default(true),
    maxResults: integer('max_results').notNull().default(5),
    similarityThreshold: real('similarity_threshold').notNull().default(0.7),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      agentIdIdx: index('agent_knowledge_source_agent_id_idx').on(table.agentId),
      workflowIdIdx: index('agent_knowledge_source_workflow_id_idx').on(table.workflowId),
      sourceIdIdx: index('agent_knowledge_source_source_id_idx').on(table.sourceId),
      agentSourceUnique: uniqueIndex('agent_knowledge_source_agent_source_unique').on(
        table.agentId,
        table.sourceId
      ),
    }
  }
)
