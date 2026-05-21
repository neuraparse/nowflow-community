'use client'

import { LoadingAgent } from './loading-agent'

export interface FullScreenLoadingProps {
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

export function FullScreenLoading({ message = 'Loading...', submessage }: FullScreenLoadingProps) {
  return (
    <div className="workflow-editor-loading-overlay fixed inset-0 z-50 flex items-center justify-center bg-background/95">
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
