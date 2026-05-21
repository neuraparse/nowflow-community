'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'
import { WorkspacePageHeader } from '@/app/w/components/workspace-shell'
import { ControlBar } from './components/control-bar/control-bar'
import { ErrorMessage } from './components/error-message'
import { MarketplaceEmptyState } from './components/marketplace-empty-state'
import { Section } from './components/section'
import { Toolbar } from './components/toolbar/toolbar'
import { WorkflowCard } from './components/workflow-card'
import { WorkflowCardSkeleton } from './components/workflow-card-skeleton'
import { CATEGORIES, getCategoryLabel } from './constants/categories'

const logger = createLogger('marketplace')

// Types
export interface Workflow {
  id: string
  name: string
  description: string
  author: string
  views: number
  rating: string
  ratingCount: number
  tags: string[]
  thumbnail?: string
  workflowUrl: string
  workflowState?: {
    blocks: Record<string, any>
    edges: Array<{
      id: string
      source: string
      target: string
      sourceHandle?: string
      targetHandle?: string
    }>
    loops: Record<string, any>
  }
}

// Updated interface to match API response format
export interface MarketplaceWorkflow {
  id: string
  workflowId: string
  name: string
  description: string
  authorName: string
  views: number
  rating: string
  ratingCount: number
  category: string
  createdAt: string
  updatedAt: string
  workflowState?: {
    blocks: Record<string, any>
    edges: Array<{
      id: string
      source: string
      target: string
      sourceHandle?: string
      targetHandle?: string
    }>
    loops: Record<string, any>
  }
}

export interface MarketplaceData {
  popular: MarketplaceWorkflow[]
  recent: MarketplaceWorkflow[]
  trending: MarketplaceWorkflow[]
  featured: MarketplaceWorkflow[]
  byCategory: Record<string, MarketplaceWorkflow[]>
}

// The order to display sections in, matching toolbar order
const SECTION_ORDER = [
  'featured',
  'trending',
  'popular',
  'recent',
  ...CATEGORIES.map((cat) => cat.value),
]

