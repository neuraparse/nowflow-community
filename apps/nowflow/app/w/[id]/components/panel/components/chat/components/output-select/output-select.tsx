import { useMemo } from 'react'
import { Check, ChevronDown, MessageSquare, Sparkles, Zap } from 'lucide-react'
import {
  ModernAgentIcon,
  ModernApiIcon,
  ModernConditionIcon,
  ModernDataIcon,
  ModernFunctionIcon,
  ModernModelIcon,
  ModernRouterIcon,
  ModernStartIcon,
} from '@/components/modern-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks'
import { resolveOutputType } from '@/blocks/utils'

interface OutputSelectProps {
  workflowId: string | null
  selectedOutputs: string[]
  onOutputSelect: (outputIds: string[]) => void
  disabled?: boolean
  placeholder?: string
}

export function OutputSelect({
  workflowId,
  selectedOutputs = [],
  onOutputSelect,
  disabled = false,
  placeholder = 'Select output sources',
}: OutputSelectProps) {
  const blocks = useWorkflowStore((state) => state.blocks)

  // Get workflow outputs for the dropdown
  const workflowOutputs = useMemo(() => {
    const outputs: {
      id: string
      label: string
      blockId: string
      blockName: string
      blockType: string
      path: string
    }[] = []

    if (!workflowId) return outputs

    // Process blocks to extract outputs
    Object.values(blocks).forEach((block) => {
      // Skip starter/start blocks
      if (block.type === 'starter') return

      // Safely get block name, using fallbacks if name is undefined
      const blockName = (block.name || block.type || 'unnamed').replace(/\s+/g, '').toLowerCase()

      const blockOutputs =
        block.outputs && Object.keys(block.outputs).length > 0
          ? block.outputs
          : (() => {
              const blockConfig = getBlock(block.type)
              if (!blockConfig?.outputs) return null
              return resolveOutputType(blockConfig.outputs, block.subBlocks || {})
            })()

      // Add response outputs
      if (blockOutputs && typeof blockOutputs === 'object') {
        const addOutput = (path: string, outputObj: any, prefix = '') => {
          const fullPath = prefix ? `${prefix}.${path}` : path

          if (typeof outputObj === 'object' && outputObj !== null) {
            // For objects, recursively add each property
            Object.entries(outputObj).forEach(([key, value]) => {
              addOutput(key, value, fullPath)
            })
          } else {
            // Add leaf node as output option
            outputs.push({
              id: `${block.id}_${fullPath}`,
              label: `${blockName}.${fullPath}`,
              blockId: block.id,
              blockName: block.name || block.type || 'unnamed',
              blockType: block.type,
              path: fullPath,
            })
          }
        }

        // Start with the response object
        if ((blockOutputs as any).response) {
          addOutput('response', (blockOutputs as any).response)
        }
      }
    })

    return outputs
  }, [blocks, workflowId])

  // Get selected outputs display text
  const selectedOutputsDisplayText = useMemo(() => {
    if (!selectedOutputs || selectedOutputs.length === 0) {
      return placeholder
    }

    // Ensure all selected outputs exist in the workflowOutputs array
    const validOutputs = selectedOutputs.filter((id) => workflowOutputs.some((o) => o.id === id))

    if (validOutputs.length === 0) {
      return placeholder
    }

    if (validOutputs.length === 1) {
      const output = workflowOutputs.find((o) => o.id === validOutputs[0])
      if (output) {
        const safeBlockName = (output.blockName || 'unnamed').replace(/\s+/g, '').toLowerCase()
        return `${safeBlockName}.${output.path}`
      }
      return placeholder
    }

    return `${validOutputs.length} outputs selected`
  }, [selectedOutputs, workflowOutputs, placeholder])

  // Get first selected output info for display icon
  const selectedOutputInfo = useMemo(() => {
    if (!selectedOutputs || selectedOutputs.length === 0) return null

    const validOutputs = selectedOutputs.filter((id) => workflowOutputs.some((o) => o.id === id))
    if (validOutputs.length === 0) return null

    const output = workflowOutputs.find((o) => o.id === validOutputs[0])
    if (!output) return null

    return {
      blockName: output.blockName,
      blockId: output.blockId,
      blockType: output.blockType,
      path: output.path,
    }
  }, [selectedOutputs, workflowOutputs])

  const isDisabled = disabled || workflowOutputs.length === 0

  // Group output options by block
  const groupedOutputs = useMemo(() => {
    const groups: Record<string, typeof workflowOutputs> = {}
    const blockDistances: Record<string, number> = {}
    const edges = useWorkflowStore.getState().edges

    // Find the starter block
    const starterBlock = Object.values(blocks).find((block) => block.type === 'starter')
    const starterBlockId = starterBlock?.id

    // Calculate distances from starter block if it exists
    if (starterBlockId) {
      // Build an adjacency list for faster traversal
      const adjList: Record<string, string[]> = {}
      for (const edge of edges) {
        if (!adjList[edge.source]) {
          adjList[edge.source] = []
        }
        adjList[edge.source].push(edge.target)
      }

      // BFS to find distances from starter block
      const visited = new Set<string>()
      const queue: [string, number][] = [[starterBlockId, 0]] // [nodeId, distance]

      while (queue.length > 0) {
        const [currentNodeId, distance] = queue.shift()!

        if (visited.has(currentNodeId)) continue
        visited.add(currentNodeId)
        blockDistances[currentNodeId] = distance

        // Get all outgoing edges from the adjacency list
        const outgoingNodeIds = adjList[currentNodeId] || []

        // Add all target nodes to the queue with incremented distance
        for (const targetId of outgoingNodeIds) {
          queue.push([targetId, distance + 1])
        }
      }
    }

    // Group by block name
    workflowOutputs.forEach((output) => {
      if (!groups[output.blockName]) {
        groups[output.blockName] = []
      }
      groups[output.blockName].push(output)
    })

    // Convert to array of [blockName, outputs] for sorting
    const groupsArray = Object.entries(groups).map(([blockName, outputs]) => {
      // Find the blockId for this group (using the first output's blockId)
      const blockId = outputs[0]?.blockId
      // Get the distance for this block (or default to 0 if not found)
      const distance = blockId ? blockDistances[blockId] || 0 : 0
      return { blockName, outputs, distance }
    })

    // Sort by distance (descending - furthest first)
    groupsArray.sort((a, b) => b.distance - a.distance)

    // Convert back to record
    return groupsArray.reduce(
      (acc, { blockName, outputs }) => {
        acc[blockName] = outputs
        return acc
      },
      {} as Record<string, typeof workflowOutputs>
    )
  }, [workflowOutputs, blocks])

  // Get modern icon for block type
  const getBlockIcon = (blockType: string) => {
    switch (blockType) {
      case 'agent':
      case 'content_creation_agent':
      case 'customer_service_agent':
      case 'data_analysis_agent':
      case 'function_calling_agent':
        return ModernAgentIcon
      case 'function':
        return ModernFunctionIcon
      case 'router':
        return ModernRouterIcon
      case 'api':
        return ModernApiIcon
      case 'starter':
        return ModernStartIcon
      case 'condition':
        return ModernConditionIcon
      case 'data':
      case 'sqlite':
      case 'mongodb':
      case 'supabase':
      case 'pinecone':
        return ModernDataIcon
      case 'model':
        return ModernModelIcon
      default:
        return Sparkles
    }
  }

  // Get output path description
  const getOutputDescription = (path: string) => {
    if (path.includes('response.content')) return 'AI response text'
    if (path.includes('response.model')) return 'Model used'
    if (path.includes('response.tokens')) return 'Token usage'
    if (path.includes('response')) return 'Full response'
    if (path.includes('result')) return 'Execution result'
    if (path.includes('data')) return 'Output data'
    return path
  }

  // Handle output selection - toggle selection
  const handleOutputSelection = (value: string) => {
    let newSelectedOutputs: string[]
    const index = selectedOutputs.indexOf(value)

    if (index === -1) {
      newSelectedOutputs = [...new Set([...selectedOutputs, value])]
    } else {
      newSelectedOutputs = selectedOutputs.filter((id) => id !== value)
    }

    onOutputSelect(newSelectedOutputs)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isDisabled}>
        <button
          type="button"
          disabled={isDisabled}
          aria-disabled={isDisabled}
          className={cn(
            'workflow-editor-chat-output-trigger group flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors',
            'hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
            'data-[state=open]:border-ring data-[state=open]:bg-muted data-[state=open]:ring-2 data-[state=open]:ring-ring/30',
            isDisabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {selectedOutputInfo ? (
            <div className="flex items-center gap-3 w-[calc(100%-28px)] overflow-hidden">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                {(() => {
                  const IconComponent = getBlockIcon(selectedOutputInfo.blockType)
                  return <IconComponent className="h-4 w-4 text-muted-foreground" />
                })()}
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate text-sm font-medium text-foreground">
                  {selectedOutputsDisplayText}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {getOutputDescription(selectedOutputInfo.path)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-[calc(100%-28px)] overflow-hidden">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="truncate text-muted-foreground">{placeholder}</span>
            </div>
          )}
          <div
            className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-colors')}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="workflow-editor-chat-output-menu w-[var(--radix-dropdown-menu-trigger-width)] max-h-[400px] overflow-y-auto rounded-lg border border-border bg-popover p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-popover-foreground">
              Select Response Source
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Choose which block outputs to display in chat
          </p>
        </div>

        {Object.entries(groupedOutputs).map(([blockName, outputs]) => {
          const blockType = outputs[0]?.blockType || 'agent'
          const BlockIcon = getBlockIcon(blockType)

          return (
            <DropdownMenuGroup key={blockName}>
              <DropdownMenuLabel className="flex items-center gap-2 bg-muted px-4 py-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-border bg-background">
                  <BlockIcon className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{blockName}</span>
              </DropdownMenuLabel>

              {outputs.map((output) => {
                const isSelected = selectedOutputs.includes(output.id)
                return (
                  <DropdownMenuItem
                    key={output.id}
                    // Multi-select menu: prevent the default close-on-select
                    // so the user can toggle several outputs without the
                    // dropdown slamming shut after each click. Outside-click
                    // + ESC still close it normally.
                    onSelect={(e) => {
                      e.preventDefault()
                      handleOutputSelection(output.id)
                    }}
                    className={cn(
                      'mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 outline-none transition-colors',
                      'data-[highlighted]:bg-muted focus:bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>

                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="truncate text-sm font-medium text-popover-foreground">
                        {output.path}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {getOutputDescription(output.path)}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="flex-shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          )
        })}

        <DropdownMenuSeparator />

        <div className="p-3">
          <DropdownMenuItem className="mx-0 flex h-9 cursor-pointer justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground">
            <Check className="w-4 h-4 mr-2" />
            Done
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
