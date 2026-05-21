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
  uniqueIndex,
} from './_common'
import { user } from './users'
import { workspace } from './workspaces'

// ============================================================================
// CORE WORKFLOW TABLE
// ============================================================================

export const workflow = pgTable(
  'workflow',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    state: jsonb('state').notNull(),
    color: text('color').notNull().default('#3972F6'),
    icon: text('icon').default('workflow'), // Workflow icon ID
    lastSynced: timestamp('last_synced').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    isDeployed: boolean('is_deployed').notNull().default(false),
    deployedState: jsonb('deployed_state'),
    deployedAt: timestamp('deployed_at'),
    collaborators: jsonb('collaborators').notNull().default('[]'),
    runCount: integer('run_count').notNull().default(0),
    lastRunAt: timestamp('last_run_at'),
    variables: jsonb('variables').default('{}'),
    marketplaceData: jsonb('marketplace_data'), // Format: { id: string, status: 'owner' | 'temp' }
    storageSize: integer('storage_size').notNull().default(0), // in KB

    // Soft delete fields - preserve data for recovery
    deletedAt: timestamp('deleted_at'),
    deletedBy: text('deleted_by').references(() => user.id, { onDelete: 'set null' }),

    // These columns are kept for backward compatibility during migration
    // @deprecated - Use marketplaceData instead
    isPublished: boolean('is_published').notNull().default(false),
  },
  (table: SchemaTable) => {
    return {
      // CRITICAL PERFORMANCE INDEXES - Added for ultra-fast sync
      // Primary user isolation - every query filters by userId
      userIdIdx: index('workflow_user_id_idx').on(table.userId),

      // Workspace filtering - most queries filter by workspaceId
      workspaceIdIdx: index('workflow_workspace_id_idx').on(table.workspaceId),

      // Soft delete filtering - every query filters deletedAt IS NULL
      deletedAtIdx: index('workflow_deleted_at_idx').on(table.deletedAt),

      // COMPOSITE INDEX for most common query pattern:
      // WHERE userId = X AND workspaceId = Y AND deletedAt IS NULL
      // This single index covers the entire WHERE clause
      userWorkspaceActiveIdx: index('workflow_user_workspace_active_idx').on(
        table.userId,
        table.workspaceId,
        table.deletedAt
      ),

      // Collaborator queries - for shared workflows
      updatedAtIdx: index('workflow_updated_at_idx').on(table.updatedAt),

      // Deployed workflow filtering for dashboards and stats
      isDeployedIdx: index('workflow_is_deployed_idx').on(table.isDeployed),
    }
  }
)

// ============================================================================
// WORKFLOW EXECUTION & LOGS
// ============================================================================

export const workflowLogs = pgTable(
  'workflow_logs',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    executionId: text('execution_id'),
    level: text('level').notNull(), // e.g. "info", "error", etc.
    message: text('message').notNull(),
    duration: text('duration'), // Store as text to allow 'NA' for errors
    trigger: text('trigger'), // e.g. "api", "schedule", "manual"
    createdAt: timestamp('created_at').notNull().defaultNow(),
    metadata: jsonb('metadata'), // Optional JSON field for storing additional context like tool calls
  },
  (table: SchemaTable) => [
    index('workflow_logs_workflow_id_idx').on(table.workflowId),
    index('workflow_logs_execution_id_idx').on(table.executionId),
    index('workflow_logs_workflow_date_idx').on(table.workflowId, table.createdAt),
  ]
)

