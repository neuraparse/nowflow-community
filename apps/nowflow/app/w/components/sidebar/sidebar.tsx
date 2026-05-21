'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  ChevronDown,
  Database,
  FolderOpen,
  FormInput,
  GitBranch,
  Layers,
  Lock,
  Map,
  Plus,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import { AgentIcon } from '@/components/icons'
import {
  ModernHelpIcon,
  ModernSettingsIcon,
  ModernWorkflowIcon,
} from '@/components/modern-sidebar-icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LoadingAgent } from '@/components/ui/loading-agent'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/lib/auth-client'
import { openEnterpriseUrl } from '@/lib/community/enterprise'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { STORAGE_KEYS } from '@/stores/constants'
import { useNotificationStore } from '@/stores/notifications/store'
import { ResourceGroup, useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { WorkflowMetadata } from '@/stores/workflows/registry/types'
import { clearUserData, reinitializeAfterLogin } from '@/stores'
import { useRegistryLoading } from '../../hooks/use-registry-loading'
import { HelpModal } from './components/help-modal/help-modal'
import { NavSection } from './components/nav-section/nav-section'
import { SettingsModal } from './components/settings-modal/settings-modal'
import { SidebarControl } from './components/sidebar-control/sidebar-control'
import { WorkflowList } from './components/workflow-list/workflow-list'
import { WorkspaceHeader } from './components/workspace-header/workspace-header'

const logger = createLogger('sidebar')
const USER_STORAGE_KEY = 'app-user-id'
const RESOURCE_GROUP_TRANSITION_MS = 180

function SidebarShell({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <aside
      role="navigation"
      aria-label="Workspace sidebar"
      className={`workflow-editor-sidebar fixed inset-y-0 left-0 flex flex-col transition-all duration-200 ease-out sm:flex z-50 bg-transparent ${isCollapsed ? 'w-14' : 'w-60'}`}
    >
      {/* Header Card Skeleton */}
      <div className={isCollapsed ? 'p-1.5' : 'px-2.5 pt-2.5 pb-1'}>
        <div
          className={`workflow-editor-card silver-glass-panel rounded-[6px] ${isCollapsed ? 'p-1.5' : 'p-2'}`}
        >
          {isCollapsed ? (
            <div className="flex items-center justify-center">
              <div
                className={cn(
                  workflowEditorTheme.surface,
                  'silver-glass-pane flex h-8 w-8 items-center justify-center'
                )}
              >
                <AgentIcon className={cn('h-5 w-5', workflowEditorTheme.muted)} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  workflowEditorTheme.surface,
                  'silver-glass-pane flex h-8 w-8 flex-shrink-0 items-center justify-center'
                )}
              >
                <AgentIcon className={cn('h-5 w-5', workflowEditorTheme.muted)} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span
                  className={cn(
                    'text-[11px] font-logo font-semibold tracking-[0.1em] uppercase',
                    workflowEditorTheme.soft
                  )}
                >
                  Workspace
                </span>
                <span
                  className={cn(
                    'truncate text-[13px] font-logo font-medium',
                    workflowEditorTheme.muted
                  )}
                >
                  Loading...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content skeleton cards */}
      <div className={`flex-1 overflow-hidden flex flex-col ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <div className="mt-2 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`silver-glass-panel rounded-[6px] animate-pulse ${isCollapsed ? 'h-10 p-1.5' : 'h-12 p-2.5'}`}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

export function Sidebar() {
  useRegistryLoading()

  const [isMounted, setIsMounted] = useState(false)
  const [isSidebarReady, setIsSidebarReady] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(
    () => useSidebarStore.persist?.hasHydrated?.() ?? true
  )
  const [limitExceededDialog, setLimitExceededDialog] = useState(false)
  const [limitMessage, setLimitMessage] = useState('')
  const [limitDetails, setLimitDetails] = useState<{ currentCount: number; limit: number } | null>(
    null
  )
  const {
    workflows,
    activeWorkflowId,
    activeWorkspaceId,
    createWorkflow,
    creatingWorkflowIds,
    isLoading: workflowsLoading,
  } = useWorkflowRegistry()
  const { data: session, isPending: sessionLoading } = useSession()
  const { addNotification } = useNotificationStore()
  const userResetInProgress = useRef(false)
  const sessionUserId = session?.user?.id

  const isLoading = workflowsLoading
  const isActionDisabled = workflowsLoading || sessionLoading
  const isCreatingWorkflow = Object.keys(creatingWorkflowIds).length > 0

  // Clear stale local data when switching accounts
  useEffect(() => {
    if (sessionLoading || !sessionUserId || userResetInProgress.current) {
      return
    }

    const storedUserId = localStorage.getItem(USER_STORAGE_KEY)
    const hasWorkflowCache = Boolean(
      localStorage.getItem(STORAGE_KEYS.REGISTRY) ||
      localStorage.getItem('last-active-workflow-id') ||
      localStorage.getItem('active-workspace-id')
    )

    const shouldReset =
      (storedUserId && storedUserId !== sessionUserId) || (!storedUserId && hasWorkflowCache)

    if (!shouldReset) {
      if (!storedUserId) {
        localStorage.setItem(USER_STORAGE_KEY, sessionUserId)
      }
      return
    }

    userResetInProgress.current = true
    logger.warn('User change detected, clearing local data', {
      storedUserId: storedUserId || 'none',
      userId: sessionUserId,
    })
    ;(async () => {
      await clearUserData()
      localStorage.setItem(USER_STORAGE_KEY, sessionUserId)
      await reinitializeAfterLogin()
    })()
      .catch((error) => {
        logger.error('Failed to reset local data after login:', { error })
        localStorage.setItem(USER_STORAGE_KEY, sessionUserId)
      })
      .finally(() => {
        userResetInProgress.current = false
      })
  }, [sessionLoading, sessionUserId])

  useEffect(() => {
    setIsMounted(true)

    const persist = useSidebarStore.persist
    if (!persist?.onFinishHydration) {
      setHasHydrated(true)
      return
    }

    if (persist.hasHydrated?.()) {
      setHasHydrated(true)
      return
    }

    const unsubscribe = persist.onFinishHydration(() => {
      setHasHydrated(true)
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    if (isSidebarReady || !isMounted || !hasHydrated) {
      return
    }
    setIsSidebarReady(true)
  }, [isMounted, hasHydrated, isSidebarReady])

  const router = useRouter()
  const handleEnterpriseRequest = () => openEnterpriseUrl()
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const {
    mode,
    isExpanded,
    setWorkspaceDropdownOpen,
    setAnyModalOpen,
    forceExpanded,
    toggleExpanded,
    resourceGroups,
    setOpenResourceGroup,
  } = useSidebarStore()

  useEffect(() => {
    if (activeWorkspaceId) {
      // Force re-render when workspace changes
    }
  }, [activeWorkspaceId])

  useEffect(() => {
    setAnyModalOpen(showSettings || showHelp)
  }, [showSettings, showHelp, setAnyModalOpen])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable
      const key = typeof e.key === 'string' ? e.key.toLowerCase() : ''
      if ((e.metaKey || e.ctrlKey) && key === 'b' && !isTyping) {
        e.preventDefault()
        toggleExpanded()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleExpanded])

  const regularWorkflows = useMemo(() => {
    const regular: WorkflowMetadata[] = []

    if (!isLoading) {
      Object.values(workflows).forEach((workflow) => {
        if (
          (workflow.workspaceId === activeWorkspaceId ||
            !workflow.workspaceId ||
            workflow.isShared) &&
          workflow.marketplaceData?.status !== 'temp'
        ) {
          regular.push(workflow)
        }
      })

      regular.sort((a, b) => {
        const dateA =
          a.lastModified instanceof Date
            ? a.lastModified.getTime()
            : new Date(a.lastModified).getTime()
        const dateB =
          b.lastModified instanceof Date
            ? b.lastModified.getTime()
            : new Date(b.lastModified).getTime()
        return dateB - dateA
      })
    }

    return regular
  }, [workflows, isLoading, activeWorkspaceId])

  const handleCreateWorkflow = async () => {
    try {
      const pendingCreates = Object.keys(useWorkflowRegistry.getState().creatingWorkflowIds).length
      if (pendingCreates > 0) return

      const { isActivelyLoadingFromDB } = await import('@/stores/workflows/sync')
      if (isActivelyLoadingFromDB()) {
        logger.debug('Please wait, syncing in progress...')
        return
      }

      const userId = session?.user?.id
      if (userId) {
        try {
          const response = await fetch('/api/workflows/check-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            const error = await response.json()
            const message = error.message || 'Workflow limit reached.'
            setLimitMessage(message)
            setLimitDetails({
              currentCount: error.currentCount || 0,
              limit: error.limit || 0,
            })
            setLimitExceededDialog(true)
            addNotification('error', message, activeWorkflowId, { isPersistent: true })
            return
          }
        } catch (error) {
          logger.error('Error checking workflow limit:', error)
        }
      }

      const id = await createWorkflow({
        workspaceId: activeWorkspaceId || undefined,
      })

      if (id) {
        router.push(`/w/${id}`)
      }
    } catch (error) {
      logger.error('Error creating workflow:', error)
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'An error occurred while creating workflow.'

      addNotification('error', errorMessage, activeWorkflowId, {
        isPersistent: true,
      })
    }
  }

  const isCollapsed = mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  if (!isSidebarReady) {
    return <SidebarShell isCollapsed={isCollapsed} />
  }

  const groupToggleClass = cn(
    workflowEditorTheme.button,
    'flex w-full items-center justify-between px-2.5 py-2 text-[11px] font-logo font-semibold uppercase tracking-[0.1em]'
  )

  const handleResourceGroupToggle = (group: ResourceGroup) => {
    const currentlyOpenGroup =
      (Object.entries(resourceGroups).find(([, isOpen]) => isOpen)?.[0] as
        | ResourceGroup
        | undefined) ?? null

    if (currentlyOpenGroup === group) {
      setOpenResourceGroup(null)
      return
    }

    setOpenResourceGroup(group)
  }

  const getResourceGroupContentClass = (isOpen: boolean) =>
    cn(
      'grid overflow-hidden transition-[grid-template-rows,opacity,transform] ease-out',
      isOpen
        ? 'grid-rows-[1fr] opacity-100 translate-y-0'
        : 'grid-rows-[0fr] opacity-0 -translate-y-0.5'
    )

  return (
    <aside
      role="navigation"
      aria-label="Workspace sidebar"
      className={`workflow-sidebar-root workflow-editor-sidebar fixed inset-y-0 left-0 flex flex-col transition-all duration-200 ease-out sm:flex z-50 bg-transparent ${isCollapsed ? 'w-14' : 'w-60'}`}
      onMouseEnter={() => {
        if (mode === 'hover') forceExpanded(true)
      }}
      onMouseLeave={() => {
        if (mode === 'hover') forceExpanded(false)
      }}
      onFocus={() => {
        if (mode === 'hover') forceExpanded(true)
      }}
      onBlur={() => {
        if (mode === 'hover') forceExpanded(false)
      }}
    >
      {/* Workspace Header Card */}
      <div className={isCollapsed ? 'p-1.5' : 'px-2.5 pt-2.5 pb-1'}>
        <div
          className={`workflow-sidebar-card workflow-sidebar-header-card workflow-editor-card silver-glass-panel rounded-[6px] ${isCollapsed ? 'p-1.5' : 'p-2'}`}
        >
          <WorkspaceHeader
            onCreateWorkflow={handleCreateWorkflow}
            isCollapsed={isCollapsed}
            onDropdownOpenChange={setWorkspaceDropdownOpen}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className={`flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] flex flex-col ${isCollapsed ? 'px-1.5' : 'px-2.5'}`}
      >
        {/* Workflows Card */}
        <div
          className={`workflow-sidebar-card workflow-sidebar-workflows-card workflow-editor-card silver-glass-panel mt-1 rounded-[6px] ${isCollapsed ? 'p-1.5' : 'p-2'}`}
        >
          {!isCollapsed && (
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <ModernWorkflowIcon className={cn('h-3 w-3', workflowEditorTheme.accentSoft)} />
                <h2
                  className={cn(
                    'workflow-sidebar-section-title text-[11px] font-logo font-semibold tracking-[0.1em] uppercase',
                    workflowEditorTheme.soft
                  )}
                >
                  Workflows
                </h2>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCreateWorkflow}
                    disabled={isActionDisabled || isCreatingWorkflow}
                    className={cn(
                      workflowEditorTheme.iconButton,
                      workflowEditorTheme.accentButton,
                      'workflow-sidebar-create-button flex h-5.5 w-5.5 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40'
                    )}
                    aria-busy={isCreatingWorkflow}
                  >
                    {isCreatingWorkflow ? (
                      <LoadingAgent size="sm" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#1b1b1b] text-white text-[11px] font-logo border-none"
                >
                  Create new workflow
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          {isCollapsed && (
            <div className="flex flex-col items-center gap-1.5 w-full mb-1">
              <ModernWorkflowIcon className={cn('h-4 w-4', workflowEditorTheme.accentSoft)} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCreateWorkflow}
                    disabled={isActionDisabled || isCreatingWorkflow}
                    className={cn(
                      workflowEditorTheme.iconButton,
                      workflowEditorTheme.accentButton,
                      'workflow-sidebar-create-button flex h-8 w-8 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40'
                    )}
                    aria-busy={isCreatingWorkflow}
                  >
                    {isCreatingWorkflow ? (
                      <LoadingAgent size="sm" />
                    ) : (
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#1b1b1b] text-white text-[11px] font-logo border-none"
                >
                  Create new workflow
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          <WorkflowList
            regularWorkflows={regularWorkflows}
            isCollapsed={isCollapsed}
            isLoading={isLoading}
            isCreating={isCreatingWorkflow}
          />
        </div>

        {/* Resources Card */}
        <div
          className={`workflow-sidebar-card workflow-sidebar-resources-card workflow-editor-card silver-glass-panel mt-2 rounded-[6px] ${isCollapsed ? 'p-1.5' : 'p-2'}`}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <BookOpen
                className={cn('h-3.5 w-3.5', workflowEditorTheme.accentSoft)}
                strokeWidth={1.5}
              />
              <h2
                className={cn(
                  'workflow-sidebar-section-title text-[11px] font-logo font-semibold tracking-[0.1em] uppercase',
                  workflowEditorTheme.soft
                )}
              >
                Resources
              </h2>
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center justify-center w-full mb-1">
              <BookOpen
                className={cn('h-4 w-4', workflowEditorTheme.accentSoft)}
                strokeWidth={1.5}
              />
            </div>
          )}

          {/* Data Group */}
          <div className="mb-0.5">
            {!isCollapsed && (
              <button
                onClick={() => handleResourceGroupToggle('data')}
                className={cn(groupToggleClass, 'workflow-sidebar-group-toggle')}
              >
                <span className="flex items-center gap-1.5">
                  <Database className="h-3 w-3" strokeWidth={1.5} />
                  Data
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${!resourceGroups.data ? '-rotate-90' : ''}`}
                  strokeWidth={1.5}
                />
              </button>
            )}
            <div
              className={getResourceGroupContentClass(isCollapsed || resourceGroups.data)}
              style={{ transitionDuration: `${RESOURCE_GROUP_TRANSITION_MS}ms` }}
            >
              <div className="min-h-0 overflow-hidden">
                <NavSection isLoading={false} itemCount={5} isCollapsed={isCollapsed}>
                  <NavSection.Item
                    icon={<BookOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/knowledge"
                    label="Knowledge Sources"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<Database className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/tables"
                    label="Data Tables"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<Brain className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/agent-memories"
                    label="Agent Memories"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<Users className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/agent-profiles"
                    label="Agent Profiles"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<FolderOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/files"
                    label="Files"
                    isCollapsed={isCollapsed}
                  />
                </NavSection>
              </div>
            </div>
          </div>

          {/* Subtle separator between groups */}
          {!isCollapsed && <div className={cn('my-1 mx-1 h-px', workflowEditorTheme.divider)} />}

          {/* Tools Group */}
          <div className="mb-0.5">
            {!isCollapsed && (
              <button
                onClick={() => handleResourceGroupToggle('tools')}
                className={cn(groupToggleClass, 'workflow-sidebar-group-toggle')}
              >
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" strokeWidth={1.5} />
                  Tools
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${!resourceGroups.tools ? '-rotate-90' : ''}`}
                  strokeWidth={1.5}
                />
              </button>
            )}
            <div
              className={getResourceGroupContentClass(isCollapsed || resourceGroups.tools)}
              style={{ transitionDuration: `${RESOURCE_GROUP_TRANSITION_MS}ms` }}
            >
              <div className="min-h-0 overflow-hidden">
                <NavSection isLoading={false} itemCount={4} isCollapsed={isCollapsed}>
                  <NavSection.Item
                    icon={<FormInput className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/interfaces"
                    label="Interfaces"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<BarChart3 className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/analytics"
                    label="Analytics"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<Activity className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/agent-dashboard"
                    label="Agent Dashboard"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<Map className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/system-map"
                    label="System Map"
                    isCollapsed={isCollapsed}
                  />
                </NavSection>
              </div>
            </div>
          </div>

          {/* Subtle separator between groups */}
          {!isCollapsed && <div className={cn('my-1 mx-1 h-px', workflowEditorTheme.divider)} />}

          {/* Platform Group */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => handleResourceGroupToggle('platform')}
                className={cn(groupToggleClass, 'workflow-sidebar-group-toggle')}
              >
                <span className="flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" strokeWidth={1.5} />
                  Platform
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${!resourceGroups.platform ? '-rotate-90' : ''}`}
                  strokeWidth={1.5}
                />
              </button>
            )}
            <div
              className={getResourceGroupContentClass(isCollapsed || resourceGroups.platform)}
              style={{ transitionDuration: `${RESOURCE_GROUP_TRANSITION_MS}ms` }}
            >
              <div className="min-h-0 overflow-hidden">
                <NavSection isLoading={false} itemCount={3} isCollapsed={isCollapsed}>
                  <NavSection.Item
                    icon={<GitBranch className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    onClick={handleEnterpriseRequest}
                    label="Environments"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<Store className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    href="/w/marketplace"
                    label="Marketplace"
                    isCollapsed={isCollapsed}
                  />
                  <NavSection.Item
                    icon={<ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                    onClick={handleEnterpriseRequest}
                    label="Governance"
                    isCollapsed={isCollapsed}
                  />
                </NavSection>
              </div>
            </div>
          </div>
        </div>

        {/* System Card */}
        <div
          className={`workflow-sidebar-card workflow-sidebar-system-card workflow-editor-card silver-glass-panel mt-2 rounded-[6px] ${isCollapsed ? 'p-1.5' : 'p-2'}`}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <Layers
                className={cn('h-3.5 w-3.5', workflowEditorTheme.accentSoft)}
                strokeWidth={1.5}
              />
              <h2
                className={cn(
                  'workflow-sidebar-section-title text-[11px] font-logo font-semibold tracking-[0.1em] uppercase',
                  workflowEditorTheme.soft
                )}
              >
                System
              </h2>
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center justify-center w-full mb-1">
              <Layers className={cn('h-4 w-4', workflowEditorTheme.accentSoft)} strokeWidth={1.5} />
            </div>
          )}
          <NavSection isLoading={false} itemCount={1} isCollapsed={isCollapsed}>
            <NavSection.Item
              icon={<ModernSettingsIcon className="h-[18px] w-[18px]" />}
              onClick={() => setShowSettings(true)}
              label="Settings"
              isCollapsed={isCollapsed}
            />
          </NavSection>
          {!isCollapsed && (
            <div className="mt-2 rounded-[6px] border border-black/[0.06] bg-black/[0.025] p-2 dark:border-white/[0.07] dark:bg-white/[0.035]">
              <div className="mb-1 flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
                <span className="text-[10px] font-logo font-semibold uppercase tracking-[0.1em] text-black/55 dark:text-white/55">
                  Community Edition
                </span>
              </div>
              <p className="text-[11px] leading-4 text-black/55 dark:text-white/55">
                Managed controls, hosted deploy, web research, browser automation, and governance
                are Enterprise.
              </p>
              <button
                type="button"
                onClick={handleEnterpriseRequest}
                className="mt-2 h-7 w-full rounded-[4px] bg-[#4A7A68] px-2 text-[11px] font-logo font-medium text-white transition-colors hover:bg-[#3d6556]"
              >
                Request Enterprise
              </button>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-grow" />
      </div>

      {/* Bottom Controls Card */}
      <div className={isCollapsed ? 'p-1.5' : 'px-2.5 pb-2.5 pt-1'}>
        <div
          className={`workflow-sidebar-card workflow-sidebar-footer-card workflow-editor-card silver-glass-panel rounded-[6px] ${isCollapsed ? 'p-1.5' : 'p-1.5'}`}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center space-y-1.5 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Open help"
                    onClick={() => setShowHelp(true)}
                    className={cn(
                      workflowEditorTheme.iconButton,
                      'flex h-8 w-8 items-center justify-center cursor-pointer transition-all duration-200'
                    )}
                  >
                    <ModernHelpIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#1b1b1b] text-white text-[11px] font-logo border-none"
                >
                  Help
                </TooltipContent>
              </Tooltip>

              <div className={cn('h-px w-6', workflowEditorTheme.divider)} />

              <SidebarControl />
            </div>
          ) : (
            <div className="space-y-0.5">
              <button
                aria-label="Open help"
                onClick={() => setShowHelp(true)}
                className={cn(
                  workflowEditorTheme.textButton,
                  'workflow-sidebar-help-button flex w-full items-center gap-2 px-2 py-1.5 text-[11px] font-logo font-medium transition-all duration-200'
                )}
              >
                <ModernHelpIcon className="h-[18px] w-[18px]" />
                <span>Help & Support</span>
              </button>

              <div className={cn('mx-1 h-px', workflowEditorTheme.divider)} />

              <div className="flex justify-center pt-0.5">
                <SidebarControl />
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <HelpModal open={showHelp} onOpenChange={setShowHelp} />

      <AlertDialog open={limitExceededDialog} onOpenChange={setLimitExceededDialog}>
        <AlertDialogContent className="rounded-[16px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-logo font-semibold text-rose-600 dark:text-rose-300">
              Workflow Limit Exceeded
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] font-logo text-zinc-500 dark:text-white/60">
              {limitMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {limitDetails && (
            <div className="flex flex-col gap-3 text-[13px] font-logo">
              <div className="smoky-glass-pane rounded-[10px] border border-rose-500/16 p-3">
                <p className="font-semibold text-rose-600 dark:text-rose-300">
                  Current Usage: {limitDetails.currentCount} / {limitDetails.limit} workflows
                </p>
              </div>
              <p className="text-zinc-500 dark:text-white/60">
                You have reached the maximum number of workflows for your plan. Upgrade your
                subscription to create more workflows.
              </p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel className="rounded-lg text-[13px] font-logo">
              Close
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLimitExceededDialog(false)
                setShowSettings(true)
              }}
              className="silver-glass-button-strong rounded-lg border-0 bg-transparent text-[13px] font-logo font-medium text-black hover:bg-transparent dark:text-white"
            >
              Upgrade Plan
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
