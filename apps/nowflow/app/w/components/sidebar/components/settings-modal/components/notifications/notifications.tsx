'use client'

import { useEffect, useState } from 'react'
import { Mail, Zap } from 'lucide-react'
import { ModernNotificationIcon } from '@/components/modern-settings-icons'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('Notifications')

interface NotificationPreferences {
  workflowCompletion: boolean
  workflowFailure: boolean
  approvalRequests: boolean
  digestEnabled: boolean
  digestSchedule: string
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  workflowCompletion: true,
  workflowFailure: true,
  approvalRequests: true,
  digestEnabled: false,
  digestSchedule: 'daily',
}

export function Notifications() {
  const { data: session } = useSession()
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) return

    const fetchPreferences = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/user/notification-preferences')
        if (response.ok) {
          const { data } = await response.json()
          setPreferences({
            workflowCompletion: data.workflowCompletion ?? true,
            workflowFailure: data.workflowFailure ?? true,
            approvalRequests: data.approvalRequests ?? true,
            digestEnabled: data.digestEnabled ?? false,
            digestSchedule: data.digestSchedule ?? 'daily',
          })
        }
      } catch (error) {
        logger.error('Failed to fetch notification preferences:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreferences()
  }, [session?.user?.id])

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean | string) => {
    // Optimistic update
    setPreferences((prev) => ({ ...prev, [key]: value }))

    try {
      const response = await fetch('/api/user/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })

      if (!response.ok) {
        // Revert on failure
        setPreferences((prev) => ({ ...prev, [key]: !value }))
        logger.error('Failed to update notification preference:', key)
      }
    } catch (error) {
      // Revert on error
      setPreferences((prev) => ({ ...prev, [key]: !value }))
      logger.error('Failed to update notification preference:', error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-[15px] font-logo font-semibold mb-1 text-zinc-800 dark:text-white flex items-center gap-2">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <ModernNotificationIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          Notifications
        </h2>
        <p className="text-[12px] font-logo text-black/50 dark:text-white/60 mb-6 ml-9">
          Control how and when you receive notifications.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SettingRowSkeleton />
          <SettingRowSkeleton />
          <SettingRowSkeleton />
          <SettingRowSkeleton />
          <SettingRowSkeleton />
        </div>
      ) : (
        <>
          {/* Email Notifications */}
          <div>
            <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" strokeWidth={1.5} />
              Email Notifications
            </h3>
            <div className="space-y-3">
              <SettingRow
                id="workflow-completion"
                icon={
                  <Zap className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
                }
                label="Workflow Completion"
                description="Receive an email when a workflow completes successfully."
                checked={preferences.workflowCompletion}
                onCheckedChange={(checked) => updatePreference('workflowCompletion', checked)}
              />

              <SettingRow
                id="workflow-failure"
                icon={
                  <Zap className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
                }
                label="Workflow Failure"
                description="Receive an email when a workflow fails during execution."
                checked={preferences.workflowFailure}
                onCheckedChange={(checked) => updatePreference('workflowFailure', checked)}
              />

              <SettingRow
                id="approval-requests"
                icon={
                  <Zap className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
                }
                label="Approval Requests"
                description="Receive an email when human-in-the-loop approval is needed."
                checked={preferences.approvalRequests}
                onCheckedChange={(checked) => updatePreference('approvalRequests', checked)}
              />

              <SettingRow
                id="email-digest"
                icon={
                  <Mail className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
                }
                label="Email Digest"
                description="Receive a summary digest instead of individual notifications."
                checked={preferences.digestEnabled}
                onCheckedChange={(checked) => updatePreference('digestEnabled', checked)}
              />

              {preferences.digestEnabled && (
                <div className="silver-glass-pane ml-4 flex items-center justify-between rounded-lg bg-transparent py-2 px-3 transition-all duration-200">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                      <Mail
                        className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]"
                        strokeWidth={1.5}
                      />
                    </span>
                    <div>
                      <Label className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium">
                        Digest Schedule
                      </Label>
                      <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                        How often to receive digest emails.
                      </p>
                    </div>
                  </div>
                  <Select
                    value={preferences.digestSchedule}
                    onValueChange={(value) => updatePreference('digestSchedule', value)}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-[13px] font-logo focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SettingRow({
  id,
  icon,
  label,
  description,
  checked,
  onCheckedChange,
  indented = false,
}: {
  id: string
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  indented?: boolean
}) {
  return (
    <div
      className={`silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-2 px-3 transition-all duration-200 ${indented ? 'ml-4' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
          {icon}
        </span>
        <div>
          <Label
            htmlFor={id}
            className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium"
          >
            {label}
          </Label>
          <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
            {description}
          </p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[#4A7A68] dark:data-[state=checked]:bg-[#94B8A6]"
      />
    </div>
  )
}

const SettingRowSkeleton = () => (
  <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-black/[0.04] dark:border-white/[0.04] bg-black/[0.02] dark:bg-white/[0.02]">
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div>
        <Skeleton className="h-5 w-32 mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
    <Skeleton className="h-6 w-12 rounded-full" />
  </div>
)