export default function Marketplace() {
  const { mode, isExpanded } = useSidebarStore()
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [minRating, setMinRating] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [marketplaceData, setMarketplaceData] = useState<MarketplaceData>({
    popular: [],
    recent: [],
    trending: [],
    featured: [],
    byCategory: {},
  })
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [loadedSections, setLoadedSections] = useState<Set<string>>(
    new Set(['featured', 'trending', 'popular', 'recent'])
  )
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set(['popular']))
  const [loadingSections, setLoadingSections] = useState<Set<string>>(new Set())

  // Create refs for each section
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const contentRef = useRef<HTMLDivElement>(null)
  const initialFetchCompleted = useRef(false)

  // Convert marketplace data to the format expected by components
  const workflowData = useMemo(() => {
    const mapWorkflow = (item: MarketplaceWorkflow): Workflow => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      author: item.authorName,
      views: item.views,
      rating: item.rating || '0.00',
      ratingCount: item.ratingCount || 0,
      tags: [item.category],
      workflowState: item.workflowState,
      workflowUrl: `/w/${item.workflowId}`,
    })

    const result: Record<string, Workflow[]> = {
      featured: marketplaceData.featured.map(mapWorkflow),
      trending: marketplaceData.trending.map(mapWorkflow),
      popular: marketplaceData.popular.map(mapWorkflow),
      recent: marketplaceData.recent.map(mapWorkflow),
    }

    // Add entries for each category
    Object.entries(marketplaceData.byCategory).forEach(([category, items]) => {
      if (items && items.length > 0) {
        result[category] = items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          author: item.authorName,
          views: item.views,
          rating: item.rating || '0.00',
          ratingCount: item.ratingCount || 0,
          tags: [item.category],
          workflowState: item.workflowState,
          workflowUrl: `/w/${item.workflowId}`,
        }))
      }
    })

    return result
  }, [marketplaceData])

  // Retry function for error recovery
  const retryFetch = () => {
    setError(null)
    initialFetchCompleted.current = false
    setMarketplaceData({
      popular: [],
      recent: [],
      trending: [],
      featured: [],
      byCategory: {},
    })
    fetchInitialData()
  }

  // Fetch workflows on component mount - improved to include state initially
  const fetchInitialData = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)

      // Fetch ALL data including categories, trending and featured in the initial load
      const [mainResponse, trendingResponse, featuredResponse] = await Promise.all([
        fetch('/api/marketplace/workflows?includeState=true&section=popular,recent,byCategory', {
          signal,
        }),
        fetch('/api/marketplace/trending', { signal }).catch(() => null),
        fetch('/api/marketplace/featured', { signal }).catch(() => null),
      ])

      if (!mainResponse.ok) {
        throw new Error('Failed to fetch marketplace data')
      }

      const data = await mainResponse.json()
      if (signal?.aborted) return

      // Parse trending and featured data
      const trendingJson = trendingResponse?.ok ? await trendingResponse.json() : { success: false }
      const featuredJson = featuredResponse?.ok ? await featuredResponse.json() : { success: false }
      if (signal?.aborted) return
      const trendingData = trendingJson.success ? trendingJson.data : []
      const featuredData = featuredJson.success ? featuredJson.data : []

      // Add all categories to loaded sections to avoid redundant load
      setLoadedSections((prev) => {
        const allSections = new Set([...prev])
        Object.keys(data.byCategory || {}).forEach((category) => {
          allSections.add(category)
        })
        return allSections
      })

      logger.debug(
        'Initial marketplace data loaded with categories:',
        data.popular?.length || 0,
        'popular,',
        data.recent?.length || 0,
        'recent,',
        trendingData?.length || 0,
        'trending,',
        featuredData?.length || 0,
        'featured,',
        'categories:',
        Object.keys(data.byCategory || {})
      )

      setMarketplaceData({
        ...data,
        trending: trendingData || [],
        featured: featuredData || [],
      })
      initialFetchCompleted.current = true

      // Set initial active section to featured if available, otherwise popular
      setActiveSection(featuredData?.length > 0 ? 'featured' : 'popular')
      setLoading(false)
    } catch (err) {
      const error = err as Error
      if (isAbortLikeError(error, signal)) {
        return
      }

      logger.error('Error fetching workflows:', error)
      setError(error.message || 'Failed to load workflows. Please try again later.')
      setLoading(false)
    }
  }

  useEffect(() => {
    const abortController = new AbortController()
    fetchInitialData(abortController.signal)

    return () => {
      abortController.abort()
    }
  }, [])

  // Lazy load category data when sections become visible
  const loadCategoryData = async (categoryName: string) => {
    if (loadedSections.has(categoryName)) {
      return // Already loaded, no need to fetch again
    }

    try {
      // Mark section as loading
      setLoadingSections((prev) => new Set([...prev, categoryName]))
      setLoadedSections((prev) => new Set([...prev, categoryName]))

      logger.debug(`Loading category: ${categoryName}`) // Debug

      const response = await fetch(
        `/api/marketplace/workflows?includeState=true&category=${categoryName}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch ${categoryName} category data`)
      }

      const data = await response.json()

      // Debug logging
      logger.debug(
        `Category data received:`,
        data.byCategory ? Object.keys(data.byCategory) : 'No byCategory',
        data.byCategory?.[categoryName]?.length || 0
      )

      // Check if we received any data in the category
      if (
        !data.byCategory ||
        !data.byCategory[categoryName] ||
        data.byCategory[categoryName].length === 0
      ) {
        logger.warn(`No items found for category: ${categoryName}`)
      }

      setMarketplaceData((prev) => ({
        ...prev,
        byCategory: {
          ...prev.byCategory,
          [categoryName]: data.byCategory?.[categoryName] || [],
        },
      }))
    } catch (error) {
      logger.error(`Error fetching ${categoryName} category:`, error)
      // We don't set a global error, just log it
    } finally {
      // Remove from loading sections
      setLoadingSections((prev) => {
        const updated = new Set(prev)
        updated.delete(categoryName)
        return updated
      })
    }
  }

  // Function to mark a workflow as needing state and fetch it if not available
  const ensureWorkflowState = async (workflowId: string) => {
    try {
      // Find which section contains this workflow
      let foundWorkflow: MarketplaceWorkflow | undefined

      // Check in popular section
      foundWorkflow = marketplaceData.popular.find((w) => w.id === workflowId)

      // Check in recent section if not found
      if (!foundWorkflow) {
        foundWorkflow = marketplaceData.recent.find((w) => w.id === workflowId)
      }

      // Check in category sections if not found
      if (!foundWorkflow) {
        for (const category of Object.keys(marketplaceData.byCategory)) {
          foundWorkflow = marketplaceData.byCategory[category].find((w) => w.id === workflowId)
          if (foundWorkflow) break
        }
      }

      // If we have the workflow but it doesn't have state, fetch it
      if (foundWorkflow && !foundWorkflow.workflowState) {
        const response = await fetch(
          `/api/marketplace/workflows?marketplaceId=${workflowId}&includeState=true`,
          {
            method: 'GET',
          }
        )

        if (response.ok) {
          const data = await response.json()

          // Update the workflow data with the state
          setMarketplaceData((prevData) => {
            const updatedData = { ...prevData }

            // Helper function to update workflow in a section
            const updateWorkflowInSection = (workflows: MarketplaceWorkflow[]) => {
              return workflows.map((w) =>
                w.id === workflowId
                  ? {
                      ...w,
                      workflowState: data.data.workflowState,
                    }
                  : w
              )
            }

            // Update in popular
            updatedData.popular = updateWorkflowInSection(updatedData.popular)

            // Update in recent
            updatedData.recent = updateWorkflowInSection(updatedData.recent)

            // Update in categories
            Object.keys(updatedData.byCategory).forEach((category) => {
              updatedData.byCategory[category] = updateWorkflowInSection(
                updatedData.byCategory[category]
              )
            })

            return updatedData
          })
        }
      }
    } catch (error) {
      logger.error(`Error ensuring workflow state for ${workflowId}:`, error)
    }
  }

  // Filter workflows based on search query, category, and rating
  const filteredWorkflows = useMemo(() => {
    const filtered: Record<string, Workflow[]> = {}

    Object.entries(workflowData).forEach(([category, workflows]) => {
      let matchingWorkflows = workflows

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        matchingWorkflows = matchingWorkflows.filter(
          (workflow) =>
            workflow.name.toLowerCase().includes(query) ||
            workflow.description.toLowerCase().includes(query) ||
            workflow.author.toLowerCase().includes(query) ||
            workflow.tags.some((tag) => tag.toLowerCase().includes(query))
        )
      }

      // Apply category filter
      if (selectedCategory !== 'all') {
        matchingWorkflows = matchingWorkflows.filter((workflow) =>
          workflow.tags.includes(selectedCategory)
        )
      }

      // Apply rating filter
      if (minRating > 0) {
        matchingWorkflows = matchingWorkflows.filter(
          (workflow) => parseFloat(workflow.rating) >= minRating
        )
      }

      if (matchingWorkflows.length > 0) {
        filtered[category] = matchingWorkflows
      }
    })

    return filtered
  }, [searchQuery, selectedCategory, minRating, workflowData])

  // Sort sections according to the toolbar order
  const sortedFilteredWorkflows = useMemo(() => {
    // Get entries from filteredWorkflows
    const entries = Object.entries(filteredWorkflows)

    // Sort based on the SECTION_ORDER
    entries.sort((a, b) => {
      const indexA = SECTION_ORDER.indexOf(a[0])
      const indexB = SECTION_ORDER.indexOf(b[0])

      // If both categories are in our predefined order, use that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      }

      // If only one category is in our order, prioritize it
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1

      // Otherwise, alphabetical order
      return a[0].localeCompare(b[0])
    })

    return entries
  }, [filteredWorkflows])

  // Function to scroll to a specific section
  const scrollToSection = (sectionId: string) => {
    if (sectionRefs.current[sectionId]) {
      // Load the section data if not already loaded
      if (!loadedSections.has(sectionId) && sectionId !== 'popular' && sectionId !== 'recent') {
        loadCategoryData(sectionId)
      }

      sectionRefs.current[sectionId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  // Setup intersection observer to track active section and load sections as they become visible
  useEffect(() => {
    if (!initialFetchCompleted.current) return

    // Function to get current section IDs in their display order
    const getCurrentSectionIds = () => {
      return Object.keys(filteredWorkflows).filter(
        (key) => filteredWorkflows[key] && filteredWorkflows[key].length > 0
      )
    }

    // Create intersection observer to detect when sections enter viewport
    const observeSections = () => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const sectionId = entry.target.id

            // Update visibility tracking
            if (entry.isIntersecting) {
              setVisibleSections((prev) => {
                const updated = new Set(prev)
                updated.add(sectionId)
                return updated
              })

              // Load category data if section is visible and not loaded yet
              if (
                !loadedSections.has(sectionId) &&
                sectionId !== 'popular' &&
                sectionId !== 'recent'
              ) {
                loadCategoryData(sectionId)
              }
            } else {
              setVisibleSections((prev) => {
                const updated = new Set(prev)
                updated.delete(sectionId)
                return updated
              })
            }
          })
        },
        {
          root: contentRef.current,
          rootMargin: '200px 0px', // Load sections slightly before they become visible
          threshold: 0.1,
        }
      )

      // Observe all sections
      Object.entries(sectionRefs.current).forEach(([id, ref]) => {
        if (ref) {
          observer.observe(ref)
        }
      })

      return observer
    }

    const observer = observeSections()

    // Use a single source of truth for determining the active section
    const determineActiveSection = () => {
      if (!contentRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = contentRef.current
      const viewportTop = scrollTop
      const viewportMiddle = viewportTop + clientHeight / 2
      const viewportBottom = scrollTop + clientHeight
      const isAtBottom = viewportBottom >= scrollHeight - 50
      const isAtTop = viewportTop <= 20

      const currentSectionIds = getCurrentSectionIds()

      // Handle edge cases first
      if (isAtTop && currentSectionIds.length > 0) {
        setActiveSection(currentSectionIds[0])
        return
      }

      if (isAtBottom && currentSectionIds.length > 0) {
        setActiveSection(currentSectionIds[currentSectionIds.length - 1])
        return
      }

      // Find section whose position is closest to middle of viewport
      // This creates smoother transitions as we scroll
      let closestSection = null
      let closestDistance = Infinity

      Object.entries(sectionRefs.current).forEach(([id, ref]) => {
        if (!ref || !currentSectionIds.includes(id)) return

        const rect = ref.getBoundingClientRect()
        const sectionTop = rect.top + scrollTop - contentRef.current!.getBoundingClientRect().top
        const sectionMiddle = sectionTop + rect.height / 2
        const distance = Math.abs(viewportMiddle - sectionMiddle)

        if (distance < closestDistance) {
          closestDistance = distance
          closestSection = id
        }
      })

      if (closestSection) {
        setActiveSection(closestSection)
      }
    }

    // Use a passive scroll listener for smooth transitions
    const handleScroll = () => {
      // Using requestAnimationFrame ensures we only calculate
      // section positions during a paint frame, reducing jank
      window.requestAnimationFrame(determineActiveSection)
    }

    const contentElement = contentRef.current
    contentElement?.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      observer.disconnect()
      contentElement?.removeEventListener('scroll', handleScroll)
    }
  }, [initialFetchCompleted.current, loading, filteredWorkflows, loadedSections])

  return (
    <div
      className={`workspace-stage flex flex-col h-dvh transition-all duration-300 ${isSidebarCollapsed ? 'pl-20' : 'pl-72'}`}
    >
      {/* Control Bar */}
      <ControlBar setSearchQuery={setSearchQuery} />

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <Toolbar
          scrollToSection={scrollToSection}
          activeSection={activeSection}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          minRating={minRating}
          onRatingChange={setMinRating}
        />

        {/* Main content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto py-8 px-6 pb-16">
          <WorkspacePageHeader
            eyebrow="Platform"
            title="Workflow"
            accent="Marketplace"
            description="Browse, discover, and install community workflows"
            className="mb-8"
          />
          {/* Enhanced error message with retry */}
          {error && (
            <div className="silver-glass-pane smoky-glass-pane mb-8 rounded-xl border border-rose-500/[0.16] bg-rose-500/[0.05] p-5 text-rose-700 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06] dark:text-rose-100">
              <div className="flex items-start gap-3">
                <div className="smoky-glass-chip flex h-8 w-8 items-center justify-center rounded-[10px] border border-rose-500/[0.16] bg-rose-500/[0.08] dark:border-rose-400/[0.14] dark:bg-rose-400/[0.08]">
                  <AlertCircle
                    className="h-4 w-4 text-rose-500 dark:text-rose-300"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-[13px] font-medium font-logo text-rose-700 dark:text-rose-100">
                    Unable to load marketplace
                  </h3>
                  <p className="mt-0.5 text-[12px] text-rose-700/75 dark:text-rose-100/70">
                    {error}
                  </p>
                  <button
                    onClick={retryFetch}
                    className="smoky-glass-chip mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-black/[0.06] px-3 py-1.5 text-[12px] font-medium font-logo text-zinc-700 transition-all duration-200 hover:bg-white/75 dark:border-white/[0.08] dark:text-white/80 dark:hover:bg-white/[0.08]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && !error && (
            <>
              <Section
                id="loading"
                title="Loading workflows..."
                ref={(el) => {
                  sectionRefs.current['loading'] = el
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <WorkflowCardSkeleton key={`skeleton-${index}`} />
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* Render workflow sections */}
          {!loading && !error && (
            <>
              {sortedFilteredWorkflows.map(
                ([category, workflows]) =>
                  workflows.length > 0 && (
                    <Section
                      key={category}
                      id={category}
                      title={getCategoryLabel(category)}
                      ref={(el) => {
                        if (el) {
                          sectionRefs.current[category] = el
                        }
                      }}
                    >
                      {loadingSections.has(category) ? (
                        // Show loading skeletons for this section
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {Array.from({ length: 3 }).map((_, index) => (
                            <WorkflowCardSkeleton key={`${category}-skeleton-${index}`} />
                          ))}
                        </div>
                      ) : (
                        // Show actual workflows
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {workflows.map((workflow, index) => (
                            <WorkflowCard
                              key={workflow.id}
                              workflow={workflow}
                              index={index}
                              onHover={ensureWorkflowState}
                            />
                          ))}
                        </div>
                      )}
                    </Section>
                  )
              )}

              {/* Enhanced empty state */}
              {sortedFilteredWorkflows.length === 0 && !loading && !error && (
                <MarketplaceEmptyState
                  hasFilters={!!searchQuery || selectedCategory !== 'all' || minRating > 0}
                  onClearFilters={() => {
                    setSearchQuery('')
                    setSelectedCategory('all')
                    setMinRating(0)
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
