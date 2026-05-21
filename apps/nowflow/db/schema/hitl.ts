import { boolean, index, integer, jsonb, pgTable, SchemaTable, text, timestamp } from './_common'
import { user } from './users'
import { workflow } from './workflows'

// ============================================================================
// HUMAN-IN-THE-LOOP (HITL)
// ============================================================================

export const hitlRequest = pgTable(
  'hitl_request',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    executionId: text('execution_id').notNull(),
    blockId: text('block_id').notNull(),
    requestType: text('request_type').notNull(),
    status: text('status').notNull().default('pending'),
    title: text('title').notNull(),
    description: text('description'),
    data: jsonb('data'),
    options: jsonb('options'),
    assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
    assignedToEmail: text('assigned_to_email'),
    respondedBy: text('responded_by').references(() => user.id, { onDelete: 'set null' }),
    response: jsonb('response'),
    responseNote: text('response_note'),
    timeoutAt: timestamp('timeout_at'),
    priority: text('priority').notNull().default('normal'),
    notificationSent: boolean('notification_sent').notNull().default(false),
    notificationChannels: jsonb('notification_channels').default('[]'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),
    metadata: jsonb('metadata'),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('hitl_request_workflow_id_idx').on(table.workflowId),
      executionIdIdx: index('hitl_request_execution_id_idx').on(table.executionId),
      statusIdx: index('hitl_request_status_idx').on(table.status),
      assignedToIdx: index('hitl_request_assigned_to_idx').on(table.assignedTo),
      priorityStatusIdx: index('hitl_request_priority_status_idx').on(table.priority, table.status),
      timeoutIdx: index('hitl_request_timeout_idx').on(table.timeoutAt),
    }
  }
)

export const hitlEscalationRule = pgTable(
  'hitl_escalation_rule',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    condition: jsonb('condition').notNull(),
    action: jsonb('action').notNull(),
    priority: integer('priority').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowIdIdx: index('hitl_escalation_workflow_id_idx').on(table.workflowId),
      activeIdx: index('hitl_escalation_active_idx').on(table.isActive),
    }
  }
)

export const hitlPausedExecution = pgTable(
  'hitl_paused_execution',
  {
    id: text('id').primaryKey(),
    hitlRequestId: text('hitl_request_id')
      .notNull()
      .references(() => hitlRequest.id, { onDelete: 'cascade' })
      .unique(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    executionId: text('execution_id').notNull(),
    executionState: jsonb('execution_state').notNull(),
    pausedAt: timestamp('paused_at').notNull().defaultNow(),
    resumedAt: timestamp('resumed_at'),
    resumeResult: jsonb('resume_result'),
  },
  (table: SchemaTable) => {
    return {
      executionIdIdx: index('hitl_paused_execution_id_idx').on(table.executionId),
      workflowIdIdx: index('hitl_paused_workflow_id_idx').on(table.workflowId),
    }
  }
)
