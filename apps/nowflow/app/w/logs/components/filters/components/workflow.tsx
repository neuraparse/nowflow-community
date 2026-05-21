import { useMemo } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFilterStore } from '@/app/w/logs/stores/store'

export default function Workflow() {
  const { logs, workflowIds, toggleWorkflowId, setWorkflowIds } = useFilterStore()

  // Extract unique workflows from logs
  const workflows = useMemo(() => {
    const uniqueWorkflows = new Map()

    logs.forEach((log) => {
      if (log.workflow && !uniqueWorkflows.has(log.workflowId)) {
        uniqueWorkflows.set(log.workflowId, {
          id: log.workflowId,
          name: log.workflow.name,
          color: log.workflow.color,
        })
      }
    })

    return Array.from(uniqueWorkflows.values())
  }, [logs])

  // Get display text for the dropdown button
  const getSelectedWorkflowsText = () => {
    if (workflowIds.length === 0) return 'All workflows'
    if (workflowIds.length === 1) {
      const selected = workflows.find((w) => w.id === workflowIds[0])
      return selected ? selected.name : 'All workflows'
    }
    return `${workflowIds.length} workflows selected`
  }

  // Check if a workflow is selected
  const isWorkflowSelected = (workflowId: string) => {
    return workflowIds.includes(workflowId)
  }

  // Clear all selections
  const clearSelections = () => {
    setWorkflowIds([])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between text-sm font-normal bg-white/80 dark:bg-slate-900/80 border-black/[0.06] dark:border-white/[0.06] hover:bg-zinc-50 dark:hover:bg-white/[0.03] hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 truncate">
            {workflowIds.length === 1 && workflows.length > 0 && (
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: workflows.find((w) => w.id === workflowIds[0])?.color }}
              />
            )}
            <span className="truncate">{getSelectedWorkflowsText()}</span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2 text-zinc-400 dark:text-white/40 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[220px] max-h-[300px] overflow-y-auto bg-transparent border-black/[0.06] dark:border-white/[0.06] shadow-md"
      >
        <DropdownMenuItem
          key="all"
          onSelect={(e) => {
            e.preventDefault()
            clearSelections()
          }}
          className="flex items-center justify-between p-2 cursor-pointer text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.03] focus:bg-zinc-50 dark:focus:bg-white/[0.03] transition-all duration-200"
        >
          <div className="flex items-center">
            <div className="w-5 h-5 flex items-center justify-center mr-2">
              <div className="w-3 h-3 rounded-full bg-zinc-300/40 dark:bg-white/20" />
            </div>
            <span>All workflows</span>
          </div>
          {workflowIds.length === 0 && (
            <div className="bg-zinc-100 dark:bg-white/[0.06] p-1 rounded-full">
              <Check className="h-3 w-3 text-zinc-800 dark:text-white" />
            </div>
          )}
        </DropdownMenuItem>

        {workflows.length > 0 && (
          <DropdownMenuSeparator className="bg-black/[0.06] dark:bg-white/[0.06]" />
        )}

        {workflows.map((workflow) => (
          <DropdownMenuItem
            key={workflow.id}
            onSelect={(e) => {
              e.preventDefault()
              toggleWorkflowId(workflow.id)
            }}
            className="flex items-center justify-between p-2 cursor-pointer text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.03] focus:bg-zinc-50 dark:focus:bg-white/[0.03] transition-all duration-200"
          >
            <div className="flex items-center max-w-[160px]">
              <div
                className="flex items-center justify-center w-5 h-5 rounded-full mr-2"
                style={{ backgroundColor: `${workflow.color}20` }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: workflow.color }} />
              </div>
              <span className="truncate" title={workflow.name}>
                {workflow.name}
              </span>
            </div>
            {isWorkflowSelected(workflow.id) && (
              <div className="bg-zinc-100 dark:bg-white/[0.06] p-1 rounded-full flex-shrink-0">
                <Check className="h-3 w-3 text-zinc-800 dark:text-white" />
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
