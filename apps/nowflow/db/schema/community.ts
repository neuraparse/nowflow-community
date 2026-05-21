import { boolean, jsonb, pgTable, SchemaTable, text, timestamp, uniqueIndex } from './_common'

// ============================================================================
// COMMUNITY FUNNEL
// ============================================================================

export const waitlist = pgTable(
  'waitlist',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => ({
    emailUnique: uniqueIndex('waitlist_email_unique').on(table.email),
  })
)

export const emailTemplate = pgTable('email_template', {
  id: text('id').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  format: text('format').notNull().default('html'),
  editor: text('editor').notNull().default('raw'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  blocks: jsonb('blocks'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
