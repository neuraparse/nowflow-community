import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  SchemaTable,
  text,
  timestamp,
} from './_common'
import { user } from './users'
import { workflow } from './workflows'
import { workspace } from './workspaces'

// ============================================================================
// SKILLS
// ============================================================================

export const skill = pgTable(
  'skill',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    version: text('version').notNull().default('0.1.0'),
    description: text('description'),
    author: text('author'),
    authorUrl: text('authorUrl'),
    license: text('license').default('MIT'),
    category: text('category').notNull().default('custom'),
    tags: text('tags').array().notNull().default([]),
    icon: text('icon'),
    manifest: jsonb('manifest').notNull(),
    sourceType: text('sourceType').notNull().default('local'),
    sourceUrl: text('sourceUrl'),
    sourceRepository: text('sourceRepository'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: text('workspaceId').references(() => workspace.id, { onDelete: 'set null' }),
    configuration: jsonb('configuration').notNull().default('{}'),
    enabled: boolean('enabled').notNull().default(true),
    downloads: integer('downloads').notNull().default(0),
    rating: decimal('rating', { precision: 3, scale: 2 }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdx: index('skill_user_idx').on(table.userId),
      categoryIdx: index('skill_category_idx').on(table.category),
      nameIdx: index('skill_name_idx').on(table.name),
      enabledIdx: index('skill_enabled_idx').on(table.enabled),
      workspaceIdx: index('skill_workspace_idx').on(table.workspaceId),
    }
  }
)

// ============================================================================
// VOICE SESSIONS
// ============================================================================

export const voiceProfile = pgTable(
  'voice_profile',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    voiceId: text('voice_id').notNull(),
    settings: jsonb('settings').default('{}'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('voice_profile_user_id_idx').on(table.userId),
      defaultIdx: index('voice_profile_default_idx').on(table.userId, table.isDefault),
    }
  }
)

export const voiceSession = pgTable(
  'voiceSession',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('idle'),
    commandHistory: jsonb('commandHistory').notNull().default('[]'),
    context: jsonb('context').notNull().default('{}'),
    lastCommandAt: timestamp('lastCommandAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    expiresAt: timestamp('expiresAt').notNull(),
  },
  (table: SchemaTable) => {
    return {
      userIdx: index('voice_session_user_idx').on(table.userId),
      statusIdx: index('voice_session_status_idx').on(table.status),
      expiresIdx: index('voice_session_expires_idx').on(table.expiresAt),
    }
  }
)

// ============================================================================
// MODEL ROUTING LOGS
// ============================================================================

export const modelRoutingLog = pgTable(
  'modelRoutingLog',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workflowId: text('workflowId').references(() => workflow.id, { onDelete: 'set null' }),
    executionId: text('executionId'),
    requestedModel: text('requestedModel'),
    selectedModel: text('selectedModel').notNull(),
    tier: text('tier').notNull(),
    taskType: text('taskType').notNull(),
    complexity: text('complexity').notNull(),
    reason: text('reason'),
    estimatedCost: decimal('estimatedCost', { precision: 10, scale: 6 }),
    actualCost: decimal('actualCost', { precision: 10, scale: 6 }),
    inputTokens: integer('inputTokens'),
    outputTokens: integer('outputTokens'),
    latencyMs: integer('latencyMs'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdx: index('model_routing_user_idx').on(table.userId),
      workflowIdx: index('model_routing_workflow_idx').on(table.workflowId),
      tierIdx: index('model_routing_tier_idx').on(table.tier),
      createdIdx: index('model_routing_created_idx').on(table.createdAt),
    }
  }
)

// ============================================================================
// AI EVALUATIONS (Evals Framework)
// ============================================================================

export const evalSuite = pgTable(
  'eval_suite',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    testCases: jsonb('test_cases').notNull().default('[]'),
    scoringConfig: jsonb('scoring_config').default('{}'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('eval_suite_workflow_id_idx').on(table.workflowId),
      userIdIdx: index('eval_suite_user_id_idx').on(table.userId),
    }
  }
)

export const evalRun = pgTable(
  'eval_run',
  {
    id: text('id').primaryKey(),
    suiteId: text('suite_id')
      .notNull()
      .references(() => evalSuite.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    results: jsonb('results').default('[]'),
    summary: jsonb('summary').default('{}'),
    modelConfig: jsonb('model_config').default('{}'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      suiteIdIdx: index('eval_run_suite_id_idx').on(table.suiteId),
      statusIdx: index('eval_run_status_idx').on(table.status),
    }
  }
)
