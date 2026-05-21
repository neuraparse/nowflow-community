'use client'

import { type ComponentType, useCallback, useEffect, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { X } from 'lucide-react'
import { ModernSettingsIcon } from '@/components/modern-settings-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { client } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { useSubscription as useSharedSubscription } from '@/hooks/use-subscription'
import { SettingsNavigation } from './components/settings-navigation/settings-navigation'

const logger = createLogger('SettingsModal')

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsSection =
  | 'general'
  | 'environment'
  | 'customtools'
  | 'knowledge'
  | 'gateway'
  | 'skills'
  | 'modelrouter'
  | 'aiproviders'
  | 'voice'
  | 'account'
  | 'notifications'
  | 'notificationchannels'
  | 'privacy'
  | 'credentials'
  | 'apikeys'
  | 'subscription'
  | 'team'

const settingsSectionLoaders = {
  general: () => import('./components/general/general'),
  environment: () => import('./components/environment/environment'),
  customtools: () => import('./components/custom-tools/custom-tools'),
  knowledge: () => import('./components/knowledge/knowledge'),
  gateway: () => import('./components/gateway/gateway'),
  skills: () => import('./components/skills/skills'),
  modelrouter: () => import('./components/model-router/model-router'),
  aiproviders: () => import('./components/ai-providers/ai-providers'),
  voice: () => import('./components/voice/voice'),
  account: () => import('./components/account/account'),
  notifications: () => import('./components/notifications/notifications'),
  notificationchannels: () => import('./components/notification-channels/notification-channels'),
  privacy: () => import('./components/privacy/privacy'),
  credentials: () => import('./components/credentials/credentials'),
  apikeys: () => import('./components/api-keys/api-keys'),
  subscription: () => import('./components/subscription/subscription'),
  team: () => import('./components/team-management/team-management'),
} satisfies Record<SettingsSection, () => Promise<any>>

function SettingsSectionLoader() {
  return (
    <div className="community-ui-settings-placeholder">
      <div className="community-ui-settings-placeholder-row community-ui-settings-placeholder-row--title" />
      <div className="community-ui-settings-placeholder-row" />
      <div className="community-ui-settings-placeholder-row" />
      <div className="community-ui-settings-placeholder-panel">
        <div className="community-ui-settings-placeholder-row community-ui-settings-placeholder-row--panel" />
        <div className="community-ui-settings-placeholder-row" />
        <div className="community-ui-settings-placeholder-row" />
      </div>
      <div className="community-ui-settings-placeholder-panel">
        <div className="community-ui-settings-placeholder-row community-ui-settings-placeholder-row--panel" />
        <div className="community-ui-settings-placeholder-row" />
      </div>
    </div>
  )
}

const settingsSectionComponents = {
  general: dynamic(() => settingsSectionLoaders.general().then((mod) => mod.General), {
    loading: SettingsSectionLoader,
  }),
  environment: dynamic(
    () => settingsSectionLoaders.environment().then((mod) => mod.EnvironmentVariables),
    { loading: SettingsSectionLoader }
  ),
  customtools: dynamic(() => settingsSectionLoaders.customtools().then((mod) => mod.CustomTools), {
    loading: SettingsSectionLoader,
  }),
  knowledge: dynamic(() => settingsSectionLoaders.knowledge().then((mod) => mod.Knowledge), {
    loading: SettingsSectionLoader,
  }),
  gateway: dynamic(() => settingsSectionLoaders.gateway().then((mod) => mod.Gateway), {
    loading: SettingsSectionLoader,
  }),
  skills: dynamic(() => settingsSectionLoaders.skills().then((mod) => mod.Skills), {
    loading: SettingsSectionLoader,
  }),
  modelrouter: dynamic(() => settingsSectionLoaders.modelrouter().then((mod) => mod.ModelRouter), {
    loading: SettingsSectionLoader,
  }),
  aiproviders: dynamic(() => settingsSectionLoaders.aiproviders().then((mod) => mod.AIProviders), {
    loading: SettingsSectionLoader,
  }),
  voice: dynamic(() => settingsSectionLoaders.voice().then((mod) => mod.Voice), {
    loading: SettingsSectionLoader,
  }),
  account: dynamic(() => settingsSectionLoaders.account().then((mod) => mod.Account), {
    loading: SettingsSectionLoader,
  }),
  notifications: dynamic(
    () => settingsSectionLoaders.notifications().then((mod) => mod.Notifications),
    { loading: SettingsSectionLoader }
  ),
  notificationchannels: dynamic(
    () => settingsSectionLoaders.notificationchannels().then((mod) => mod.NotificationChannels),
    { loading: SettingsSectionLoader }
  ),
  privacy: dynamic(() => settingsSectionLoaders.privacy().then((mod) => mod.Privacy), {
    loading: SettingsSectionLoader,
  }),
  credentials: dynamic(() => settingsSectionLoaders.credentials().then((mod) => mod.Credentials), {
    loading: SettingsSectionLoader,
  }),
  apikeys: dynamic(() => settingsSectionLoaders.apikeys().then((mod) => mod.ApiKeys), {
    loading: SettingsSectionLoader,
  }),
  subscription: dynamic(
    () => settingsSectionLoaders.subscription().then((mod) => mod.Subscription),
    { loading: SettingsSectionLoader }
  ),
  team: dynamic(() => settingsSectionLoaders.team().then((mod) => mod.TeamManagement), {
    loading: SettingsSectionLoader,
  }),
} satisfies Record<SettingsSection, ComponentType<any>>

function prefetchSettingsSection(section: SettingsSection) {
  void settingsSectionLoaders[section]()
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [visitedSections, setVisitedSections] = useState<SettingsSection[]>(['general'])
  const [subscriptionData, setSubscriptionData] = useState<any>(null)
  const [usageData, setUsageData] = useState<any>(null)
  const [isBillingLoading, setIsBillingLoading] = useState(false)
  const [, startSectionTransition] = useTransition()
  const { isPro, plan } = useSharedSubscription()
  const isTeam = plan?.name === 'team'
  const isSubscriptionEnabled = !!client.subscription
  const hasLoadedBillingData = useRef(false)
  const isBillingLoadInFlight = useRef(false)

  const markSectionVisited = useCallback((section: SettingsSection) => {
    setVisitedSections((current) => (current.includes(section) ? current : [...current, section]))
  }, [])

  useEffect(() => {
    if (open) {
      prefetchSettingsSection(activeSection)
      markSectionVisited(activeSection)
    }
  }, [activeSection, markSectionVisited, open])

  useEffect(() => {
    if (!open) {
      setVisitedSections((current) =>
        current.length === 1 && current[0] === activeSection ? current : [activeSection]
      )
      setIsBillingLoading(false)
    }
  }, [activeSection, open])

  useEffect(() => {
    if (!isTeam && activeSection === 'team') {
      setActiveSection('general')
    }
  }, [activeSection, isTeam])

  useEffect(() => {
    let cancelled = false

    async function fetchUsageData() {
      const usageResponse = await fetch('/api/user/usage')
      if (!usageResponse.ok) return null
      return usageResponse.json()
    }

    async function fetchSubscriptionData() {
      if (!client.subscription?.list) return null

      try {
        const result = await client.subscription.list()

        if (result.data && result.data.length > 0) {
          return (
            result.data.find(
              (sub) => sub.status === 'active' && (sub.plan === 'team' || sub.plan === 'pro')
            ) ?? null
          )
        }
      } catch (error) {
        logger.error('Error fetching subscription information', error)
      }

      return null
    }

    async function loadBillingData() {
      if (!open || activeSection !== 'subscription' || !isSubscriptionEnabled) return

      if (hasLoadedBillingData.current) {
        setIsBillingLoading(false)
        return
      }

      if (isBillingLoadInFlight.current) {
        return
      }

      isBillingLoadInFlight.current = true
      setIsBillingLoading(true)

      try {
        const [usageResult, subscriptionResult] = await Promise.allSettled([
          fetchUsageData(),
          fetchSubscriptionData(),
        ])

        if (cancelled) return

        if (usageResult.status === 'fulfilled') {
          setUsageData(usageResult.value)
        }

        if (subscriptionResult.status === 'fulfilled') {
          setSubscriptionData(subscriptionResult.value)
        }

        hasLoadedBillingData.current = true
      } catch (error) {
        logger.error('Error loading settings billing data:', error)
      } finally {
        isBillingLoadInFlight.current = false
        if (!cancelled) {
          setIsBillingLoading(false)
        }
      }
    }

    if (open) {
      const timer = window.setTimeout(() => {
        void loadBillingData()
      }, 160)

      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }

    return () => {
      cancelled = true
    }
  }, [activeSection, isSubscriptionEnabled, open])

  useEffect(() => {
    const handleOpenSettings = (event: CustomEvent<{ tab: SettingsSection }>) => {
      const targetTab = event.detail.tab

      prefetchSettingsSection(targetTab)
      markSectionVisited(targetTab)
      setActiveSection(targetTab)
      onOpenChange(true)
    }

    window.addEventListener('open-settings', handleOpenSettings as EventListener)

    return () => {
      window.removeEventListener('open-settings', handleOpenSettings as EventListener)
    }
  }, [markSectionVisited, onOpenChange])

  const handleSectionChange = (section: SettingsSection) => {
    prefetchSettingsSection(section)

    startSectionTransition(() => {
      markSectionVisited(section)
      setActiveSection(section)
    })
  }

  const renderSection = (
    section: SettingsSection,
    props?: Record<string, unknown>,
    isEnabled = true
  ) => {
    if (!isEnabled || !visitedSections.includes(section)) return null

    const SectionComponent = settingsSectionComponents[section]

    return (
      <div
        key={section}
        data-settings-section={section}
        data-active={activeSection === section}
        className={cn(
          'community-ui-settings-section h-full min-h-0 w-full overflow-y-auto overflow-x-hidden',
          activeSection === section ? 'block' : 'hidden'
        )}
      >
        <SectionComponent {...props} />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="workflow-editor-settings-modal community-ui-settings-modal community-ui-settings-shell flex h-[min(82dvh,760px)] w-[min(1040px,calc(100vw-1rem))] max-w-[1040px] flex-col gap-0 overflow-hidden rounded-lg p-0"
        hideCloseButton
      >
        <DialogHeader className="workflow-editor-settings-header community-ui-settings-header border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="workflow-editor-settings-icon community-ui-modal-frame-icon flex h-8 w-8 items-center justify-center rounded-md p-0">
                <ModernSettingsIcon className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="workflow-editor-settings-kicker community-ui-settings-kicker">
                  Workspace
                </p>
                <DialogTitle className="workflow-editor-settings-title text-[15px] font-semibold text-foreground">
                  Settings
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Configure workspace defaults, credentials, AI providers, billing, and personal
                  preferences.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="workflow-editor-settings-status community-ui-settings-status"
                data-settings-state={isBillingLoading ? 'syncing' : 'ready'}
              >
                {isBillingLoading ? 'Syncing' : 'Ready'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="workflow-editor-settings-close community-ui-settings-close h-8 w-8 rounded-md p-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="community-ui-settings-layout flex flex-1 min-h-0">
          <aside
            aria-label="Settings sections"
            className="workflow-editor-settings-sidebar community-ui-settings-sidebar community-ui-modal-sidebar flex min-h-0 w-[220px] shrink-0 flex-col overflow-hidden rounded-none border-r border-border bg-muted/30"
          >
            <div className="community-ui-settings-sidebar-head shrink-0">
              <span className="community-ui-settings-sidebar-label">Sections</span>
            </div>
            <SettingsNavigation
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
              onSectionPrefetch={prefetchSettingsSection}
              isTeam={isTeam}
            />
          </aside>

          <main className="workflow-editor-settings-content community-ui-settings-content flex-1 overflow-hidden bg-background">
            {renderSection('general')}
            {renderSection('environment', { onOpenChange })}
            {renderSection('customtools')}
            {renderSection('knowledge')}
            {renderSection('gateway')}
            {renderSection('skills')}
            {renderSection('modelrouter')}
            {renderSection('aiproviders')}
            {renderSection('voice')}
            {renderSection('account', { onOpenChange })}
            {renderSection('notifications')}
            {renderSection('notificationchannels')}
            {renderSection('privacy')}
            {renderSection('credentials', { onOpenChange })}
            {renderSection('apikeys', { onOpenChange })}
            {renderSection(
              'subscription',
              {
                onOpenChange,
                cachedIsPro: isPro,
                cachedIsTeam: isTeam,
                cachedUsageData: usageData,
                cachedSubscriptionData: subscriptionData,
                isLoading: isBillingLoading,
              },
              isSubscriptionEnabled
            )}
            {renderSection('team', undefined, isTeam)}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
