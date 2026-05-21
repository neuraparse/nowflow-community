'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  BellRing,
  Globe,
  Hash,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Settings2,
  Webhook,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('NotificationChannels')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChannelId =
  | 'email'
  | 'push'
  | 'inApp'
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'whatsapp'
  | 'webhook'

type CategoryId = 'workflowCompletion' | 'workflowFailure' | 'approvalRequests' | 'systemAlerts'

interface ChannelConfig {
  enabled: boolean
  /** Email address, chat ID, channel ID, phone number, or webhook URL */
  configValue: string
}

type ChannelState = Record<ChannelId, ChannelConfig>

type CategoryState = Record<CategoryId, ChannelId[]>

interface ChannelDefinition {
  id: ChannelId
  name: string
  icon: React.ReactNode
  requiresConnection: boolean
  configLabel?: string
  configPlaceholder?: string
  alwaysOn?: boolean
}

interface CategoryDefinition {
  id: CategoryId
  name: string
  description: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNELS: ChannelDefinition[] = [
  {
    id: 'email',
    name: 'Email',
    icon: <Mail className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />,
    requiresConnection: false,
    configLabel: 'Email address',
    configPlaceholder: 'you@example.com',
  },
  {
    id: 'push',
    name: 'Push Notifications',
    icon: <BellRing className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />,
    requiresConnection: false,
  },
  {
    id: 'inApp',
    name: 'In-App',
    icon: <Inbox className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />,
    requiresConnection: false,
    alwaysOn: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: <Send className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />,
    requiresConnection: true,
    configLabel: 'Chat ID',
    configPlaceholder: '-100123456789',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: <Hash className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />,
    requiresConnection: true,
    configLabel: 'Channel ID',
    configPlaceholder: 'C0123456789',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: (
      <MessageCircle className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
    ),
    requiresConnection: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: <Phone className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />,
    requiresConnection: true,
    configLabel: 'Phone number',
    configPlaceholder: '+1 234 567 8900',
  },
  {
    id: 'webhook',
    name: 'Webhook',
    icon: <Webhook className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />,
    requiresConnection: false,
    configLabel: 'Webhook URL',
    configPlaceholder: 'https://example.com/webhook',
  },
]

const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'workflowCompletion',
    name: 'Workflow Completion',
    description: 'Notify when a workflow finishes successfully.',
  },
  {
    id: 'workflowFailure',
    name: 'Workflow Failure',
    description: 'Notify when a workflow fails during execution.',
  },
  {
    id: 'approvalRequests',
    name: 'Approval Requests',
    description: 'Notify when human-in-the-loop approval is needed.',
  },
  {
    id: 'systemAlerts',
    name: 'System Alerts',
    description: 'Notify for system-level alerts and warnings.',
  },
]

const DEFAULT_CHANNELS: ChannelState = {
  email: { enabled: true, configValue: '' },
  push: { enabled: false, configValue: '' },
  inApp: { enabled: true, configValue: '' },
  telegram: { enabled: false, configValue: '' },
  slack: { enabled: false, configValue: '' },
  discord: { enabled: false, configValue: '' },
  whatsapp: { enabled: false, configValue: '' },
  webhook: { enabled: false, configValue: '' },
}

const DEFAULT_CATEGORIES: CategoryState = {
  workflowCompletion: ['email', 'inApp'],
  workflowFailure: ['email', 'inApp'],
  approvalRequests: ['email', 'inApp', 'push'],
  systemAlerts: ['email', 'inApp'],
}

// ---------------------------------------------------------------------------
// Simulated connection status (would be fetched from API in production)
// ---------------------------------------------------------------------------

