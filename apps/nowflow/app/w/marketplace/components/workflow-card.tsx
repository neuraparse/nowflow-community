'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { createLogger } from '@/lib/logs/console-logger'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { WorkflowPreview } from '@/app/w/components/workflow-preview/generic-workflow-preview'
import { Workflow } from '../marketplace'
import { ReviewDialog } from './review-dialog'

const logger = createLogger('workflow-card')

/**
 * WorkflowCardProps interface - defines the properties for the WorkflowCard component
 * @property {Workflow} workflow - The workflow data to display
 * @property {number} index - The index of the workflow in the list
 * @property {Function} onHover - Optional callback function triggered when card is hovered
 */
interface WorkflowCardProps {
  workflow: Workflow
  index: number
  onHover?: (id: string) => void
}

/**
 * WorkflowCard component - Displays a workflow in a card format
 * Shows either a workflow preview, thumbnail image, or fallback text
 * State is now pre-loaded in most cases, fallback to load on hover if needed
 */
export function WorkflowCard({ workflow, onHover }: WorkflowCardProps) {
  const [isPreviewReady, setIsPreviewReady] = useState(!!workflow.workflowState)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const router = useRouter()
  const { createWorkflow } = useWorkflowRegistry()

  // When workflow state becomes available, update preview ready state
  useEffect(() => {
    if (workflow.workflowState && !isPreviewReady) {
      setIsPreviewReady(true)
    }
  }, [workflow.workflowState, isPreviewReady])

  /**
   * Handle mouse enter event
   * Sets hover state and triggers onHover callback to load workflow state if needed
   */
  const handleMouseEnter = () => {
    if (onHover && !workflow.workflowState) {
      onHover(workflow.id)
    }
  }

  /**
   * Handle workflow card click - track views and import workflow
   */
  const handleClick = async (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on the rate button
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    try {
      // Track view
      await fetch(`/api/marketplace/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: workflow.id }),
      })

      // Create a local copy of the marketplace workflow
      if (workflow.workflowState) {
        const newWorkflowId = await createWorkflow({
          name: `${workflow.name} (Copy)`,
          description: workflow.description,
          marketplaceId: workflow.id,
          marketplaceState: workflow.workflowState,
        })

        if (newWorkflowId) {
          // Navigate to the new workflow
          router.push(`/w/${newWorkflowId}`)
        } else {
          logger.error(
            'Failed to create workflow from marketplace - workflow limit may be exceeded'
          )
        }
      } else {
        logger.error('Cannot import workflow: state is not available')
      }
    } catch (error) {
      logger.error('Failed to handle workflow click:', error)
    }
  }

  /**
   * Handle rate button click
   */
  const handleRateClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowReviewDialog(true)
  }

  return (
    <div
      className="block cursor-pointer"
      aria-label={`View ${workflow.name} workflow`}
      onClick={handleClick}
    >
      <Card
        className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20 hover:-translate-y-0.5 flex flex-col h-full border-black/[0.06] dark:border-white/[0.06]"
        onMouseEnter={handleMouseEnter}
      >
        {/* Workflow preview/thumbnail area */}
        <div className="h-48 relative overflow-hidden bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border-b border-black/[0.04] dark:border-white/[0.04]">
          {isPreviewReady && workflow.workflowState ? (
            <div className="absolute inset-0">
              <WorkflowPreview workflowState={workflow.workflowState} />
            </div>
          ) : workflow.thumbnail ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{
                backgroundImage: `url(${workflow.thumbnail})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
              }}
            ></div>
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-zinc-400 dark:text-white/40/60 font-medium text-lg">
                {workflow.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col flex-grow">
          {/* Workflow title */}
          <CardHeader className="p-4 pb-2">
            <h3 className="font-medium font-logo text-sm text-zinc-800 dark:text-white">
              {workflow.name}
            </h3>
          </CardHeader>
          {/* Workflow description */}
          <CardContent className="p-4 pt-0 pb-2 flex-grow flex flex-col">
            <p className="text-xs text-zinc-400 dark:text-white/40 line-clamp-2">
              {workflow.description}
            </p>
          </CardContent>
          {/* Footer with author and stats */}
          <CardFooter className="p-4 pt-2 mt-auto flex justify-between items-center">
            <div className="text-xs text-zinc-400 dark:text-white/40">by {workflow.author}</div>
            <div className="flex items-center space-x-3">
              {/* Rating */}
              {workflow.ratingCount > 0 && (
                <div className="flex items-center space-x-1">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-medium text-zinc-400 dark:text-white/40">
                    {parseFloat(workflow.rating).toFixed(1)}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-white/40">
                    ({workflow.ratingCount})
                  </span>
                </div>
              )}
              {/* Views */}
              <div className="flex items-center space-x-1">
                <Eye className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40" />
                <span className="text-xs font-medium text-zinc-400 dark:text-white/40">
                  {workflow.views}
                </span>
              </div>
              {/* Rate Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRateClick}
                className="h-7 px-2 text-xs"
                aria-label="Rate this workflow"
              >
                <Star className="h-3 w-3 mr-1" />
                Rate
              </Button>
            </div>
          </CardFooter>
        </div>
      </Card>

      {/* Review Dialog */}
      <ReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        workflowId={workflow.id}
        workflowName={workflow.name}
        onSubmitSuccess={() => {
          // Optionally refresh the workflow data to show updated rating
          // This could trigger a refetch of the workflow from the parent component
        }}
      />
    </div>
  )
}
