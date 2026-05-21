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
import { workflow } from './workflows'
import { workspace } from './workspaces'

// ============================================================================
// CHAT DEPLOYMENTS
// ============================================================================

export const chat = pgTable(
  'chat',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    subdomain: text('subdomain').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),

    // Surface type (chat, portal, console, embedded)
    surface: text('surface').notNull().default('chat'),

    // UI Customization - Branding & Design
    customizations: jsonb('customizations').default('{}'),

    // Response Configuration
    responseConfig: jsonb('response_config').default('{}'),

    // Authentication options
    authType: text('auth_type').notNull().default('public'),
    password: text('password'),
    allowedEmails: jsonb('allowed_emails').default('[]'),

    // Output configuration
    outputConfigs: jsonb('output_configs').default('[]'),

    // Analytics & Tracking
    analytics: jsonb('analytics').default('{}'),

    // Rate Limiting & Quotas
    limits: jsonb('limits').default('{}'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      subdomainIdx: uniqueIndex('subdomain_idx').on(table.subdomain),
      userIdIdx: index('chat_user_id_idx').on(table.userId),
      workflowIdIdx: index('chat_workflow_id_idx').on(table.workflowId),
      isActiveIdx: index('chat_is_active_idx').on(table.isActive),
    }
  }
)

export const chatAnalytics = pgTable(
  'chat_analytics',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),

    date: timestamp('date').notNull(),
    hour: integer('hour'),

    totalMessages: integer('total_messages').notNull().default(0),
    userMessages: integer('user_messages').notNull().default(0),
    botMessages: integer('bot_messages').notNull().default(0),

    uniqueUsers: integer('unique_users').notNull().default(0),
    newUsers: integer('new_users').notNull().default(0),
    returningUsers: integer('returning_users').notNull().default(0),

    avgResponseTime: integer('avg_response_time').notNull().default(0),
    minResponseTime: integer('min_response_time'),
    maxResponseTime: integer('max_response_time'),

    totalErrors: integer('total_errors').notNull().default(0),
    errorRate: decimal('error_rate', { precision: 5, scale: 2 }).default('0.00'),

    avgMessagesPerUser: decimal('avg_messages_per_user', { precision: 5, scale: 2 }).default(
      '0.00'
    ),
    avgSessionDuration: integer('avg_session_duration').notNull().default(0),

    positiveFeedback: integer('positive_feedback').notNull().default(0),
    negativeFeedback: integer('negative_feedback').notNull().default(0),
    feedbackRate: decimal('feedback_rate', { precision: 5, scale: 2 }).default('0.00'),

    metadata: jsonb('metadata').default('{}'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      chatIdIdx: index('chat_analytics_chat_id_idx').on(table.chatId),
      chatDateIdx: index('chat_analytics_chat_date_idx').on(table.chatId, table.date),
    }
  }
)

export const chatSession = pgTable(
  'chat_session',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),

    userId: text('user_id'),
    sessionToken: text('session_token').notNull(),
    userEmail: text('user_email'),
    userIp: text('user_ip'),
    userAgent: text('user_agent'),

    messageCount: integer('message_count').notNull().default(0),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    endedAt: timestamp('ended_at'),
    duration: integer('duration'),

    feedbackRating: integer('feedback_rating'),
    feedbackComment: text('feedback_comment'),

    metadata: jsonb('metadata').default('{}'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      chatIdIdx: index('chat_session_chat_id_idx').on(table.chatId),
      userIdIdx: index('chat_session_user_id_idx').on(table.userId),
      sessionTokenIdx: index('chat_session_session_token_idx').on(table.sessionToken),
      endedAtIdx: index('chat_session_ended_at_idx').on(table.endedAt),
      chatStartedIdx: index('chat_session_chat_started_idx').on(table.chatId, table.startedAt),
    }
  }
)

export const chatMessageLog = pgTable(
  'chat_message_log',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSession.id, { onDelete: 'cascade' }),

    type: text('type').notNull(),
    content: text('content').notNull(),
    role: text('role').notNull(),

    responseTime: integer('response_time'),
    blockId: text('block_id'),
    outputPath: text('output_path'),

    hasError: boolean('has_error').notNull().default(false),
    errorMessage: text('error_message'),
    errorCode: text('error_code'),

    metadata: jsonb('metadata').default('{}'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      sessionIdIdx: index('chat_message_log_session_id_idx').on(table.sessionId),
      sessionCreatedIdx: index('chat_message_log_session_created_idx').on(
        table.sessionId,
        table.createdAt
      ),
      typeIdx: index('chat_message_log_type_idx').on(table.type),
      hasErrorIdx: index('chat_message_log_has_error_idx').on(table.hasError),
    }
  }
)

// ============================================================================
// WORKFLOW BUILDER CONVERSATIONS
// ============================================================================

export const conversation = pgTable(
  'conversation',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'set null' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').default('{}'),

    deletedAt: timestamp('deleted_at'),
    deletedBy: text('deleted_by').references(() => user.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('conversation_user_id_idx').on(table.userId),
      workflowIdIdx: index('conversation_workflow_id_idx').on(table.workflowId),
      deletedAtIdx: index('conversation_deleted_at_idx').on(table.deletedAt),
      isActiveIdx: index('conversation_is_active_idx').on(table.isActive),
      userActiveDeletedIdx: index('conversation_user_active_deleted_idx').on(
        table.userId,
        table.isActive,
        table.deletedAt
      ),
    }
  }
)

export const message = pgTable(
  'message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    content: text('content').notNull(),

    workflowSnapshot: jsonb('workflow_snapshot'),
    aiConfig: jsonb('ai_config'),
    intent: text('intent'),
    actions: jsonb('actions'),
    metadata: jsonb('metadata').default('{}'),

    deletedAt: timestamp('deleted_at'),
    deletedBy: text('deleted_by').references(() => user.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      conversationIdIdx: index('message_conversation_id_idx').on(table.conversationId),
      conversationCreatedIdx: index('message_conversation_created_idx').on(
        table.conversationId,
        table.createdAt
      ),
      typeIdx: index('message_type_idx').on(table.type),
      deletedAtIdx: index('message_deleted_at_idx').on(table.deletedAt),
    }
  }
)

// ============================================================================
// AI COPILOT CONVERSATIONS
// ============================================================================

export const copilotConversation = pgTable(
  'copilot_conversation',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    workflowId: text('workflow_id').references(() => workflow.id, { onDelete: 'set null' }),
    title: text('title'),
    context: text('context').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').default('{}'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('copilot_conversation_user_id_idx').on(table.userId),
      updatedAtIdx: index('copilot_conversation_updated_at_idx').on(table.updatedAt),
      scopeIdx: index('copilot_conversation_scope_idx').on(
        table.userId,
        table.workspaceId,
        table.context,
        table.isActive
      ),
      workflowIdx: index('copilot_conversation_workflow_idx').on(
        table.userId,
        table.workspaceId,
        table.workflowId
      ),
    }
  }
)

export const copilotMessage = pgTable(
  'copilot_message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => copilotConversation.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    context: text('context'),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      conversationIdIdx: index('copilot_message_conversation_id_idx').on(table.conversationId),
      conversationCreatedIdx: index('copilot_message_conversation_created_idx').on(
        table.conversationId,
        table.createdAt
      ),
    }
  }
)