const CONNECTED_CHANNELS: Set<ChannelId> = new Set(['email', 'push', 'inApp'])

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationChannels() {
  const [channels, setChannels] = useState<ChannelState>(DEFAULT_CHANNELS)
  const [categories, setCategories] = useState<CategoryState>(DEFAULT_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedChannel, setExpandedChannel] = useState<ChannelId | null>(null)

  // Simulate initial data load
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/user/notification-channels')
        if (response.ok) {
          const { data } = await response.json()
          if (data?.channels) setChannels({ ...DEFAULT_CHANNELS, ...data.channels })
          if (data?.categories) setCategories({ ...DEFAULT_CATEGORIES, ...data.categories })
        }
      } catch (error) {
        logger.error('Failed to load notification channel settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // Persist helper
  const persist = useCallback(async (nextChannels: ChannelState, nextCategories: CategoryState) => {
    try {
      await fetch('/api/user/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: nextChannels, categories: nextCategories }),
      })
    } catch (error) {
      logger.error('Failed to save notification channel settings:', error)
    }
  }, [])

  // Channel toggle
  const toggleChannel = (id: ChannelId) => {
    const def = CHANNELS.find((c) => c.id === id)
    if (def?.alwaysOn) return

    setChannels((prev) => {
      const next = { ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }
      // If disabling, remove from all categories
      if (!next[id].enabled) {
        setCategories((prevCats) => {
          const nextCats = { ...prevCats }
          for (const catId of Object.keys(nextCats) as CategoryId[]) {
            nextCats[catId] = nextCats[catId].filter((ch) => ch !== id)
          }
          persist(next, nextCats)
          return nextCats
        })
      } else {
        persist(next, categories)
      }
      return next
    })
  }

  // Channel config value
  const updateConfigValue = (id: ChannelId, value: string) => {
    setChannels((prev) => {
      const next = { ...prev, [id]: { ...prev[id], configValue: value } }
      persist(next, categories)
      return next
    })
  }

  // Category-channel toggle
  const toggleCategoryChannel = (catId: CategoryId, chId: ChannelId) => {
    if (!channels[chId].enabled) return
    setCategories((prev) => {
      const list = prev[catId] ?? []
      const next = {
        ...prev,
        [catId]: list.includes(chId) ? list.filter((c) => c !== chId) : [...list, chId],
      }
      persist(channels, next)
      return next
    })
  }

  // Helpers
  const isConnected = (id: ChannelId) => CONNECTED_CHANNELS.has(id)
  const enabledChannels = CHANNELS.filter((ch) => channels[ch.id].enabled)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2 mb-1">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <Bell className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
          </span>
          Notification Channels
        </h2>
        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 ml-9">
          Choose where to receive workflow notifications.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* ---- Channel List ---- */}
          <div className="space-y-3">
            <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
              <Globe className="h-4 w-4" strokeWidth={1.5} />
              Delivery Channels
            </h3>

            <div className="space-y-2">
              {CHANNELS.map((ch) => {
                const state = channels[ch.id]
                const connected = isConnected(ch.id)
                const expanded = expandedChannel === ch.id

                return (
                  <div
                    key={ch.id}
                    className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent transition-all duration-200 dark:border-white/[0.08]"
                  >
                    {/* Main row */}
                    <div className="flex items-center justify-between py-2 px-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg shrink-0">
                          {ch.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Label className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium">
                              {ch.name}
                            </Label>
                            {ch.requiresConnection && (
                              <Badge
                                className={
                                  connected
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0'
                                    : 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20 text-[10px] px-1.5 py-0'
                                }
                              >
                                {connected ? 'Connected' : 'Not connected'}
                              </Badge>
                            )}
                            {ch.alwaysOn && (
                              <Badge className="bg-[#4A7A68]/10 text-[#4A7A68] dark:text-[#94B8A6] border-[#4A7A68]/20 dark:border-[#94B8A6]/20 text-[10px] px-1.5 py-0">
                                Always on
                              </Badge>
                            )}
                          </div>
                          {ch.requiresConnection && !connected && (
                            <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                              Connect your {ch.name} gateway channel to enable.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {ch.configLabel && state.enabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] font-logo text-zinc-500 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white"
                            onClick={() => setExpandedChannel(expanded ? null : ch.id)}
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                            Configure
                          </Button>
                        )}
                        <Switch
                          checked={state.enabled}
                          disabled={ch.alwaysOn || (ch.requiresConnection && !connected)}
                          onCheckedChange={() => toggleChannel(ch.id)}
                          className="data-[state=checked]:bg-[#4A7A68] dark:data-[state=checked]:bg-[#94B8A6]"
                        />
                      </div>
                    </div>

                    {/* Expanded config */}
                    {expanded && ch.configLabel && state.enabled && (
                      <div className="px-3 pb-3 pt-0">
                        <div className="ml-9 space-y-1.5">
                          <Label className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                            {ch.configLabel}
                          </Label>
                          <Input
                            value={state.configValue}
                            onChange={(e) => updateConfigValue(ch.id, e.target.value)}
                            placeholder={ch.configPlaceholder}
                            className="h-8 text-[12px] font-logo"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ---- Notification Categories ---- */}
          <div className="space-y-3">
            <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              Notification Categories
            </h3>
            <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 -mt-1">
              Choose which channels receive each type of notification.
            </p>

            <div className="space-y-2">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent p-3 space-y-2.5 dark:border-white/[0.08]"
                >
                  <div>
                    <Label className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium">
                      {cat.name}
                    </Label>
                    <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                      {cat.description}
                    </p>
                  </div>

                  {/* Per-channel toggles */}
                  <div className="flex flex-wrap gap-2">
                    {enabledChannels.map((ch) => {
                      const active = (categories[cat.id] ?? []).includes(ch.id)
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => toggleCategoryChannel(cat.id, ch.id)}
                          className={`
                            flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-logo font-medium transition-all duration-150
                            ${
                              active
                                ? 'border-[#4A7A68]/30 dark:border-[#94B8A6]/30 bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] text-[#4A7A68] dark:text-[#94B8A6]'
                                : 'border-black/[0.06] dark:border-white/[0.06] bg-transparent text-zinc-400 dark:text-white/40 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                            }
                          `}
                        >
                          <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{ch.icon}</span>
                          {ch.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function ChannelCardSkeleton() {
  return (
    <div className="silver-glass-pane flex items-center justify-between rounded-lg border border-black/[0.04] bg-transparent px-3 py-2 dark:border-white/[0.08]">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div>
          <Skeleton className="h-4 w-28 mb-1" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  )
}
