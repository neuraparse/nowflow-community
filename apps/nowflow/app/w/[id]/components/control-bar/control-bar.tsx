'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Users } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ModernChatIcon } from '@/components/modern-panel-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/lib/auth-client'
import { openEnterpriseUrl } from '@/lib/community/enterprise'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useNotificationStore } from '@/stores/notifications/store'
import { useGeneralStore } from '@/stores/settings/general/store'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { useUserNotifications } from '@/hooks/use-user-notifications'
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts'
import { useWorkflowExecution } from '../../hooks/use-workflow-execution'
import { SubscriptionInfoBadge } from '../subscription-info-badge'
import { ChatModal } from './components/chat-modal/chat-modal'
import { CollaborationPresence } from './components/collaboration-presence'
import { CollaboratorsModal } from './components/collaborators-modal/collaborators-modal'
import { DebugModeToggle } from './components/debug-mode-toggle'
import { DeleteButton } from './components/delete-button'
import { DuplicateButton } from './components/duplicate-button'
import { ImportExportButtons } from './components/import-export-buttons'
import { NotificationsDropdown } from './components/notifications-dropdown'
import { RunButtonSection } from './components/run-button-section'
import { WorkspaceWorkflowInfo } from './components/workspace-workflow-info'
import { useInboxToasts } from './hooks/use-inbox-toasts'
import { useMultipleRuns } from './hooks/use-multiple-runs'
import { useUsageCheck } from './hooks/use-usage-check'
import { useWorkspaceInfo } from './hooks/use-workspace-info'
import { TIME_UPDATE_INTERVAL } from './types'
import { openSubscriptionSettings } from './utils'

/**
 * Control bar for managing workflows - handles editing, deletion,
 * history, notifications and execution.
 */
