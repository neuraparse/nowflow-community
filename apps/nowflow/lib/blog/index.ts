/**
 * Barrel export for the blog tooling namespace.
 *
 * Consolidates tag normalization, post slugify / reading-time helpers, and
 * publication email rendering + delivery into a single import site.
 * Existing nested-path imports keep working.
 */

export { normalizeTags, resolveTagIds } from './tags'
export type { TagInput } from './tags'

export { estimateReadingTime, slugify } from './utils'

export { renderBlogEmailBody, sendBlogPublicationEmail } from './email'
export type { BlogEmailPayload, BlogEmailSendResult } from './email'
