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
import { user } from './users'
import { workflow } from './workflows'
import { workspace } from './workspaces'

// ============================================================================
// DATA TABLES (Internal Database Feature)
// ============================================================================

export const dataTable = pgTable(
  'data_table',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon').default('table'),
    rowCount: integer('row_count').notNull().default(0),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('data_table_user_id_idx').on(table.userId),
      workspaceIdIdx: index('data_table_workspace_id_idx').on(table.workspaceId),
    }
  }
)

export const dataTableColumn = pgTable(
  'data_table_column',
  {
    id: text('id').primaryKey(),
    tableId: text('table_id')
      .notNull()
      .references(() => dataTable.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull().default('text'),
    order: integer('order').notNull().default(0),
    width: integer('width').default(200),
    isRequired: boolean('is_required').notNull().default(false),
    defaultValue: text('default_value'),
    options: jsonb('options'),
    aiConfig: jsonb('ai_config'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      tableIdIdx: index('data_table_column_table_id_idx').on(table.tableId),
      tableOrderIdx: index('data_table_column_table_order_idx').on(table.tableId, table.order),
    }
  }
)

export const dataTableRow = pgTable(
  'data_table_row',
  {
    id: text('id').primaryKey(),
    tableId: text('table_id')
      .notNull()
      .references(() => dataTable.id, { onDelete: 'cascade' }),
    data: jsonb('data').notNull().default('{}'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      tableIdIdx: index('data_table_row_table_id_idx').on(table.tableId),
      tableOrderIdx: index('data_table_row_table_order_idx').on(table.tableId, table.order),
    }
  }
)

// ============================================================================
// FORM & INTERFACE BUILDER
// ============================================================================

export const form = pgTable(
  'form',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    slug: text('slug').notNull().unique(),
    status: text('status').notNull().default('draft'),
    fields: jsonb('fields').notNull().default('[]'),
    settings: jsonb('settings').notNull().default('{}'),
    workflowId: text('workflow_id').references(() => workflow.id, { onDelete: 'set null' }),
    dataTableId: text('data_table_id').references(() => dataTable.id, { onDelete: 'set null' }),
    submitCount: integer('submit_count').notNull().default(0),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('form_user_id_idx').on(table.userId),
      workspaceIdIdx: index('form_workspace_id_idx').on(table.workspaceId),
      slugIdx: uniqueIndex('form_slug_idx').on(table.slug),
    }
  }
)

export const formSubmission = pgTable(
  'form_submission',
  {
    id: text('id').primaryKey(),
    formId: text('form_id')
      .notNull()
      .references(() => form.id, { onDelete: 'cascade' }),
    data: jsonb('data').notNull().default('{}'),
    metadata: jsonb('metadata').default('{}'),
    workflowRunId: text('workflow_run_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      formIdIdx: index('form_submission_form_id_idx').on(table.formId),
      createdAtIdx: index('form_submission_created_at_idx').on(table.createdAt),
    }
  }
)
