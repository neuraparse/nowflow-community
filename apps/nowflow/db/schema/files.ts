import { index, integer, jsonb, pgTable, SchemaTable, text, timestamp, uuid } from './_common'
import { knowledgeDocument } from './knowledge'
import { user } from './users'
import { workspace } from './workspaces'

// ============================================================================
// FILE MANAGEMENT TABLES
// ============================================================================

export const file = pgTable(
  'file',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Owner */
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Workspace association */
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),

    /** File Information */
    name: text('name').notNull(),
    path: text('path').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),

    /** Optional Knowledge Link */
    knowledgeDocumentId: uuid('knowledge_document_id').references(() => knowledgeDocument.id, {
      onDelete: 'set null',
    }),

    /** Metadata */
    metadata: jsonb('metadata'),

    /** Status */
    status: text('status').notNull().default('active'), // 'active' | 'archived' | 'deleted'

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('file_user_id_idx').on(table.userId),
      workspaceIdIdx: index('file_workspace_id_idx').on(table.workspaceId),
      statusIdx: index('file_status_idx').on(table.status),
      userWorkspaceIdx: index('file_user_workspace_idx').on(table.userId, table.workspaceId),
    }
  }
)

export const fileVersion = pgTable(
  'file_version',
  {
    /** Unique identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Parent File */
    fileId: uuid('file_id')
      .notNull()
      .references(() => file.id, { onDelete: 'cascade' }),

    /** Version Information */
    version: integer('version').notNull(),
    path: text('path').notNull(),
    size: integer('size').notNull(),
    checksum: text('checksum'),

    /** Metadata */
    metadata: jsonb('metadata'),

    /** Timestamps */
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      fileIdIdx: index('file_version_file_id_idx').on(table.fileId),
      fileVersionIdx: index('file_version_file_version_idx').on(table.fileId, table.version),
    }
  }
)
