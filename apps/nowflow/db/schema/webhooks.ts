import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  SchemaTable,
  text,
  timestamp,
  uniqueIndex,
} from './_common'
import { workflow } from './workflows'

// ============================================================================
// WEBHOOKS
// ============================================================================

export const webhook = pgTable(
  'webhook',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    provider: text('provider'),
    providerConfig: jsonb('provider_config'),
    isActive: boolean('is_active').notNull().default(true),

    // Security features
    secretKey: text('secret_key'),
    allowedIps: jsonb('allowed_ips').default('[]'),
    rateLimit: integer('rate_limit').default(100),

    // Health & Monitoring
    lastTriggeredAt: timestamp('last_triggered_at'),
    totalTriggers: integer('total_triggers').notNull().default(0),
    successfulTriggers: integer('successful_triggers').notNull().default(0),
    failedTriggers: integer('failed_triggers').notNull().default(0),
    lastError: text('last_error'),
    healthStatus: text('health_status').notNull().default('healthy'),

    // Retry configuration
    retryEnabled: boolean('retry_enabled').notNull().default(true),
    maxRetries: integer('max_retries').notNull().default(3),
    retryDelay: integer('retry_delay').notNull().default(60),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      pathIdx: uniqueIndex('path_idx').on(table.path),
      workflowIdIdx: index('webhook_workflow_id_idx').on(table.workflowId),
      isActiveIdx: index('webhook_is_active_idx').on(table.isActive),
    }
  }
)

export const webhookLog = pgTable(
  'webhook_log',
  {
    id: text('id').primaryKey(),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhook.id, { onDelete: 'cascade' }),

    method: text('method').notNull(),
    headers: jsonb('headers'),
    body: jsonb('body'),
    queryParams: jsonb('query_params'),
    sourceIp: text('source_ip'),

    statusCode: integer('status_code'),
    responseTime: integer('response_time'),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),

    executionId: text('execution_id'),
    retryCount: integer('retry_count').notNull().default(0),

    triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table: SchemaTable) => {
    return {
      webhookIdIdx: index('webhook_log_webhook_id_idx').on(table.webhookId),
      webhookTriggeredIdx: index('webhook_log_webhook_triggered_idx').on(
        table.webhookId,
        table.triggeredAt
      ),
    }
  }
)

// ============================================================================
// WORKFLOW TRIGGERS
// ============================================================================

export const workflowTrigger = pgTable(
  'workflow_trigger',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' })
      .unique(),

    triggerType: text('trigger_type').notNull(),
    provider: text('provider'),
    config: jsonb('config').notNull(),
    isActive: boolean('is_active').notNull().default(true),

    pollingInterval: integer('polling_interval'),
    nextPollAt: timestamp('next_poll_at'),
    lastPolledAt: timestamp('last_polled_at'),

    lastSeenIdentifiers: jsonb('last_seen_identifiers').default('[]'),

    lastTriggeredAt: timestamp('last_triggered_at'),
    totalTriggers: integer('total_triggers').notNull().default(0),
    successfulTriggers: integer('successful_triggers').notNull().default(0),
    failedTriggers: integer('failed_triggers').notNull().default(0),
    lastError: text('last_error'),
    healthStatus: text('health_status').notNull().default('healthy'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      nextPollIdx: index('next_poll_idx').on(table.nextPollAt),
      triggerTypeIdx: index('trigger_type_idx').on(table.triggerType),
      activeTypePollIdx: index('workflow_trigger_active_type_poll_idx').on(
        table.isActive,
        table.triggerType,
        table.nextPollAt
      ),
    }
  }
)

export const triggerLog = pgTable(
  'trigger_log',
  {
    id: text('id').primaryKey(),
    triggerId: text('trigger_id')
      .notNull()
      .references(() => workflowTrigger.id, { onDelete: 'cascade' }),

    triggerType: text('trigger_type').notNull(),
    provider: text('provider'),
    triggerData: jsonb('trigger_data'),

    executionId: text('execution_id'),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    processingTime: integer('processing_time'),

    triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table: SchemaTable) => [
    index('trigger_log_trigger_id_idx').on(table.triggerId),
    index('trigger_log_triggered_at_idx').on(table.triggeredAt),
  ]
)
