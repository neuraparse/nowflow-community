import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  SchemaTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from './_common'
import { user } from './users'
import { workflow } from './workflows'

// ============================================================================
// AGENT MEMORY
// ============================================================================

export const agentMemory = pgTable(
  'agent_memory',
  {
    /** Unique memory ID */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Session identifier - PRIMARY KEY for user isolation (REQUIRED) */
    sessionId: text('session_id').notNull(),

    /** Optional authenticated user ID (cascade delete) */
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),

    /** Agent block ID */
    agentId: text('agent_id').notNull(),

    /** Agent type (customer_service, research, sales, etc.) */
    agentType: text('agent_type').notNull(),

    /** Workflow ID (cascade delete) */
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),

    /** Block ID within workflow */
    blockId: text('block_id').notNull(),

    /** Execution ID for tracking */
    executionId: text('execution_id').notNull(),

    /** Memory content (JSONB for flexibility) */
    content: jsonb('content').notNull(),

    /** Agent-specific data */
    agentData: jsonb('agent_data'),

    /** Tags for categorization */
    tags: text('tags').array(),

    /** Importance score (0-1) for relevance ranking */
    importance: real('importance').default(0.5),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),

    /** Auto-expiration for GDPR compliance */
    expiresAt: timestamp('expires_at'),
  },
  (table: SchemaTable) => {
    return {
      sessionIdIdx: index('agent_memory_session_id_idx').on(table.sessionId),
      userIdIdx: index('agent_memory_user_id_idx').on(table.userId),
      agentIdIdx: index('agent_memory_agent_id_idx').on(table.agentId),
      agentTypeIdx: index('agent_memory_agent_type_idx').on(table.agentType),
      sessionAgentIdx: index('agent_memory_session_agent_idx').on(table.sessionId, table.agentId),
      workflowIdIdx: index('agent_memory_workflow_id_idx').on(table.workflowId),
      createdAtIdx: index('agent_memory_created_at_idx').on(table.createdAt),
      expiresAtIdx: index('agent_memory_expires_at_idx').on(table.expiresAt),
    }
  }
)

export const sharedMemory = pgTable(
  'shared_memory',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    executionId: text('execution_id'), // null for persistent memory
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    version: integer('version').notNull().default(1),
    scope: text('scope').notNull().default('execution'), // 'execution' | 'workflow' | 'global'
    createdBy: text('created_by').notNull(), // Agent block ID
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (table: SchemaTable) => {
    return {
      workflowKeyIdx: uniqueIndex('shared_memory_workflow_key_idx').on(
        table.workflowId,
        table.executionId,
        table.key
      ),
      scopeIdx: index('shared_memory_scope_idx').on(table.scope),
      expiresAtIdx: index('shared_memory_expires_at_idx').on(table.expiresAt),
    }
  }
)
