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
  uuid,
} from './_common'
import { user } from './users'
import { workflow } from './workflows'

// ============================================================================
// OBSERVABILITY & ANALYTICS
// ============================================================================

export const workflowAnalytics = pgTable(
  'workflow_analytics',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull(),
    hour: integer('hour'),
    totalExecutions: integer('total_executions').notNull().default(0),
    successfulExecutions: integer('successful_executions').notNull().default(0),
    failedExecutions: integer('failed_executions').notNull().default(0),
    totalPromptTokens: integer('total_prompt_tokens').notNull().default(0),
    totalCompletionTokens: integer('total_completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    totalCost: decimal('total_cost', { precision: 10, scale: 4 }).default('0'),
    inputCost: decimal('input_cost', { precision: 10, scale: 4 }).default('0'),
    outputCost: decimal('output_cost', { precision: 10, scale: 4 }).default('0'),
    avgExecutionTime: integer('avg_execution_time'),
    minExecutionTime: integer('min_execution_time'),
    maxExecutionTime: integer('max_execution_time'),
    p50ExecutionTime: integer('p50_execution_time'),
    p95ExecutionTime: integer('p95_execution_time'),
    p99ExecutionTime: integer('p99_execution_time'),
    errorCount: integer('error_count').notNull().default(0),
    uniqueErrors: integer('unique_errors').notNull().default(0),
    modelUsage: jsonb('model_usage').default('{}'),
    triggerBreakdown: jsonb('trigger_breakdown').default('{}'),
    blockMetrics: jsonb('block_metrics').default('{}'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowDateIdx: uniqueIndex('workflow_analytics_workflow_date_idx').on(
        table.workflowId,
        table.date,
        table.hour
      ),
      dateIdx: index('workflow_analytics_date_idx').on(table.date),
    }
  }
)

export const analyticsAlert = pgTable(
  'analytics_alert',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workflowId: text('workflow_id').references(() => workflow.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    metric: text('metric').notNull(),
    operator: text('operator').notNull(),
    threshold: decimal('threshold', { precision: 10, scale: 4 }).notNull(),
    windowMinutes: integer('window_minutes').notNull().default(60),
    notificationChannels: jsonb('notification_channels').notNull().default('["email"]'),
    webhookUrl: text('webhook_url'),
    slackWebhookUrl: text('slack_webhook_url'),
    lastTriggeredAt: timestamp('last_triggered_at'),
    cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
    triggerCount: integer('trigger_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('analytics_alert_user_id_idx').on(table.userId),
      workflowIdIdx: index('analytics_alert_workflow_id_idx').on(table.workflowId),
      enabledIdx: index('analytics_alert_enabled_idx').on(table.isEnabled),
    }
  }
)

export const alertEvent = pgTable(
  'alert_event',
  {
    id: text('id').primaryKey(),
    alertId: text('alert_id')
      .notNull()
      .references(() => analyticsAlert.id, { onDelete: 'cascade' }),
    workflowId: text('workflow_id').references(() => workflow.id, { onDelete: 'set null' }),
    metricValue: decimal('metric_value', { precision: 10, scale: 4 }).notNull(),
    thresholdValue: decimal('threshold_value', { precision: 10, scale: 4 }).notNull(),
    status: text('status').notNull().default('triggered'),
    acknowledgedBy: text('acknowledged_by').references(() => user.id, { onDelete: 'set null' }),
    acknowledgedAt: timestamp('acknowledged_at'),
    resolvedAt: timestamp('resolved_at'),
    notificationsSent: jsonb('notifications_sent').default('[]'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      alertIdIdx: index('alert_event_alert_id_idx').on(table.alertId),
      statusIdx: index('alert_event_status_idx').on(table.status),
      createdAtIdx: index('alert_event_created_at_idx').on(table.createdAt),
    }
  }
)

// ============================================================================
// AI UI GENERATION HISTORY
// ============================================================================

export const aiUIGenerationHistory = pgTable(
  'ai_ui_generation_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    sessionId: text('session_id').notNull(),
    iteration: integer('iteration').notNull().default(1),
    userPrompt: text('user_prompt').notNull(),
    conversationContext: jsonb('conversation_context').default('[]'),
    generatedUI: jsonb('generated_ui').notNull(),
    componentName: text('component_name'),
    uiPattern: text('ui_pattern'),
    detectedCategory: text('detected_category'),
    aiProvider: text('ai_provider'),
    aiModel: text('ai_model'),
    processingTime: integer('processing_time'),
    status: text('status').notNull().default('generated'),
    isActive: boolean('is_active').notNull().default(true),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('ai_ui_gen_workflow_id_idx').on(table.workflowId),
      userIdIdx: index('ai_ui_gen_user_id_idx').on(table.userId),
      sessionIdIdx: index('ai_ui_gen_session_id_idx').on(table.sessionId),
      activeUIIdx: index('ai_ui_gen_active_idx').on(table.workflowId, table.isActive),
      patternIdx: index('ai_ui_gen_pattern_idx').on(table.uiPattern),
      categoryIdx: index('ai_ui_gen_category_idx').on(table.detectedCategory),
    }
  }
)
