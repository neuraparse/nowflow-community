'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Edit3, Eye, Search, X } from 'lucide-react'
import { LoadingAgent } from '@/components/ui/loading-agent'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowIconPicker } from '@/components/workflow-icon-picker'
import { getWorkflowIconById, suggestWorkflowIcon } from '@/components/workflow-icons'
import { useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { WorkflowMetadata } from '@/stores/workflows/registry/types'

const logger = createLogger('workflow-list')

interface WorkflowItemProps {
  workflow: WorkflowMetadata
  active: boolean
  isMarketplace?: boolean
  isCollapsed?: boolean
  isLoading?: boolean
}

function WorkflowItem({
  workflow,
  active,
  isMarketplace,
  isCollapsed,
  isLoading,
}: WorkflowItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(workflow.name)
  const { updateWorkflow } = useWorkflowRegistry()

  const workflowIcon = workflow.icon
    ? getWorkflowIconById(workflow.icon)
    : suggestWorkflowIcon(workflow.name)

  const handleNameEdit = async () => {
    if (editedName.trim() && editedName !== workflow.name) {
      try {
        await updateWorkflow(workflow.id, { name: editedName.trim() })
      } catch (error) {
        logger.error('[WORKFLOW-LIST] Failed to update name:', error)
        setEditedName(workflow.name)
      }
    }
    setIsEditing(false)
  }

  const handleIconChange = async (iconId: string) => {
    try {
      await updateWorkflow(workflow.id, { icon: iconId })
    } catch (error: any) {
      logger.error('[WORKFLOW-LIST] Failed to update icon:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameEdit()
    } else if (e.key === 'Escape') {
      setEditedName(workflow.name)
      setIsEditing(false)
    }
  }

  return (
    <div
      className={`workflow-sidebar-workflow-row group relative flex items-center rounded-[4px] transition-all duration-200 ${
        isCollapsed ? 'justify-center w-full' : ''
      } ${isLoading ? 'opacity-60 pointer-events-none' : ''} ${isCollapsed ? 'my-0.5' : 'my-1'}`}
    >
      <Link
        href={`/w/${workflow.id}`}
        className={`workflow-sidebar-workflow-item relative flex items-center overflow-hidden rounded-[4px] border text-[12px] font-logo font-medium transition-all duration-200 ${
          active
            ? 'is-active border-white/[0.08] bg-white/[0.05] text-black/95 dark:text-white shadow-none'
            : 'border-transparent bg-transparent text-black/62 shadow-none hover:border-white/[0.05] hover:bg-black/[0.035] hover:text-black/88 dark:text-white/70 dark:hover:bg-white/[0.04] dark:hover:text-white/94'
        } ${isCollapsed ? 'justify-center w-8 h-8 mx-auto p-0' : 'px-2 py-1.5 flex-1 min-w-0'}`}
      >
        {active && !isCollapsed && (
          <span className="absolute inset-y-1.5 left-0 w-px bg-[linear-gradient(180deg,rgba(239,122,90,0.9)_0%,rgba(168,85,247,0.92)_55%,rgba(6,182,212,0.9)_100%)]" />
        )}
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center relative">
                {isLoading && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <LoadingAgent size="sm" />
                  </div>
                )}
                <WorkflowIconPicker
                  selectedIconId={workflow.icon}
                  onIconSelect={handleIconChange}
                  trigger={
                    <div
                      className="workflow-sidebar-workflow-icon h-5 w-5 rounded-[4px] flex items-center justify-center overflow-hidden cursor-pointer transition-all duration-200"
                      style={{
                        background: `linear-gradient(135deg, ${workflowIcon.color}E0, ${workflowIcon.color}B0)`,
                        boxShadow: active
                          ? `0 0 0 1px ${workflowIcon.color}55, 0 6px 14px ${workflowIcon.color}26`
                          : `0 1px 3px ${workflowIcon.color}18`,
                      }}
                    >
                      <workflowIcon.icon className="h-3 w-3 text-white" />
                    </div>
                  }
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs bg-[#1b1b1b] text-white border-none">
              <div className="space-y-0.5">
                <p className="font-semibold text-[12px] font-logo">{workflow.name}</p>
                {workflow.description && (
                  <p className="text-[11px] text-white/60">{workflow.description}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <WorkflowIconPicker
              selectedIconId={workflow.icon}
              onIconSelect={handleIconChange}
              trigger={
                <div
                  className="workflow-sidebar-workflow-icon h-5 w-5 rounded flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, ${workflowIcon.color}E0, ${workflowIcon.color}B0)`,
                    boxShadow: active
                      ? `0 0 0 1px ${workflowIcon.color}55, 0 6px 14px ${workflowIcon.color}26`
                      : `0 1px 3px ${workflowIcon.color}18`,
                  }}
                >
                  <workflowIcon.icon className="h-3 w-3 text-white" />
                </div>
              }
            />
            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
              {isEditing ? (
                <input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleNameEdit}
                  onKeyDown={handleKeyDown}
                  className="silver-glass-pane smoky-glass-pane glass-field h-6 rounded-[4px] border-0 px-1.5 text-[12px] font-logo font-medium text-zinc-800 focus:outline-none dark:text-white"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-0.5 min-w-0">
                  {isLoading && (
                    <div className="flex-shrink-0 mr-0.5">
                      <LoadingAgent size="sm" />
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`truncate font-medium text-[12px] font-logo leading-4 cursor-default transition-colors duration-200 ${active ? 'text-black dark:text-white' : ''}`}
                      >
                        {workflow.name}
                        {isMarketplace && ' (Preview)'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="max-w-xs bg-[#1b1b1b] text-white border-none"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[12px] font-logo">{workflow.name}</p>
                        {workflow.description && (
                          <p className="text-[11px] text-white/60">{workflow.description}</p>
                        )}
                        {isMarketplace && (
                          <p className="text-[11px] font-medium text-white/70">Preview Mode</p>
                        )}
                        {workflow.isShared && (
                          <p className="text-[11px] font-medium text-white/70">
                            Shared · {workflow.role === 'editor' ? 'Can Edit' : 'View Only'}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  {workflow.isShared && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-shrink-0">
                          {workflow.role === 'editor' ? (
                            <Edit3 className="h-2.5 w-2.5 text-[#4A7A68] dark:text-[#94B8A6]" />
                          ) : (
                            <Eye className="h-2.5 w-2.5 text-[#4A7A68] dark:text-[#94B8A6]" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="bg-[#1b1b1b] text-white border-none text-[11px] font-logo"
                      >
                        {workflow.role === 'editor' ? 'Can Edit' : 'View Only'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {!isMarketplace && !workflow.isShared && (
                    <button
                      aria-label={`Rename ${workflow.name}`}
                      className="h-3.5 w-3.5 rounded-[3px] p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-black/35 dark:text-white/40 hover:text-black/65 dark:hover:text-white/70"
                      onClick={(e) => {
                        e.preventDefault()
                        setIsEditing(true)
                      }}
                    >
                      <Edit3 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Link>
    </div>
  )
}

interface WorkflowListProps {
  regularWorkflows: WorkflowMetadata[]
  isCollapsed?: boolean
  isLoading?: boolean
  isCreating?: boolean
}

export function WorkflowList({
  regularWorkflows,
  isCollapsed = false,
  isLoading = false,
  isCreating = false,
}: WorkflowListProps) {
  const { activeWorkflowId, isLoadingWorkflow } = useWorkflowRegistry()
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllWorkflows, setShowAllWorkflows] = useState(false)

  const initialWorkflowCount = 4

  const filteredRegularWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return regularWorkflows
    return regularWorkflows.filter(
      (workflow) =>
        workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (workflow.description &&
          workflow.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [regularWorkflows, searchQuery])

  const shouldShowMoreButton =
    !isCollapsed && !searchQuery && filteredRegularWorkflows.length > initialWorkflowCount

  const displayedRegularWorkflows =
    showAllWorkflows || searchQuery
      ? filteredRegularWorkflows
      : filteredRegularWorkflows.slice(0, initialWorkflowCount)

  const showEmptyState =
    !isLoading && !isCreating && session?.user && !searchQuery && regularWorkflows.length === 0

  const handleClearSearch = () => {
    setSearchQuery('')
  }

  return (
    <div className="space-y-1.5">
      {/* Search input */}
      {!isCollapsed && regularWorkflows.length > 0 && (
        <div className="workflow-sidebar-search relative mb-2">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/35 dark:text-white/45"
              strokeWidth={1.5}
            />
            <input
              aria-label="Search workflows"
              placeholder="Search workflows"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
              className="workflow-sidebar-search-input silver-glass-pane smoky-glass-pane glass-field h-8 w-full rounded-[4px] border-0 pl-8 pr-8 text-[12px] font-logo text-black/80 transition-all duration-200 placeholder:text-black/35 focus:outline-none dark:text-white/85 dark:placeholder:text-white/45 disabled:opacity-50"
            />
            {searchQuery && (
              <button
                aria-label="Clear workflow search"
                disabled={isLoading}
                className="silver-glass-chip absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[4px] text-black/35 transition-all duration-200 hover:text-black/60 dark:text-white/45 dark:hover:text-white/70"
                onClick={handleClearSearch}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={isLoading ? 'opacity-60 pointer-events-none' : ''}>
        {isLoading && (
          <div
            className={`flex items-center rounded-md px-2.5 py-1.5 text-[12px] font-logo text-black/50 dark:text-white/65 ${isCollapsed ? 'justify-center w-full' : ''}`}
          >
            <div className={`flex items-center gap-1.5 ${isCollapsed ? 'justify-center' : ''}`}>
              <LoadingAgent size="sm" />
              {!isCollapsed && <span>Loading workflows...</span>}
            </div>
          </div>
        )}
        {!isLoading && (
          <>
            {isCreating && (
              <div
                className={`flex items-center rounded-md px-2.5 py-1.5 text-[12px] font-logo text-black/50 dark:text-white/65 ${isCollapsed ? 'justify-center w-full' : ''}`}
              >
                <div className={`flex items-center gap-1.5 ${isCollapsed ? 'justify-center' : ''}`}>
                  <LoadingAgent size="sm" />
                  {!isCollapsed && <span>Creating workflow...</span>}
                </div>
              </div>
            )}

            {displayedRegularWorkflows.map((workflow) => (
              <WorkflowItem
                key={workflow.id}
                workflow={workflow}
                active={activeWorkflowId === workflow.id}
                isCollapsed={isCollapsed}
                isLoading={isLoadingWorkflow && activeWorkflowId === workflow.id}
              />
            ))}

            {shouldShowMoreButton && (
              <button
                className="silver-glass-chip mt-1 flex h-7 w-full items-center justify-center gap-0.5 rounded-[4px] border border-white/[0.05] text-[11px] font-logo text-black/40 transition-all duration-200 hover:text-black/65 dark:text-white/50 dark:hover:text-white/75"
                onClick={() => setShowAllWorkflows(!showAllWorkflows)}
              >
                {showAllWorkflows ? (
                  <>
                    <ChevronUp className="h-2.5 w-2.5" />
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-2.5 w-2.5" />
                    <span>Show {filteredRegularWorkflows.length - initialWorkflowCount} More</span>
                  </>
                )}
              </button>
            )}

            {showEmptyState && !isCollapsed && (
              <div className="silver-glass-pane mx-0.5 mt-1.5 rounded-[6px] border border-black/[0.04] px-2.5 py-2 text-[12px] font-logo text-black/40 dark:border-white/[0.08] dark:text-white/50">
                <p className="font-medium text-black/70 dark:text-white/80 mb-0.5">
                  No workflows found
                </p>
                <p className="text-[11px] text-black/45 dark:text-white/55">
                  Create a new workflow to get started.
                </p>
              </div>
            )}

            {!isCollapsed && searchQuery && filteredRegularWorkflows.length === 0 && (
              <div className="silver-glass-pane mx-0.5 mt-1.5 rounded-[6px] border border-black/[0.04] px-2.5 py-2 text-[12px] font-logo text-black/40 dark:border-white/[0.08] dark:text-white/50">
                <p className="font-medium text-black/60 dark:text-white/70">
                  No matching workflows
                </p>
                <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/55">
                  Try a different search term
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