export function ControlBar() {
  const router = useRouter()
  const { data: session } = useSession()

  // Store hooks
  const { notifications, removeNotification, addNotification } = useNotificationStore()
  const { lastSaved } = useWorkflowStore(useShallow((s) => ({ lastSaved: s.lastSaved })))
  const { workflows, activeWorkflowId, removeWorkflow, duplicateWorkflow, activeWorkspaceId } =
    useWorkflowRegistry()
  const { isExecuting, handleRunWorkflow } = useWorkflowExecution()
  const { mode, isExpanded } = useSidebarStore()
  const isCollapsed = mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  // Debug mode state
  const { isDebugModeEnabled, toggleDebugMode } = useGeneralStore()
  const { isDebugging, pendingBlocks, handleStepDebug, handleCancelDebug, handleResumeDebug } =
    useWorkflowExecution()

  // Local state
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const [, forceUpdate] = useState({})

  // UI state
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isChatModalOpen, setIsChatModalOpen] = useState(false)

  // Extracted hooks
  const workspaceName = useWorkspaceInfo(activeWorkspaceId)

  const {
    notifications: inboxNotifications,
    unreadCount: inboxUnreadCount,
    isLoading: inboxLoading,
    error: inboxError,
    isRealtimeConnected: inboxRealtimeConnected,
    markRead: markInboxRead,
    markAllRead: markAllInboxRead,
  } = useUserNotifications({ enabled: Boolean(session?.user?.id) })

  useInboxToasts(session?.user?.id, inboxLoading, inboxNotifications, setNotificationsOpen)

  const { usageExceeded, setUsageExceeded, usageData, setUsageData, checkUserUsage } =
    useUsageCheck(session?.user?.id)

  const {
    runCount,
    setRunCount,
    completedRuns,
    isMultiRunning,
    showRunProgress,
    isCancelling,
    handleMultipleRuns,
    handleCancelMultiRun,
  } = useMultipleRuns({
    activeWorkflowId,
    isExecuting,
    handleRunWorkflow,
    usageExceeded,
    setUsageExceeded,
    setUsageData,
    checkUserUsage,
    userId: session?.user?.id,
    openSubscriptionSettings,
  })

  useEffect(() => {
    if (!session?.user?.id || completedRuns === 0) return

    checkUserUsage(session.user.id, true).then((usage) => {
      if (usage) {
        setUsageExceeded(usage.isExceeded)
        setUsageData(usage)
      }
    })
  }, [checkUserUsage, completedRuns, session?.user?.id, setUsageData, setUsageExceeded])

  // Update the time display every minute
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), TIME_UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Register keyboard shortcut for running workflow
  const handleRunAction = useCallback(() => {
    if (isExecuting || isMultiRunning || isCancelling) return
    if (isDebugModeEnabled) {
      handleRunWorkflow()
      return
    }
    handleMultipleRuns()
  }, [
    handleRunWorkflow,
    handleMultipleRuns,
    isCancelling,
    isDebugModeEnabled,
    isExecuting,
    isMultiRunning,
  ])

  const handleEnterpriseRequest = useCallback(() => {
    openEnterpriseUrl()
  }, [])

  const isShortcutDisabled =
    isExecuting || isMultiRunning || isCancelling || isChatModalOpen || notificationsOpen

  useKeyboardShortcuts(handleRunAction, isShortcutDisabled)

  useEffect(() => {
    const handleRunRequest = () => handleRunAction()
    window.addEventListener('workflow-run-request', handleRunRequest as EventListener)
    return () =>
      window.removeEventListener('workflow-run-request', handleRunRequest as EventListener)
  }, [handleRunAction])

  /**
   * Workflow deletion handler
   */
  const handleDeleteWorkflow = () => {
    if (!activeWorkflowId) return

    const remainingIds = Object.keys(workflows).filter((id) => id !== activeWorkflowId)

    if (remainingIds.length > 0) {
      router.push(`/w/${remainingIds[0]}`)
    } else {
      router.push('/')
    }

    removeWorkflow(activeWorkflowId)
  }

  /**
   * Handle duplicating the current workflow
   */
  const handleDuplicateWorkflow = async () => {
    if (!activeWorkflowId) return

    try {
      const newWorkflowId = await duplicateWorkflow(activeWorkflowId)

      if (newWorkflowId) {
        router.push(`/w/${newWorkflowId}`)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to duplicate workflow. Please try again.'

      addNotification('error', errorMessage, activeWorkflowId, {
        isPersistent: true,
      })
    }
  }

  // Filter notifications for current workflow
  const currentWorkflowNotifications = activeWorkflowId
    ? notifications.filter((n) => n.workflowId === activeWorkflowId)
    : []

  const currentWorkflow = activeWorkflowId ? workflows[activeWorkflowId] : null

  const islandClass = cn(
    'workflow-editor-island workflow-editor-top-action-group workflow-editor-action-cluster flex h-9 shrink-0 items-center gap-1 rounded-[6px] px-1.5 py-1 transition-all duration-200'
  )

  const dividerClass = cn(
    'workflow-editor-divider mx-0.5 h-4 w-px shrink-0',
    workflowEditorTheme.divider
  )
  return (
    <header
      className={cn(
        'workflow-editor-toolbar fixed top-0 right-0 z-30 flex h-16 items-start justify-center px-3 py-2 pointer-events-none transition-all duration-500',
        isCollapsed ? 'left-14' : 'left-60'
      )}
      aria-label="Workflow control bar"
    >
      <nav className="flex w-fit max-w-full min-w-0 justify-center" aria-label="Workflow controls">
        <div
          className="workflow-editor-top-strip pointer-events-auto flex h-12 w-fit max-w-full min-w-0 items-center gap-1.5 overflow-hidden px-2 sm:gap-2"
          role="toolbar"
          aria-label="Workflow editing and execution controls"
        >
          {/* Left Section - Workspace/Workflow Info */}
          <div
            className={cn(
              'workflow-editor-info workflow-editor-top-identity workflow-editor-shell silver-glass-panel flex h-9 w-[clamp(18rem,28vw,32rem)] min-w-0 items-center gap-2 overflow-hidden rounded-[6px] px-2.5 py-1.5 transition-all duration-200'
            )}
            role="group"
            aria-label="Current workflow"
          >
            <WorkspaceWorkflowInfo
              workspaceName={workspaceName}
              workflowName={currentWorkflow?.name || ''}
              mounted={mounted}
              lastSaved={lastSaved}
            />
          </div>

          {/* Right Section - Action Rails */}
          <div
            className="workflow-editor-top-actions flex min-w-0 shrink items-center justify-start gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Workflow action groups"
          >
            {/* Subscription Info Badge */}
            <SubscriptionInfoBadge />

            {/* Primary Actions Island */}
            <div className={islandClass} role="group" aria-label="Run controls">
              <RunButtonSection
                isDebugModeEnabled={isDebugModeEnabled}
                isExecuting={isExecuting}
                isMultiRunning={isMultiRunning}
                isCancelling={isCancelling}
                isDebugging={isDebugging}
                runCount={runCount}
                usageExceeded={usageExceeded}
                usageData={usageData}
                showRunProgress={showRunProgress}
                completedRuns={completedRuns}
                pendingBlocks={pendingBlocks}
                onRun={handleRunAction}
                onSetRunCount={setRunCount}
                onOpenSubscriptionSettings={openSubscriptionSettings}
                onCancelMultiRun={handleCancelMultiRun}
                onStepDebug={handleStepDebug}
                onResumeDebug={handleResumeDebug}
                onCancelDebug={handleCancelDebug}
              />
              <div className={dividerClass} aria-hidden="true" />
              <DebugModeToggle
                isDebugModeEnabled={isDebugModeEnabled}
                isExecuting={isExecuting}
                isMultiRunning={isMultiRunning}
                toggleDebugMode={toggleDebugMode}
              />
            </div>

            {/* Deployment Island */}
            <div className={islandClass} role="group" aria-label="Enterprise deployment">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-control-action="enterprise-deployment"
                    variant="ghost"
                    onClick={handleEnterpriseRequest}
                    className={cn(
                      workflowEditorTheme.iconButton,
                      'silver-glass-chip h-7 shrink-0 gap-1.5 rounded-[4px] px-2 text-[11px] font-logo transition-all duration-200'
                    )}
                    aria-label="Request Enterprise deployment"
                  >
                    <Lock className="h-3 w-3" strokeWidth={1.5} />
                    <span className="hidden whitespace-nowrap lg:inline">Enterprise</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-[#1b1b1b] text-white border-none text-[11px] font-logo"
                >
                  Hosted deploy, marketplace publishing, and custom domains are Enterprise.
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Communication Island */}
            <div className={islandClass} role="group" aria-label="Communication tools">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-control-action="chat"
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsChatModalOpen(true)}
                    className={cn(
                      workflowEditorTheme.iconButton,
                      'silver-glass-chip h-7 w-7 shrink-0 transition-all duration-200'
                    )}
                    aria-label="Open chat"
                  >
                    <ModernChatIcon className="h-3 w-3" />
                    <span className="sr-only">Open Chat</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-[#1b1b1b] text-white border-none text-[11px] font-logo"
                >
                  Open Chat
                </TooltipContent>
              </Tooltip>

              <div className={dividerClass} aria-hidden="true" />

              {/* Import/Export Buttons */}
              <ImportExportButtons />

              <div className={dividerClass} aria-hidden="true" />

              {/* Collaboration Presence */}
              {activeWorkflowId && <CollaborationPresence workflowId={activeWorkflowId} />}

              {/* Collaborators */}
              <Tooltip>
                <CollaboratorsModal
                  workflowId={activeWorkflowId || ''}
                  trigger={
                    <TooltipTrigger asChild>
                      <Button
                        data-control-action="collaborators"
                        variant="ghost"
                        size="icon"
                        className="silver-glass-chip h-7 w-7 shrink-0 rounded-[4px] transition-all duration-200"
                        aria-label="Manage collaborators"
                      >
                        <Users className="h-3 w-3" strokeWidth={1.5} />
                        <span className="sr-only">Collaborators</span>
                      </Button>
                    </TooltipTrigger>
                  }
                />
                <TooltipContent
                  side="bottom"
                  className="bg-[#1b1b1b] text-white border-none text-[11px] font-logo"
                >
                  Collaborators
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Management Island */}
            <div className={islandClass} role="group" aria-label="Notifications and management">
              <NotificationsDropdown
                notificationsOpen={notificationsOpen}
                setNotificationsOpen={setNotificationsOpen}
                currentWorkflowNotifications={currentWorkflowNotifications}
                removeNotification={removeNotification}
                inboxNotifications={inboxNotifications}
                inboxUnreadCount={inboxUnreadCount}
                inboxRealtimeConnected={inboxRealtimeConnected}
                inboxLoading={inboxLoading}
                inboxError={inboxError}
                markInboxRead={markInboxRead}
                markAllInboxRead={markAllInboxRead}
                isLoggedIn={Boolean(session?.user?.id)}
              />
              <div className={dividerClass} aria-hidden="true" />
              <DuplicateButton onDuplicate={handleDuplicateWorkflow} />
              <div className={dividerClass} aria-hidden="true" />
              <DeleteButton
                disabled={Object.keys(workflows).length <= 1}
                onDelete={handleDeleteWorkflow}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Modals */}
      <ChatModal open={isChatModalOpen} onOpenChange={setIsChatModalOpen} />
    </header>
  )
}