export const executionTrace = pgTable(
  'execution_trace',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    executionId: text('execution_id').notNull(),
    spans: jsonb('spans'), // Trace span tree
    totalDuration: integer('total_duration'), // ms
    blockCount: integer('block_count'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => [
    index('execution_trace_workflow_date_idx').on(table.workflowId, table.createdAt),
    index('execution_trace_execution_id_idx').on(table.executionId),
  ]
)

export const workflowRun = pgTable(
  'workflow_run',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // pending, running, success, completed, failed, error
    executionTime: integer('execution_time'), // Execution time in milliseconds
    error: text('error'), // Error message if failed
    trigger: text('trigger'), // e.g. "api", "schedule", "manual", "webhook"
    metadata: jsonb('metadata'), // Additional execution metadata
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => [
    index('workflow_run_workflow_status_idx').on(table.workflowId, table.status),
    index('workflow_run_workflow_date_idx').on(table.workflowId, table.createdAt),
    index('workflow_run_status_idx').on(table.status),
  ]
)

export const environment = pgTable('environment', {
  id: text('id').primaryKey(), // Use the user id as the key
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
    .unique(), // One environment per user
  variables: jsonb('variables').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const workflowVariables = pgTable('workflow_variables', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflow.id, { onDelete: 'cascade' })
    .unique(),
  variables: jsonb('variables').notNull().default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const workflowSchedule = pgTable(
  'workflow_schedule',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' })
      .unique(),
    cronExpression: text('cron_expression'),
    nextRunAt: timestamp('next_run_at'),
    lastRanAt: timestamp('last_ran_at'),
    triggerType: text('trigger_type').notNull(), // "manual", "webhook", "schedule"
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      nextRunAtIdx: index('workflow_schedule_next_run_at_idx').on(table.nextRunAt),
    }
  }
)

export const customTools = pgTable(
  'custom_tools',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    schema: jsonb('schema').notNull(),
    code: text('code').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      // User's custom tools lookup
      userIdIdx: index('custom_tools_user_id_idx').on(table.userId),
    }
  }
)

export const deployment = pgTable(
  'deployment',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'api', 'chat', 'both'
    status: text('status').notNull().default('active'), // 'active', 'inactive'
    config: jsonb('config').notNull(), // Deployment configuration
    endpoints: jsonb('endpoints'), // Generated endpoints and URLs
    deployedAt: timestamp('deployed_at').notNull().defaultNow(),
    undeployedAt: timestamp('undeployed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('deployment_workflow_id_idx').on(table.workflowId),
      workflowStatusIdx: index('deployment_workflow_status_idx').on(table.workflowId, table.status),
      statusIdx: index('deployment_status_idx').on(table.status),
    }
  }
)

// ============================================================================
// WORKFLOW VERSIONING & GIT INTEGRATION
// ============================================================================

export const workflowVersion = pgTable(
  'workflow_version',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    state: jsonb('state').notNull(),
    name: text('name'),
    description: text('description'),
    changeType: text('change_type').notNull(), // 'create' | 'update' | 'deploy' | 'restore' | 'auto_save'
    changeSummary: jsonb('change_summary'), // { blocksAdded: [], blocksRemoved: [], blocksModified: [] }
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    gitCommitSha: text('git_commit_sha'),
    gitBranch: text('git_branch'),
    gitSyncedAt: timestamp('git_synced_at'),
    // Semantic versioning
    semanticVersion: text('semantic_version'), // "1.0.0", "1.2.3"
    majorVersion: integer('major_version').default(0),
    minorVersion: integer('minor_version').default(0),
    patchVersion: integer('patch_version').default(0),
    // Tagging & Locking
    tags: jsonb('tags').default([]), // ["stable", "reviewed"]
    isPinned: boolean('is_pinned').default(false),
    isLocked: boolean('is_locked').default(false),
    releaseNotes: text('release_notes'), // Markdown changelog
    // Metadata
    metadata: jsonb('metadata').default({}), // Additional data
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('workflow_version_workflow_id_idx').on(table.workflowId),
      versionNumberIdx: index('workflow_version_number_idx').on(
        table.workflowId,
        table.versionNumber
      ),
      createdAtIdx: index('workflow_version_created_at_idx').on(table.createdAt),
      gitCommitIdx: index('workflow_version_git_commit_idx').on(table.gitCommitSha),
      semanticVersionIdx: index('workflow_version_semantic_idx').on(
        table.workflowId,
        table.semanticVersion
      ),
      pinnedIdx: index('workflow_version_pinned_idx').on(table.workflowId, table.isPinned),
      changeTypeIdx: index('workflow_version_change_type_idx').on(
        table.workflowId,
        table.changeType
      ),
    }
  }
)

