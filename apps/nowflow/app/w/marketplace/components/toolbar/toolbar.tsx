'use client'

import { useEffect, useState } from 'react'
import { Clock, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORIES, getCategoryIcon, getCategoryLabel } from '../../constants/categories'
import { SearchBar } from './search-bar'

export type MarketplaceCategory = 'popular' | 'programming' | 'marketing' | 'all'

interface ToolbarProps {
  scrollToSection: (sectionId: string) => void
  activeSection: string | null
  onSearch: (query: string) => void
  searchQuery: string
  selectedCategory: string
  onCategoryChange: (category: string) => void
  minRating: number
  onRatingChange: (rating: number) => void
}

// Map of special section icons
const specialIcons: Record<string, React.ReactNode> = {
  popular: <Star className="h-4 w-4 mr-2" />,
  recent: <Clock className="h-4 w-4 mr-2" />,
}

export function Toolbar({
  scrollToSection,
  activeSection,
  onSearch,
  searchQuery,
  selectedCategory,
  onCategoryChange,
  minRating,
  onRatingChange,
}: ToolbarProps) {
  const [categories, setCategories] = useState<string[]>([])

  // Set categories including special sections
  useEffect(() => {
    // Start with special sections like 'popular' and 'recent'
    const specialSections = ['popular', 'recent']

    // Add categories from centralized definitions
    const categoryValues = CATEGORIES.map((cat) => cat.value)

    // Put special sections first, then regular categories
    const allCategories = [...specialSections, ...categoryValues]

    setCategories(allCategories)
  }, [])

  return (
    <div className="p-4 w-60 border-r h-full overflow-auto">
      <SearchBar initialValue={searchQuery} onSearch={onSearch} placeholder="Search workflows..." />

      {/* Filters Section */}
      <div className="mb-6 mt-4">
        <h2 className="text-sm font-semibold font-logo mb-3 pl-2 text-zinc-800 dark:text-white">
          Filters
        </h2>
        <div className="space-y-3">
          {/* Category Filter */}
          <div className="px-2">
            <label className="text-xs text-zinc-400 dark:text-white/40 mb-1.5 block">
              Category
            </label>
            <Select value={selectedCategory} onValueChange={onCategoryChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rating Filter */}
          <div className="px-2">
            <label className="text-xs text-zinc-400 dark:text-white/40 mb-1.5 block">
              Minimum Rating
            </label>
            <Select
              value={minRating.toString()}
              onValueChange={(val) => onRatingChange(Number(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Ratings</SelectItem>
                <SelectItem value="4">4+ Stars</SelectItem>
                <SelectItem value="3">3+ Stars</SelectItem>
                <SelectItem value="2">2+ Stars</SelectItem>
                <SelectItem value="1">1+ Stars</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <h2 className="text-sm font-semibold font-logo mb-4 pl-2 text-zinc-800 dark:text-white">
        Categories
      </h2>
      <nav className="space-y-1">
        {categories.map((category) => (
          <Button
            key={category}
            variant="ghost"
            className={`w-full justify-start px-2 py-2 text-sm font-medium capitalize text-zinc-400 dark:text-white/40 transition-colors hover:text-zinc-800 dark:text-white ${
              activeSection === category
                ? 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-800 dark:text-white'
                : 'hover:bg-zinc-100/50 dark:hover:bg-white/[0.04]'
            }`}
            onClick={() => scrollToSection(category)}
          >
            {specialIcons[category] || getCategoryIcon(category)}
            {category === 'popular'
              ? 'Popular'
              : category === 'recent'
                ? 'Recent'
                : getCategoryLabel(category)}
          </Button>
        ))}
      </nav>
    </div>
  )
}
