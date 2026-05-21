'use client'

import { Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * MarketplaceEmptyStateProps interface - defines the properties for the MarketplaceEmptyState component
 * @property {Function} onClearFilters - Optional callback to clear search filters
 * @property {boolean} hasFilters - Whether filters are currently applied
 */
interface MarketplaceEmptyStateProps {
  onClearFilters?: () => void
  hasFilters?: boolean
}

/**
 * MarketplaceEmptyState component - Displays an empty state message
 * Shows different messages based on whether filters are applied
 */
export function MarketplaceEmptyState({
  onClearFilters,
  hasFilters = false,
}: MarketplaceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-zinc-100 dark:bg-white/[0.06]">
        {hasFilters ? (
          <Search className="h-6 w-6 text-zinc-400 dark:text-white/40" />
        ) : (
          <Sparkles className="h-6 w-6 text-zinc-400 dark:text-white/40" />
        )}
      </div>
      <h3 className="font-semibold font-logo text-base text-zinc-800 dark:text-white mb-2">
        {hasFilters ? 'No workflows found' : 'No workflows available'}
      </h3>
      <p className="text-sm text-zinc-400 dark:text-white/40 text-center max-w-sm mb-4">
        {hasFilters
          ? 'Try adjusting your search filters or browse all workflows.'
          : 'Check back soon for new workflow templates from the community.'}
      </p>
      {hasFilters && onClearFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
