'use client'

import { formatDistanceToNow } from 'date-fns'
import { ModernWorkflowIcon } from '@/components/modern-control-bar-icons'

interface WorkspaceWorkflowInfoProps {
  workspaceName: string
  workflowName: string
  mounted: boolean
  lastSaved: number | undefined
}

export function WorkspaceWorkflowInfo({
  workspaceName,
  workflowName,
  mounted,
  lastSaved,
}: WorkspaceWorkflowInfoProps) {
  const displayWorkspaceName = workspaceName || 'Unknown Workspace'
  const displayWorkflowName = workflowName || 'Untitled Workflow'
  const savedLabel = mounted
    ? lastSaved
      ? formatDistanceToNow(lastSaved, { addSuffix: true })
      : 'just now'
    : ''

  return (
    <div
      className="workflow-editor-top-identity-content relative z-50 flex min-w-0 items-center bg-transparent"
      aria-label={`${displayWorkspaceName} workspace, ${displayWorkflowName} workflow`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="workflow-editor-top-identity-icon silver-glass-pane flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#4A7A68] dark:text-[#b9d4c7]">
          <ModernWorkflowIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="workflow-editor-top-identity-copy flex min-w-0 flex-col">
          <div
            className="workflow-editor-top-identity-title flex min-w-0 items-center text-[12px] font-logo font-medium text-black/85 dark:text-white/90"
            title={`${displayWorkspaceName} / ${displayWorkflowName}`}
          >
            <span className="max-w-[11rem] truncate text-black/45 dark:text-white/45">
              {displayWorkspaceName}
            </span>
            <span className="mx-1 shrink-0 text-black/25 dark:text-white/25">/</span>
            <span className="min-w-0 truncate">{displayWorkflowName}</span>
          </div>
          <div className="workflow-editor-top-identity-meta flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[10.5px] font-logo text-black/50 dark:text-white/55">
            <div className="flex min-w-0 items-center gap-1.5 text-black/48 dark:text-white/46">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80"></div>
              <span className="truncate font-medium">Saved {savedLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
