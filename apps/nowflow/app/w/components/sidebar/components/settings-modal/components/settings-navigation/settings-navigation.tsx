import { type ComponentType, type KeyboardEvent, type SVGProps, useCallback, useMemo } from 'react'
import { Bell, Brain, MessageSquare, Mic, Puzzle, Sparkles } from 'lucide-react'
import { ModernPrivacyIcon } from '@/components/modern-privacy-icons'
import {
  ModernAccountIcon,
  ModernApiKeysIcon,
  ModernCredentialsIcon,
  ModernCustomToolsIcon,
  ModernEnvironmentIcon,
  ModernKnowledgeIcon,
  ModernNotificationIcon,
  ModernSettingsIcon,
  ModernSubscriptionIcon,
  ModernTeamIcon,
} from '@/components/modern-settings-icons'
import { isDev } from '@/lib/environment'
import { cn } from '@/lib/utils'

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

type NavigationGroup = 'workspace' | 'channels' | 'personal' | 'security' | 'billing'

interface SettingsNavigationProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  onSectionPrefetch?: (section: SettingsSection) => void
  isTeam?: boolean
}

type NavigationItem = {
  id: SettingsSection
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  group: NavigationGroup
  hideInDev?: boolean
  requiresTeam?: boolean
}

type NavigationGroupItems = {
  group: NavigationGroup
  label: string
  items: NavigationItem[]
}

const GROUP_LABELS: Record<NavigationGroup, string> = {
  workspace: 'Workspace',
  channels: 'Channels & AI',
  personal: 'Personal',
  security: 'Security',
  billing: 'Billing',
}

const GROUP_ORDER: NavigationGroup[] = ['workspace', 'channels', 'personal', 'security', 'billing']

const SETTINGS_NAV_BUTTON_SELECTOR = '[data-settings-nav-item="true"]'

const allNavigationItems: NavigationItem[] = [
  {
    id: 'general',
    label: 'General',
    icon: ModernSettingsIcon,
    group: 'workspace',
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: ModernEnvironmentIcon,
    group: 'workspace',
  },
  {
    id: 'customtools',
    label: 'Custom Tools',
    icon: ModernCustomToolsIcon,
    group: 'workspace',
  },
  {
    id: 'knowledge',
    label: 'Knowledge Base',
    icon: ModernKnowledgeIcon,
    group: 'workspace',
  },
  {
    id: 'gateway',
    label: 'Messaging Channels',
    icon: MessageSquare,
    group: 'channels',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: Puzzle,
    group: 'channels',
  },
  {
    id: 'aiproviders',
    label: 'AI Providers',
    icon: Sparkles,
    group: 'channels',
  },
  {
    id: 'modelrouter',
    label: 'AI Model Routing',
    icon: Brain,
    group: 'channels',
  },
  {
    id: 'voice',
    label: 'Voice Commands',
    icon: Mic,
    group: 'channels',
  },
  {
    id: 'account',
    label: 'Account',
    icon: ModernAccountIcon,
    group: 'personal',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: ModernNotificationIcon,
    group: 'personal',
  },
  {
    id: 'notificationchannels',
    label: 'Notification Channels',
    icon: Bell,
    group: 'personal',
  },
  {
    id: 'privacy',
    label: 'Privacy & Data',
    icon: ModernPrivacyIcon,
    group: 'personal',
  },
  {
    id: 'credentials',
    label: 'Credentials',
    icon: ModernCredentialsIcon,
    group: 'security',
  },
  {
    id: 'apikeys',
    label: 'API Keys',
    icon: ModernApiKeysIcon,
    group: 'security',
  },
  {
    id: 'subscription',
    label: 'Subscription',
    icon: ModernSubscriptionIcon,
    group: 'billing',
    hideInDev: true,
  },
  {
    id: 'team',
    label: 'Team',
    icon: ModernTeamIcon,
    group: 'billing',
    hideInDev: true,
    requiresTeam: true,
  },
]

export function SettingsNavigation({
  activeSection,
  onSectionChange,
  onSectionPrefetch,
  isTeam = false,
}: SettingsNavigationProps) {
  const groupedItems = useMemo<NavigationGroupItems[]>(() => {
    const itemsByGroup = new Map<NavigationGroup, NavigationItem[]>(
      GROUP_ORDER.map((group) => [group, []])
    )

    for (const item of allNavigationItems) {
      if (item.hideInDev && isDev) {
        continue
      }

      if (item.requiresTeam && !isTeam) {
        continue
      }

      itemsByGroup.get(item.group)?.push(item)
    }

    return GROUP_ORDER.flatMap((group) => {
      const items = itemsByGroup.get(group) ?? []

      return items.length > 0
        ? [
            {
              group,
              label: GROUP_LABELS[group],
              items,
            },
          ]
        : []
    })
  }, [isTeam])

  const handleSectionSelect = useCallback(
    (section: SettingsSection) => {
      if (section === activeSection) return

      onSectionChange(section)
    },
    [activeSection, onSectionChange]
  )

  const handleSectionPrefetch = useCallback(
    (section: SettingsSection) => {
      if (section === activeSection) return

      onSectionPrefetch?.(section)
    },
    [activeSection, onSectionPrefetch]
  )

  const handleNavigationKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return
    }

    const currentButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      SETTINGS_NAV_BUTTON_SELECTOR
    )

    if (!currentButton || !event.currentTarget.contains(currentButton)) {
      return
    }

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(SETTINGS_NAV_BUTTON_SELECTOR)
    )
    const currentIndex = buttons.indexOf(currentButton)

    if (currentIndex === -1) {
      return
    }

    event.preventDefault()

    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowUp'
            ? (currentIndex - 1 + buttons.length) % buttons.length
            : (currentIndex + 1) % buttons.length

    buttons[nextIndex]?.focus()
  }, [])

  return (
    <nav
      aria-label="Settings sections"
      className="community-ui-modal-nav community-ui-settings-nav min-h-0 flex-1 overflow-y-auto scrollbar-thin"
      onKeyDown={handleNavigationKeyDown}
    >
      {groupedItems.map((group, groupIndex) => {
        const groupLabelId = `settings-navigation-${group.group}-label`

        return (
          <div
            key={group.group}
            aria-labelledby={groupLabelId}
            className="community-ui-settings-nav-group"
            data-settings-nav-group={group.group}
            role="group"
          >
            {groupIndex > 0 && (
              <div aria-hidden="true" className="community-ui-settings-nav-divider" />
            )}
            <div className="px-3 py-1.5">
              <span
                id={groupLabelId}
                className="community-ui-modal-nav-group-label text-[11px] font-medium text-muted-foreground"
              >
                {group.label}
              </span>
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id

              return (
                <button
                  key={item.id}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'community-ui-modal-nav-button community-ui-settings-nav-button mx-2 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    isActive
                      ? 'border-border bg-background text-foreground shadow-sm'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
                  )}
                  data-active={isActive}
                  data-settings-group={item.group}
                  data-settings-nav-item="true"
                  data-settings-section={item.id}
                  onClick={() => handleSectionSelect(item.id)}
                  onFocus={() => handleSectionPrefetch(item.id)}
                  onMouseEnter={() => handleSectionPrefetch(item.id)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" focusable="false" />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
