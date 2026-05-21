import {
  boolean,
  index,
  integer,
  pgTable,
  SchemaTable,
  text,
  timestamp,
  uniqueIndex,
} from './_common'
import { organization } from './organizations'
import { user } from './users'

// ============================================================================
// WORKSPACES
// ============================================================================

export const workspace = pgTable(
  'workspace',
  {
    /** Workspace'in benzersiz ID'si */
    id: text('id').primaryKey(),

    /** Workspace adi */
    name: text('name').notNull(),

    /** Workspace sahibinin kullanici ID'si (cascade delete) */
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Organization ID'si (opsiyonel, cascade delete) */
    organizationId: text('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }),

    /** Kullanilan storage (bytes cinsinden) */
    storageUsed: integer('storage_used').notNull().default(0),

    /** Research consent — workspace owner explicitly opted in to anonymized,
     *  aggregate research use of telemetry. Required gate for any extraction
     *  feeding academic papers (HCIN). Default false; off until owner opts in. */
    researchConsent: boolean('research_consent').notNull().default(false),

    /** Timestamp of the research-consent decision (set or revoked). */
    researchConsentAt: timestamp('research_consent_at'),

    /** Olusturulma tarihi */
    createdAt: timestamp('created_at').notNull().defaultNow(),

    /** Son guncellenme tarihi */
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      // User's workspaces lookup
      ownerIdIdx: index('workspace_owner_id_idx').on(table.ownerId),

      // Organization workspaces lookup
      organizationIdIdx: index('workspace_organization_id_idx').on(table.organizationId),

      // Research-consent filter for paper extraction queries
      researchConsentIdx: index('workspace_research_consent_idx').on(table.researchConsent),
    }
  }
)

export const workspaceMember = pgTable(
  'workspace_member',
  {
    /** Uyelik kaydinin benzersiz ID'si */
    id: text('id').primaryKey(),

    /** Workspace ID'si (cascade delete) */
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),

    /** Kullanici ID'si (cascade delete) */
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Kullanicinin rolu: 'owner', 'admin', 'member' */
    role: text('role').notNull().default('member'),

    /** Workspace'e katilma tarihi */
    joinedAt: timestamp('joined_at').notNull().defaultNow(),

    /** Son guncellenme tarihi */
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      // Unique index: Bir kullanici ayni workspace'e birden fazla kez eklenemez
      userIdIdx: uniqueIndex('user_workspace_idx').on(table.userId, table.workspaceId),
    }
  }
)
