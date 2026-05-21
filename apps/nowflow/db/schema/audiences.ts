import {
  boolean,
  index,
  jsonb,
  pgTable,
  SchemaTable,
  text,
  timestamp,
  uniqueIndex,
} from './_common'
import { user } from './users'

// ============================================================================
// AUDIENCES
// ============================================================================

export const audience = pgTable(
  'audience',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').notNull().default('static'),
    source: text('source').notNull().default('users'),
    rules: jsonb('rules'),
    isArchived: boolean('is_archived').notNull().default(false),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      nameUnique: uniqueIndex('audience_name_unique').on(table.name),
    }
  }
)

export const audienceContact = pgTable(
  'audience_contact',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    status: text('status').notNull().default('subscribed'),
    source: text('source').notNull().default('manual'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      emailUnique: uniqueIndex('audience_contact_email_unique').on(table.email),
    }
  }
)

export const audienceMember = pgTable(
  'audience_member',
  {
    id: text('id').primaryKey(),
    audienceId: text('audience_id')
      .notNull()
      .references(() => audience.id, { onDelete: 'cascade' }),
    memberType: text('member_type').notNull(),
    memberKey: text('member_key').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => audienceContact.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      audienceMemberUnique: uniqueIndex('audience_member_unique').on(
        table.audienceId,
        table.memberKey
      ),
      audienceMemberIdx: index('audience_member_idx').on(table.audienceId, table.createdAt),
    }
  }
)
