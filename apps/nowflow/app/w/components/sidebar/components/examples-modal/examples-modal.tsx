'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, X } from 'lucide-react'
import { ModernTemplatesIcon } from '@/components/modern-sidebar-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createLogger } from '@/lib/logs/console-logger'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { fetchWorkflowsFromDB } from '@/stores/workflows/sync'
import { ExampleCard } from '@/app/w/examples/components/example-card'
import { ExampleCardSkeleton } from '@/app/w/examples/components/example-card-skeleton'
import exampleWorkflows, { workflowCategories } from '@/examples/workflows/index'

const logger = createLogger('ExamplesModal')

interface ExamplesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExamplesModal({ open, onOpenChange }: ExamplesModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('general')
  const router = useRouter()
  const { createWorkflow } = useWorkflowRegistry()

  // Process example workflows
  const examples = useMemo(() => {
    return Object.entries(exampleWorkflows).map(([id, workflow]) => ({
      id,
      name: workflow.metadata.name,
      description: workflow.metadata.description,
      category: workflow.metadata.category,
      tags: workflow.metadata.tags,
    }))
  }, [])

  // Filter examples based on search query
  const filteredExamples = useMemo(() => {
    const result: Record<string, any[]> = {}

    // Initialize categories
    workflowCategories.forEach((category) => {
      result[category.id] = []
    })

    // Filter examples
    examples.forEach((example) => {
      const matchesSearch =
        searchQuery === '' ||
        example.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        example.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        example.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      if (matchesSearch) {
        const category = example.category
        if (result[category]) {
          result[category].push(example)
        }
      }
    })

    return result
  }, [examples, searchQuery])

  // Create a workflow from an example
  const handleCreateFromExample = async (exampleId: string) => {
    try {
      setLoading(true)
      logger.info('Creating workflow from example', { exampleId })

      const response = await fetch(`/api/workflows/example?exampleId=${exampleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          (errorData && typeof errorData.message === 'string' && errorData.message) ||
          (errorData && typeof errorData.error === 'string' && errorData.error) ||
          `Failed to create workflow from example: ${response.status} ${response.statusText}`

        logger.error('Server error creating workflow', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          code: errorData && typeof errorData.code === 'string' ? errorData.code : undefined,
        })
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Log the response data
      logger.info('Workflow created from example', { data })

      // Close modal first
      onOpenChange(false)

      // Force registry refresh to show the new workflow
      try {
        // Wait a moment before refreshing to ensure the database has time to complete the transaction
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Refresh the workflow registry
        await fetchWorkflowsFromDB()
        logger.info('Workflow registry refreshed successfully')

        // Wait another moment to ensure the registry is fully updated
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (refreshError) {
        logger.error('Error refreshing workflow registry', { error: refreshError })
      }

      // Navigate to the new workflow
      router.push(`/w/${data.id}`)
    } catch (error) {
      logger.error('Failed to create workflow from example', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
      })
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to create workflow from example. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Simulate loading for a better UX
  useEffect(() => {
    if (open) {
      setLoading(true)
      const timer = setTimeout(() => {
        setLoading(false)
      }, 800)

      return () => clearTimeout(timer)
    }
  }, [open])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setError(null)
      setActiveCategory('general')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[900px] max-h-[80vh] flex flex-col p-0 gap-0 rounded-[16px]"
        hideCloseButton
      >
        <DialogHeader className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10]">
                <ModernTemplatesIcon className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
              </div>
              <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                Example Workflows
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-0 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-200"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4 text-black/50 dark:text-white/60" strokeWidth={1.5} />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <DialogDescription className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
            Browse and use pre-built workflows for different use cases
          </DialogDescription>

          {/* Search input */}
          <div className="relative mt-4">
            <Input
              type="search"
              placeholder="Search examples..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 text-[13px] font-logo rounded-lg border-black/[0.08] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] text-black/80 dark:text-white/85 placeholder:text-black/25 dark:placeholder:text-white/25 focus:border-[#4A7A68]/30 dark:focus:border-[#94B8A6]/25"
            />
          </div>
        </DialogHeader>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-[12px] font-logo text-red-500/70 dark:text-red-400/70 mt-2 mb-2 px-6">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Categories and examples */}
        <div className="flex-1 overflow-hidden px-6 pt-4">
          <Tabs defaultValue="general" value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="mb-4 flex flex-wrap bg-transparent gap-1 p-0">
              {workflowCategories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="capitalize text-[12px] font-logo rounded-lg px-3 py-1.5 text-black/50 dark:text-white/45 data-[state=active]:bg-[#4A7A68]/[0.10] dark:data-[state=active]:bg-[#94B8A6]/[0.12] data-[state=active]:text-[#4A7A68] dark:data-[state=active]:text-[#94B8A6] data-[state=active]:border data-[state=active]:border-[#4A7A68]/20 dark:data-[state=active]:border-[#94B8A6]/15 data-[state=active]:shadow-sm hover:text-black/70 dark:hover:text-white/65 transition-all duration-200"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="h-[calc(80vh-220px)]">
              {workflowCategories.map((category) => (
                <TabsContent key={category.id} value={category.id} className="mt-0">
                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <ExampleCardSkeleton key={`skeleton-${index}`} />
                      ))}
                    </div>
                  ) : (
                    <>
                      {filteredExamples[category.id]?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
                          {filteredExamples[category.id].map((example) => (
                            <ExampleCard
                              key={example.id}
                              id={example.id}
                              title={example.title}
                              description={example.description}
                              category={example.category}
                              difficulty={example.difficulty}
                              tags={example.tags}
                              previewUrl={example.previewUrl}
                              onUse={() => handleCreateFromExample(example.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64">
                          <AlertCircle className="h-8 w-8 text-black/15 dark:text-white/15 mb-4" />
                          <p className="text-[13px] font-logo text-black/40 dark:text-white/40">
                            No example workflows found in this category.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
