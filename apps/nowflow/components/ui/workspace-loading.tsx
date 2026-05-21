'use client'

import { LoadingAgent } from './loading-agent'

export interface WorkspaceLoadingProps {
  /**
   * Loading message to display
   * @default 'Loading...'
   */
  message?: string
  /**
   * Optional submessage for additional context
   */
  submessage?: string
}

/**
 * A loading overlay that covers only the workspace/canvas area
 * Keeps sidebar visible during loading
 */
export function WorkspaceLoading({ message = 'Loading...', submessage }: WorkspaceLoadingProps) {
  return (
    <div className="workflow-editor-loading-overlay absolute inset-0 z-40 flex items-center justify-center bg-background/90">
      <div className="flex flex-col items-center gap-4">
        <LoadingAgent size="lg" />
        <div className="flex flex-col items-center gap-1">
          <p className="workflow-editor-loading-title text-sm font-medium text-foreground">
            {message}
          </p>
          {submessage && (
            <p className="workflow-editor-loading-subtitle text-xs text-muted-foreground">
              {submessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
