'use client'

import { useCallback, useMemo, useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createLogger } from '@/lib/logs/console-logger'
import { useNotificationStore } from '@/stores/notifications/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
// NOTE: useSubBlockStore is only used via .getState() in handlers (not as a hook)
// to avoid subscribing this component to every subblock change.
import { BlockState } from '@/stores/workflows/workflow/types'
import { Serializer } from '@/serializer'

const logger = createLogger('ImportExport')
const iconButtonClass =
  'h-8 w-8 min-h-8 min-w-8 rounded-[10px] text-foreground/70 transition-all duration-200 hover:bg-black/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-0 dark:hover:bg-white/[0.06]'
const tooltipClass = 'bg-[#1b1b1b] text-white border-none text-[11px] font-logo'

/**
 * Simple Import/Export buttons for workflow
 * - Export: Downloads workflow as JSON file
 * - Import: Opens file picker to import workflow
 */
export function ImportExportButtons() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addNotification } = useNotificationStore()

  // Store hooks — read workflow data via getState() in handlers instead of subscribing
  // to prevent re-renders on every block position change, edge update, etc.
  const getWorkflowData = () => {
    const s = useWorkflowStore.getState()
    return { blocks: s.blocks, edges: s.edges, loops: s.loops, groups: s.groups }
  }
  const { activeWorkflowId, workflows } = useWorkflowRegistry()
  // NOTE: workflowValues is read via getState() inside handlers to avoid
  // subscribing the entire component to every subblock change.

  // Get current workflow metadata
  const currentWorkflow = activeWorkflowId ? workflows[activeWorkflowId] : null

  // Serializer instance
  const serializer = useMemo(() => new Serializer(), [])

  /**
   * Export workflow and download as JSON file
   */
  const handleExport = useCallback(() => {
    try {
      if (!activeWorkflowId) {
        addNotification('error', 'No active workflow to export', activeWorkflowId)
        return
      }

      // Read workflow data at call time (not via subscription)
      const { blocks, edges, loops, groups } = getWorkflowData()

      // Serialize workflow structure
      const serializedWorkflow = serializer.serializeWorkflow(blocks, edges, loops)

      // Get subblock values for this workflow (read at call time, not via subscription)
      const currentWorkflowValues = useSubBlockStore.getState().workflowValues
      const subblockValues = activeWorkflowId ? currentWorkflowValues[activeWorkflowId] || {} : {}

      // Create complete export data
      const exportData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        metadata: {
          name: currentWorkflow?.name || 'Untitled Workflow',
          description: currentWorkflow?.description || '',
          color: currentWorkflow?.color || '#3B82F6',
        },
        workflow: serializedWorkflow,
        subblockValues,
        groups: groups || {},
      }

      const jsonString = JSON.stringify(exportData, null, 2)

      // Create and download file
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentWorkflow?.name || 'workflow'}-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      addNotification('info', `Workflow exported: ${a.download}`, activeWorkflowId)

      logger.info('Workflow exported', {
        workflowId: activeWorkflowId,
        blocksCount: Object.keys(blocks).length,
        edgesCount: edges.length,
        filename: a.download,
      })
    } catch (err: any) {
      logger.error('Export failed', { error: err })
      addNotification('error', `Export failed: ${err.message}`, activeWorkflowId)
    }
  }, [activeWorkflowId, currentWorkflow, serializer, addNotification])

  /**
   * Import workflow from JSON file
   */
  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const importData = JSON.parse(content)

          // Validate structure
          if (!importData.workflow || !importData.workflow.blocks) {
            addNotification(
              'error',
              'Invalid workflow format: missing workflow.blocks',
              activeWorkflowId
            )
            return
          }

          // Deserialize workflow
          const { blocks: importedBlocks, edges: importedEdges } = serializer.deserializeWorkflow(
            importData.workflow
          )

          // Import to store
          const store = useWorkflowStore.getState()

          // Clear current workflow
          const clearedState = store.clear()
          useWorkflowStore.setState(clearedState)

          // Add imported blocks
          Object.values(importedBlocks).forEach((block: BlockState) => {
            // addBlock signature: (id: string, type: string, name: string, position: Position)
            store.addBlock(block.id, block.type, block.name, block.position)

            // Update additional block properties
            if (block.subBlocks) {
              useWorkflowStore.setState((state) => ({
                blocks: {
                  ...state.blocks,
                  [block.id]: {
                    ...state.blocks[block.id],
                    subBlocks: block.subBlocks,
                    enabled: block.enabled !== undefined ? block.enabled : true,
                    horizontalHandles: block.horizontalHandles || false,
                    isWide: block.isWide || false,
                  },
                },
              }))
            }
          })

          // Add imported edges
          importedEdges.forEach((edge) => {
            store.addEdge(edge)
          })

          // Import groups if available
          if (importData.groups) {
            useWorkflowStore.setState(() => ({
              groups: importData.groups,
            }))
          }

          // Import subblock values if available
          if (importData.subblockValues && activeWorkflowId) {
            const currentWfValues = useSubBlockStore.getState().workflowValues
            useSubBlockStore.setState({
              workflowValues: {
                ...currentWfValues,
                [activeWorkflowId]: importData.subblockValues,
              },
            })
          }

          addNotification(
            'info',
            `Workflow imported: ${Object.keys(importedBlocks).length} blocks, ${importedEdges.length} connections`,
            activeWorkflowId
          )

          logger.info('Workflow imported', {
            blocksCount: Object.keys(importedBlocks).length,
            edgesCount: importedEdges.length,
            filename: file.name,
          })
        } catch (err: any) {
          logger.error('Import failed', { error: err })
          addNotification('error', `Import failed: ${err.message}`, activeWorkflowId)
        }
      }

      reader.onerror = () => {
        addNotification('error', 'Failed to read file', activeWorkflowId)
        logger.error('File read failed')
      }

      reader.readAsText(file)

      // Reset input so same file can be selected again
      event.target.value = ''
    },
    [activeWorkflowId, serializer, addNotification]
  )

  /**
   * Trigger file input click
   */
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Export Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-control-action="export"
            variant="ghost"
            size="icon"
            onClick={handleExport}
            className={iconButtonClass}
            aria-label="Export workflow"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Export Workflow</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={tooltipClass}>
          Export workflow
        </TooltipContent>
      </Tooltip>

      {/* Import Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-control-action="import"
            variant="ghost"
            size="icon"
            onClick={handleImportClick}
            className={iconButtonClass}
            aria-label="Import workflow"
          >
            <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Import Workflow</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={tooltipClass}>
          Import workflow
        </TooltipContent>
      </Tooltip>
    </>
  )
}