export const workflowGitConfig = pgTable(
  'workflow_git_config',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' })
      .unique(),
    enabled: boolean('enabled').notNull().default(false),
    repositoryUrl: text('repository_url'),
    branch: text('branch').default('main'),
    filePath: text('file_path'), // e.g., 'workflows/my-workflow.json'
    authType: text('auth_type'), // 'token' | 'ssh' | 'oauth'
    credentials: jsonb('credentials'), // Encrypted credentials
    autoSync: boolean('auto_sync').notNull().default(false),
    syncOnDeploy: boolean('sync_on_deploy').notNull().default(true),
    lastSyncAt: timestamp('last_sync_at'),
    lastSyncStatus: text('last_sync_status'), // 'success' | 'failed' | 'conflict'
    lastSyncError: text('last_sync_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('workflow_git_config_workflow_id_idx').on(table.workflowId),
    }
  }
)

export const workflowVersionDiff = pgTable(
  'workflow_version_diff',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    fromVersion: integer('from_version').notNull(),
    toVersion: integer('to_version').notNull(),
    diff: jsonb('diff').notNull(), // { blocks: { added: [], removed: [], modified: [] }, edges: {...}, loops: {...} }
    diffSummary: text('diff_summary'), // Human-readable summary
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowVersionsIdx: uniqueIndex('workflow_version_diff_versions_idx').on(
        table.workflowId,
        table.fromVersion,
        table.toVersion
      ),
    }
  }
)

export const workflowVersionTag = pgTable(
  'workflow_version_tag',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // "stable", "reviewed"
    slug: text('slug').notNull(), // URL-safe slug
    color: text('color').default('#3B82F6'),
    description: text('description'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('workflow_version_tag_workflow_id_idx').on(table.workflowId),
      slugIdx: uniqueIndex('workflow_version_tag_slug_idx').on(table.workflowId, table.slug),
    }
  }
)

export const workflowAutoSaveConfig = pgTable(
  'workflow_auto_save_config',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' })
      .unique(),
    enabled: boolean('enabled').default(true),
    intervalMinutes: integer('interval_minutes').default(15),
    maxAutoSaveVersions: integer('max_auto_save_versions').default(10),
    significantChangeThreshold: integer('significant_change_threshold').default(5), // minimum number of changes to trigger auto-save
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('workflow_auto_save_config_workflow_id_idx').on(table.workflowId),
    }
  }
)

// ============================================================================
// A/B TESTING & EXPERIMENTATION
// ============================================================================

export const workflowExperiment = pgTable(
  'workflow_experiment',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('draft'), // 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
    variants: jsonb('variants').notNull(), // [{ id, name, config: { model, temperature, prompt } }]
    trafficSplit: jsonb('traffic_split').notNull(), // { 'variant-a': 50, 'variant-b': 50 }
    metrics: jsonb('metrics').notNull().default('["success_rate", "latency", "cost"]'), // Metrics to track
    winnerVariantId: text('winner_variant_id'),
    winnerConfidence: decimal('winner_confidence', { precision: 5, scale: 4 }),
    targetSampleSize: integer('target_sample_size'),
    currentSampleSize: integer('current_sample_size').notNull().default(0),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('workflow_experiment_workflow_id_idx').on(table.workflowId),
      statusIdx: index('workflow_experiment_status_idx').on(table.status),
      userIdIdx: index('workflow_experiment_user_id_idx').on(table.userId),
    }
  }
)

export const experimentResult = pgTable(
  'experiment_result',
  {
    id: text('id').primaryKey(),
    experimentId: text('experiment_id')
      .notNull()
      .references(() => workflowExperiment.id, { onDelete: 'cascade' }),
    variantId: text('variant_id').notNull(),
    executionId: text('execution_id').notNull(),
    success: boolean('success').notNull(),
    latencyMs: integer('latency_ms'),
    tokenCount: integer('token_count'),
    cost: decimal('cost', { precision: 10, scale: 6 }),
    metrics: jsonb('metrics').notNull().default('{}'), // Custom metrics
    userFeedback: integer('user_feedback'), // 1-5 rating
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      experimentIdIdx: index('experiment_result_experiment_id_idx').on(table.experimentId),
      variantIdIdx: index('experiment_result_variant_id_idx').on(table.variantId),
      experimentVariantIdx: index('experiment_result_exp_variant_idx').on(
        table.experimentId,
        table.variantId
      ),
    }
  }
)
