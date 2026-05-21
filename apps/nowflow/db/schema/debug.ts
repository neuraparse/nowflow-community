import { boolean, index, integer, jsonb, pgTable, SchemaTable, text, timestamp } from './_common'
import { user } from './users'
import { workflow } from './workflows'

// ============================================================================
// ADVANCED DEBUGGING & REPLAY
// ============================================================================

export const executionSnapshot = pgTable(
  'execution_snapshot',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    executionId: text('execution_id').notNull(),
    stepIndex: integer('step_index').notNull(),
    blockStates: jsonb('block_states').notNull(),
    environmentVariables: jsonb('environment_variables'),
    decisions: jsonb('decisions'),
    loopIterations: jsonb('loop_iterations'),
    executedBlocks: jsonb('executed_blocks').notNull(),
    activeExecutionPath: jsonb('active_execution_path').notNull(),
    executedBlockId: text('executed_block_id').notNull(),
    executedBlockName: text('executed_block_name'),
    executedBlockType: text('executed_block_type'),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    durationMs: integer('duration_ms'),
    inputData: jsonb('input_data'),
    outputData: jsonb('output_data'),
    error: text('error'),
  },
  (table: SchemaTable) => {
    return {
      executionIdIdx: index('execution_snapshot_execution_id_idx').on(table.executionId),
      workflowIdIdx: index('execution_snapshot_workflow_id_idx').on(table.workflowId),
      stepIndexIdx: index('execution_snapshot_step_idx').on(table.executionId, table.stepIndex),
      timestampIdx: index('execution_snapshot_timestamp_idx').on(table.timestamp),
    }
  }
)

export const workflowBreakpoint = pgTable(
  'workflow_breakpoint',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    blockId: text('block_id').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    condition: text('condition'),
    logExpression: text('log_expression'),
    hitCount: integer('hit_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      workflowUserIdx: index('workflow_breakpoint_workflow_user_idx').on(
        table.workflowId,
        table.userId
      ),
      blockIdx: index('workflow_breakpoint_block_idx').on(table.workflowId, table.blockId),
    }
  }
)

export const debugSession = pgTable(
  'debug_session',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    executionId: text('execution_id'),
    status: text('status').notNull().default('active'),
    currentStepIndex: integer('current_step_index').default(0),
    totalSteps: integer('total_steps'),
    watchExpressions: jsonb('watch_expressions').default('[]'),
    settings: jsonb('settings').default('{}'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    endedAt: timestamp('ended_at'),
  },
  (table: SchemaTable) => {
    return {
      workflowUserIdx: index('debug_session_workflow_user_idx').on(table.workflowId, table.userId),
      statusIdx: index('debug_session_status_idx').on(table.status),
      executionIdx: index('debug_session_execution_idx').on(table.executionId),
    }
  }
)
