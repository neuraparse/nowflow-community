/**
 * Barrel export for the marketplace namespace.
 *
 * Currently a single-module domain (trending calculation + featured + per-category
 * listings + rating + usage tracking). Wrapped in a barrel so future split into
 * trending / featured / rating sub-modules doesn't break callers.
 */

export {
  getFeaturedTemplates,
  getTemplatesByCategory,
  getTrendingTemplates,
  incrementUsage,
  rateTemplate,
  setFeatured,
} from './trending-calculator'
export type { TrendingTemplate } from './trending-calculator'
