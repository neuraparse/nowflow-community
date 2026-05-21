import { index, jsonb, pgTable, SchemaTable, text, timestamp } from './_common'
import { user } from './users'
import { workflow } from './workflows'
import { workspace } from './workspaces'

// ============================================================================
// GATEWAY CHANNELS
// ============================================================================

export const gatewayChannel = pgTable(
  'gatewayChannel',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('disconnected'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: text('workspaceId').references(() => workspace.id, { onDelete: 'set null' }),
    credentials: jsonb('credentials').notNull().default('{}'),
    settings: jsonb('settings').notNull().default('{}'),
    stats: jsonb('stats')
      .notNull()
      .default('{"messagesSent": 0, "messagesReceived": 0, "errors": 0}'),
    lastConnectedAt: timestamp('lastConnectedAt'),
    lastErrorMessage: text('lastErrorMessage'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('gateway_channel_user_id_idx').on(table.userId),
      typeIdx: index('gateway_channel_type_idx').on(table.type),
      statusIdx: index('gateway_channel_status_idx').on(table.status),
      workspaceIdx: index('gateway_channel_workspace_idx').on(table.workspaceId),
    }
  }
)

export const gatewaySession = pgTable(
  'gatewaySession',
  {
    id: text('id').primaryKey(),
    channelId: text('channelId')
      .notNull()
      .references(() => gatewayChannel.id, { onDelete: 'cascade' }),
    channelType: text('channelType').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    senderId: text('senderId').notNull(),
    senderName: text('senderName'),
    workflowId: text('workflowId').references(() => workflow.id, { onDelete: 'set null' }),
    executionId: text('executionId'),
    context: jsonb('context').notNull().default('{}'),
    messageHistory: jsonb('messageHistory').notNull().default('[]'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    lastActivityAt: timestamp('lastActivityAt').notNull().defaultNow(),
    expiresAt: timestamp('expiresAt').notNull(),
  },
  (table: SchemaTable) => {
    return {
      channelIdx: index('gateway_session_channel_idx').on(table.channelId),
      userIdx: index('gateway_session_user_idx').on(table.userId),
      senderIdx: index('gateway_session_sender_idx').on(table.senderId),
      statusIdx: index('gateway_session_status_idx').on(table.status),
      expiresIdx: index('gateway_session_expires_idx').on(table.expiresAt),
      workflowIdx: index('gateway_session_workflow_idx').on(table.workflowId),
    }
  }
)

export const gatewayMessageLog = pgTable(
  'gatewayMessageLog',
  {
    id: text('id').primaryKey(),
    sessionId: text('sessionId')
      .notNull()
      .references(() => gatewaySession.id, { onDelete: 'cascade' }),
    channelId: text('channelId')
      .notNull()
      .references(() => gatewayChannel.id, { onDelete: 'cascade' }),
    direction: text('direction').notNull(),
    senderId: text('senderId').notNull(),
    text: text('text'),
    media: jsonb('media'),
    metadata: jsonb('metadata').notNull().default('{}'),
    status: text('status').notNull().default('delivered'),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      sessionIdx: index('gateway_message_session_idx').on(table.sessionId),
      channelIdx: index('gateway_message_channel_idx').on(table.channelId),
      createdIdx: index('gateway_message_created_idx').on(table.createdAt),
    }
  }
)
