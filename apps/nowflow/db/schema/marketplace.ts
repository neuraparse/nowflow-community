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

// ============================================================================
// MARKETPLACE
// ============================================================================

export const marketplace = pgTable(
  'marketplace',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    state: jsonb('state').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    views: integer('views').notNull().default(0),
    useCount: integer('use_count').notNull().default(0),
    category: text('category'),
    tags: jsonb('tags').default('[]'),
    difficultyLevel: text('difficulty_level').default('beginner'),
    isExample: boolean('is_example').notNull().default(false),
    exampleOrder: integer('example_order'),
    rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'),
    ratingCount: integer('rating_count').notNull().default(0),

    // Review approval status
    status: text('status').notNull().default('pending'),
    active: boolean('active').notNull().default(true),
    approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      statusIdx: index('marketplace_status_idx').on(table.status),
      statusActiveIdx: index('marketplace_status_active_idx').on(table.status, table.active),
      statusCategoryIdx: index('marketplace_status_category_idx').on(table.status, table.category),
      authorIdIdx: index('marketplace_author_id_idx').on(table.authorId),
    }
  }
)

export const marketplaceRating = pgTable(
  'marketplace_rating',
  {
    id: text('id').primaryKey(),
    marketplaceId: text('marketplace_id')
      .notNull()
      .references(() => marketplace.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(), // 1-5 stars
    review: text('review'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => ({
    userMarketplaceUnique: uniqueIndex('user_marketplace_rating_unique').on(
      table.userId,
      table.marketplaceId
    ),
  })
)

// ============================================================================
// TEMPLATE GALLERY ENHANCEMENTS
// ============================================================================

export const templateCategory = pgTable(
  'template_category',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    icon: text('icon'),
    parentId: text('parent_id').references((): any => templateCategory.id, {
      onDelete: 'set null',
    }),
    order: integer('order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      slugIdx: index('template_category_slug_idx').on(table.slug),
      parentIdx: index('template_category_parent_idx').on(table.parentId),
    }
  }
)

export const templateCollection = pgTable(
  'template_collection',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    coverImage: text('cover_image'),
    curatedBy: text('curated_by').references(() => user.id, { onDelete: 'set null' }),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    templateIds: jsonb('template_ids').notNull().default('[]'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      slugIdx: index('template_collection_slug_idx').on(table.slug),
      featuredIdx: index('template_collection_featured_idx').on(table.isFeatured),
    }
  }
)
