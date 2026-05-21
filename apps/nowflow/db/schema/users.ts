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

// ============================================================================
// CORE USER TABLE
// ============================================================================

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull(),
    image: text('image'),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'), // active, suspended, banned
    bannedAt: timestamp('banned_at'),
    bannedReason: text('banned_reason'),
    suspendedUntil: timestamp('suspended_until'),
    suspendedReason: text('suspended_reason'),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
  },
  (table: SchemaTable) => {
    return {
      // Email already has unique index, but explicit index for lookups
      emailIdx: index('user_email_idx').on(table.email),

      // User status filtering (active/suspended/banned users)
      statusIdx: index('user_status_idx').on(table.status),

      // Role queries
      roleIdx: index('user_role_idx').on(table.role),

      // Stripe webhook lookups
      stripeCustomerIdIdx: index('user_stripe_customer_id_idx').on(table.stripeCustomerId),

      // Composite for user filtering: WHERE status = ? AND role = ?
      statusRoleIdx: index('user_status_role_idx').on(table.status, table.role),
    }
  }
)

// ============================================================================
// USER-RELATED TABLES
// ============================================================================

export const userNotificationPreferences = pgTable(
  'user_notification_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    workflowCompletion: boolean('workflow_completion').notNull().default(true),
    workflowFailure: boolean('workflow_failure').notNull().default(true),
    approvalRequests: boolean('approval_requests').notNull().default(true),
    digestEnabled: boolean('digest_enabled').notNull().default(false),
    digestSchedule: text('digest_schedule').notNull().default('daily'), // 'daily' | 'weekly' | 'never'
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      // User preferences lookup (unique constraint already creates index)
      userIdIdx: index('user_notification_preferences_user_id_idx').on(table.userId),
    }
  }
)

export const notificationLog = pgTable(
  'notification_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // hitl_approval | workflow_alert | system
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data'), // Additional payload (workflowId, hitlRequestId, etc.)
    status: text('status').notNull().default('sent'), // sent | delivered | failed
    error: text('error'),
    sentAt: timestamp('sent_at').notNull(),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table: SchemaTable) => {
    return {
      // User's notification history
      userIdIdx: index('notification_log_user_id_idx').on(table.userId),

      // Notification type filtering
      typeIdx: index('notification_log_type_idx').on(table.type),

      // Status tracking for failed notifications
      statusIdx: index('notification_log_status_idx').on(table.status),

      // Composite: User's notifications by type and time
      userTypeTimeIdx: index('notification_log_user_type_time_idx').on(
        table.userId,
        table.type,
        table.sentAt
      ),

      // Time-based queries for cleanup and analytics
      sentAtIdx: index('notification_log_sent_at_idx').on(table.sentAt),
    }
  }
)

export const userStats = pgTable('user_stats', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
    .unique(), // One record per user
  totalManualExecutions: integer('total_manual_executions').notNull().default(0),
  totalApiCalls: integer('total_api_calls').notNull().default(0),
  totalWebhookTriggers: integer('total_webhook_triggers').notNull().default(0),
  totalScheduledExecutions: integer('total_scheduled_executions').notNull().default(0),
  totalTokensUsed: integer('total_tokens_used').notNull().default(0),
  totalCost: decimal('total_cost').notNull().default('0'),
  totalStorageUsed: integer('total_storage_used').notNull().default(0), // in MB
  apiCallsToday: integer('api_calls_today').notNull().default(0), // reset daily
  lastActive: timestamp('last_active').notNull().defaultNow(),
  apiCallsResetAt: timestamp('api_calls_reset_at').notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  id: text('id').primaryKey(), // Use the user id as the key
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
    .unique(), // One settings record per user

  // General settings
  theme: text('theme').notNull().default('system'),
  debugMode: boolean('debug_mode').notNull().default(false),
  autoConnect: boolean('auto_connect').notNull().default(true),
  autoFillEnvVars: boolean('auto_fill_env_vars').notNull().default(true),

  // Keep general for future flexible settings
  general: jsonb('general').notNull().default('{}'),

  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// User notifications sent by the system
export const userNotification = pgTable('user_notification', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // info | success | warning | error
  actionUrl: text('action_url'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Per-user delivery + read state for user notifications
export const userNotificationRecipient = pgTable(
  'user_notification_recipient',
  {
    id: text('id').primaryKey(),
    notificationId: text('notification_id')
      .notNull()
      .references(() => userNotification.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      notificationUserIdx: uniqueIndex('user_notification_recipient_unique').on(
        table.notificationId,
        table.userId
      ),
      userIdIdx: index('user_notification_recipient_user_id_idx').on(table.userId),
      userReadIdx: index('user_notification_recipient_user_read_idx').on(
        table.userId,
        table.isRead
      ),
    }
  }
)

export const userNotificationChannel = pgTable(
  'userNotificationChannel',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(), // telegram, slack, discord, whatsapp, webhook, push
    config: jsonb('config').notNull().default('{}'), // channel-specific config (chatId, channelId, etc.)
    enabled: boolean('enabled').notNull().default(true),
    categories: text('categories').array().notNull().default([]), // which notification categories to receive
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdx: index('user_notif_channel_user_idx').on(table.userId),
      enabledIdx: index('user_notif_channel_enabled_idx').on(table.enabled),
      userChannelUnique: uniqueIndex('user_notif_channel_user_channel_unique').on(
        table.userId,
        table.channel
      ),
    }
  }
)
