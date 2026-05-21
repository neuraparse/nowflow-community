import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  SchemaTable,
  text,
  timestamp,
  uniqueIndex,
} from './_common'
import { audience } from './audiences'
import { user } from './users'

// ============================================================================
// BLOG
// ============================================================================

export const blogCategory = pgTable(
  'blog_category',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      slugUnique: uniqueIndex('blog_category_slug_unique').on(table.slug),
    }
  }
)

export const blogTag = pgTable(
  'blog_tag',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      slugUnique: uniqueIndex('blog_tag_slug_unique').on(table.slug),
    }
  }
)

export const blogPost = pgTable(
  'blog_post',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    excerpt: text('excerpt'),
    content: text('content').notNull(),
    coverImage: text('cover_image'),
    coverImageAlt: text('cover_image_alt'),
    status: text('status').notNull().default('draft'),
    publishedAt: timestamp('published_at'),
    authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
    authorName: text('author_name'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    canonicalUrl: text('canonical_url'),
    ogImage: text('og_image'),
    readingTime: integer('reading_time').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    categoryId: text('category_id').references(() => blogCategory.id, { onDelete: 'set null' }),
    sendEmailOnPublish: boolean('send_email_on_publish').notNull().default(true),
    emailSubject: text('email_subject'),
    emailSentAt: timestamp('email_sent_at'),
    emailAudienceId: text('email_audience_id').references(() => audience.id, {
      onDelete: 'set null',
    }),
    emailOnlyVerified: boolean('email_only_verified').notNull().default(true),
    emailIncludeContacts: boolean('email_include_contacts').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      slugUnique: uniqueIndex('blog_post_slug_unique').on(table.slug),
      statusPublishedIdx: index('blog_post_status_published_idx').on(
        table.status,
        table.publishedAt
      ),
      categoryIdIdx: index('blog_post_category_id_idx').on(table.categoryId),
    }
  }
)

export const blogPostTag = pgTable(
  'blog_post_tag',
  {
    postId: text('post_id')
      .notNull()
      .references(() => blogPost.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => blogTag.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table: SchemaTable) => {
    return {
      pk: primaryKey({ columns: [table.postId, table.tagId], name: 'blog_post_tag_pk' }),
    }
  }
)
