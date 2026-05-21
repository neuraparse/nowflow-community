import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  SchemaTable,
  text,
  timestamp,
  uniqueIndex,
} from './_common'
import { user } from './users'

// ============================================================================
// SUBSCRIPTIONS & BILLING
// ============================================================================

export const subscriptionPlan = pgTable('subscription_plan', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // 'free', 'pro', 'team', 'enterprise'
  displayName: text('display_name').notNull(), // 'Free', 'Pro', 'Team', 'Enterprise'
  workflowLimit: integer('workflow_limit').notNull(),
  apiCallsLimit: integer('api_calls_limit').notNull(), // per day
  storageLimit: integer('storage_limit').notNull(), // in MB
  costLimit: integer('cost_limit').notNull(), // in USD
  sharingEnabled: boolean('sharing_enabled').notNull().default(false),
  multiplayerEnabled: boolean('multiplayer_enabled').notNull().default(false),
  workspaceCollaborationEnabled: boolean('workspace_collaboration_enabled')
    .notNull()
    .default(false),
  price: integer('price'), // in cents, null for free
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const subscription = pgTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => subscriptionPlan.id, { onDelete: 'restrict' }),
    referenceId: text('reference_id').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: text('status'),
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end'),
    seats: integer('seats'),
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      // Reference ID lookup (user or organization ID)
      referenceIdIdx: index('subscription_reference_id_idx').on(table.referenceId),

      // Stripe customer lookup for webhooks
      stripeCustomerIdIdx: index('subscription_stripe_customer_id_idx').on(table.stripeCustomerId),

      // Stripe subscription lookup for webhooks
      stripeSubscriptionIdIdx: index('subscription_stripe_subscription_id_idx').on(
        table.stripeSubscriptionId
      ),

      // Status filtering (active, canceled, etc.)
      statusIdx: index('subscription_status_idx').on(table.status),
    }
  }
)

// ============================================================================
// AI CREDITS
// ============================================================================

export const aiCreditAccount = pgTable(
  'ai_credit_account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    balance: decimal('balance', { precision: 12, scale: 6 }).notNull().default('0'),
    totalUsed: decimal('total_used', { precision: 12, scale: 6 }).notNull().default('0'),
    totalPurchased: decimal('total_purchased', { precision: 12, scale: 6 }).notNull().default('0'),
    freeCreditsUsed: decimal('free_credits_used', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),
    freeCreditsLimit: decimal('free_credits_limit', { precision: 12, scale: 6 })
      .notNull()
      .default('1.00'), // $1 free credits
    byokEnabled: boolean('byok_enabled').notNull().default(false), // Bring Your Own Key
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: uniqueIndex('ai_credit_account_user_id_idx').on(table.userId),
    }
  }
)

export const aiCreditTransaction = pgTable(
  'ai_credit_transaction',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => aiCreditAccount.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // usage, purchase, refund, free_grant
    amount: decimal('amount', { precision: 12, scale: 6 }).notNull(),
    model: text('model'), // claude-3-opus, gpt-4, etc.
    tokensUsed: integer('tokens_used'),
    workflowId: text('workflow_id'),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      accountIdIdx: index('ai_credit_tx_account_id_idx').on(table.accountId),
      typeIdx: index('ai_credit_tx_type_idx').on(table.type),
      createdAtIdx: index('ai_credit_tx_created_at_idx').on(table.createdAt),
    }
  }
)

/**
 * Quota Rollover
 */
export const quotaRollover = pgTable(
  'quota_rollover',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id'),
    quotaType: text('quota_type').notNull(), // 'api_calls' | 'storage' | 'ai_credits' | 'workflows'
    amount: integer('amount').notNull(),
    period: text('period').notNull().default('monthly'),
    rolledFromDate: timestamp('rolled_from_date').notNull(),
    rolledToDate: timestamp('rolled_to_date').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    status: text('status').notNull().default('active'), // 'active' | 'expired' | 'consumed'
    consumedAmount: integer('consumed_amount').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      userIdIdx: index('quota_rollover_user_id_idx').on(table.userId),
      userQuotaTypeIdx: index('quota_rollover_user_quota_type_idx').on(
        table.userId,
        table.quotaType
      ),
      statusIdx: index('quota_rollover_status_idx').on(table.status),
      expiresAtIdx: index('quota_rollover_expires_at_idx').on(table.expiresAt),
    }
  }
)
