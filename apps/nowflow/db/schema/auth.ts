import {
  index,
  int8Number,
  integer,
  jsonb,
  pgTable,
  SchemaTable,
  text,
  timestamp,
  uniqueIndex,
} from './_common'
import { organization } from './organizations'
import { user } from './users'

// ============================================================================
// AUTHENTICATION & SESSIONS
// ============================================================================

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('active_organization_id').references(() => organization.id, {
      onDelete: 'set null',
    }),
  },
  (table: SchemaTable) => {
    return {
      // Token lookup on every auth request (unique already creates index)
      tokenIdx: index('session_token_idx').on(table.token),

      // User's active sessions
      userIdIdx: index('session_user_id_idx').on(table.userId),

      // Session cleanup (delete expired sessions)
      expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt),

      // Composite: User's unexpired sessions
      userExpiresIdx: index('session_user_expires_idx').on(table.userId, table.expiresAt),
    }
  }
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table: SchemaTable) => {
    return {
      // User's OAuth accounts lookup
      userIdIdx: index('account_user_id_idx').on(table.userId),

      // OAuth provider lookup
      providerAccountIdx: index('account_provider_account_idx').on(
        table.providerId,
        table.accountId
      ),

      // Composite index for finding user's accounts by provider
      userProviderIdx: index('account_user_provider_idx').on(table.userId, table.providerId),
    }
  }
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table: SchemaTable) => {
    return {
      identifierIdx: index('verification_identifier_idx').on(table.identifier),
      identifierValueIdx: index('verification_identifier_value_idx').on(
        table.identifier,
        table.value
      ),
    }
  }
)

export const rateLimit = pgTable(
  'rateLimit',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    count: integer('count').notNull(),
    lastRequest: int8Number('lastRequest').notNull(),
  },
  (table: SchemaTable) => {
    return {
      keyIdx: uniqueIndex('rate_limit_key_idx').on(table.key),
    }
  }
)

export const apiKey = pgTable(
  'api_key',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    key: text('key').notNull().unique(),
    lastUsed: timestamp('last_used'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (table: SchemaTable) => {
    return {
      // CRITICAL: Key lookup on EVERY API request
      // The unique constraint creates an index, but we explicitly define it for clarity
      keyIdx: index('api_key_key_idx').on(table.key),

      // User's API keys lookup
      userIdIdx: index('api_key_user_id_idx').on(table.userId),

      // Expired keys cleanup
      expiresAtIdx: index('api_key_expires_at_idx').on(table.expiresAt),
    }
  }
)

/**
 * Permission Table
 *
 * Defines granular permissions for workspace features.
 */
export const permission = pgTable(
  'permission',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    resource: text('resource').notNull(), // 'workflow' | 'deployment' | 'analytics' | 'settings' | 'team'
    action: text('action').notNull(), // 'create' | 'read' | 'update' | 'delete' | 'deploy' | 'execute'
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      resourceActionIdx: uniqueIndex('permission_resource_action_idx').on(
        table.resource,
        table.action
      ),
    }
  }
)

/**
 * Role Permission Table
 *
 * Maps roles to permissions.
 */
export const rolePermission = pgTable(
  'role_permission',
  {
    id: text('id').primaryKey(),
    role: text('role').notNull(), // 'owner' | 'admin' | 'editor' | 'viewer' | custom roles
    permissionId: text('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }), // null for global roles
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      rolePermissionIdx: uniqueIndex('role_permission_idx').on(
        table.role,
        table.permissionId,
        table.organizationId
      ),
      roleIdx: index('role_permission_role_idx').on(table.role),
    }
  }
)

/**
 * Audit Log Table
 *
 * Stores detailed audit logs for compliance.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organization.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    userEmail: text('user_email'),
    action: text('action').notNull(), // 'login' | 'logout' | 'create' | 'update' | 'delete' | 'deploy' | 'execute'
    resource: text('resource').notNull(), // 'workflow' | 'user' | 'deployment' | 'settings'
    resourceId: text('resource_id'),
    resourceName: text('resource_name'),
    details: jsonb('details'), // Action-specific details
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    sessionId: text('session_id'),
    severity: text('severity').notNull().default('info'), // 'info' | 'warning' | 'critical'
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      organizationIdIdx: index('audit_log_organization_id_idx').on(table.organizationId),
      userIdIdx: index('audit_log_user_id_idx').on(table.userId),
      actionIdx: index('audit_log_action_idx').on(table.action),
      resourceIdx: index('audit_log_resource_idx').on(table.resource, table.resourceId),
      createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
      severityIdx: index('audit_log_severity_idx').on(table.severity),
    }
  }
)
