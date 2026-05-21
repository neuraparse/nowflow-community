'use client'

import { WorkspaceLoading } from '@/components/ui/workspace-loading'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import Providers from './components/providers/providers'
import { Sidebar } from './components/sidebar/sidebar'

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <WorkspaceLayoutContent>{children}</WorkspaceLayoutContent>
    </Providers>
  )
}

function WorkspaceLayoutContent({ children }: { children: React.ReactNode }) {
  const { isLoading, workflows } = useWorkflowRegistry()

  // Only show workspace loading overlay if we're switching workspaces (not initial load)
  // Initial load is handled by workflow.tsx
  const isWorkspaceSwitching = isLoading && Object.keys(workflows).length === 0

  return (
    <div className={`${workflowEditorTheme.root} flex min-h-screen w-full`}>
      <div className="z-50">
        <Sidebar />
      </div>
      <div className="workspace-stage workflow-editor-stage flex-1 flex flex-col relative">
        {/* Workspace switching loading - keeps sidebar visible */}
        {isWorkspaceSwitching && (
          <WorkspaceLoading
            message="Switching workspace..."
            submessage="Loading workflows for the new workspace"
          />
        )}
        {children}
      </div>
    </div>
  )
}
