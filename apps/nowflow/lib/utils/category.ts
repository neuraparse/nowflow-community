/**
 * Workflow category color helper.
 *
 * Extracted from `lib/utils.ts`. Maps category slug to a hex color used by
 * sidebar / dashboard / marketplace UI. Callers should import from
 * `@/lib/utils` (the canonical entry — re-exports this symbol).
 */

const CATEGORY_COLORS: Record<string, string> = {
  general: '#6B7280',
  'customer-service': '#3972F6',
  marketing: '#EC4899',
  'data-analysis': '#0EA5E9',
  education: '#F59E0B',
  healthcare: '#EF4444',
  ecommerce: '#6366F1',
}

/** Get a color hex code for a workflow category (defaults to neutral grey). */
export function getColorForCategory(category: string): string {
  return CATEGORY_COLORS[category] || '#6B7280'
}
