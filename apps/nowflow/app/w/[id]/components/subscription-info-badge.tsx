'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Crown, Zap } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'

interface SubscriptionInfo {
  plan: 'free' | 'starter' | 'mid' | 'pro' | 'team' | 'enterprise'
  planDisplayName: string
  workflowCount: number
  workflowLimit: number
  apiCallsToday: number
  apiCallsLimit: number
  storageUsed: number
  storageLimit: number
}

export function SubscriptionInfoBadge() {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const fetchSubscriptionInfo = async () => {
      try {
        const response = await fetch('/api/user/limits', { signal: controller.signal })
        if (cancelled) return

        if (response.ok) {
          const data = await response.json()
          if (cancelled) return

          setSubscriptionInfo({
            plan: (data.plan || 'free') as
              | 'free'
              | 'starter'
              | 'mid'
              | 'pro'
              | 'team'
              | 'enterprise',
            planDisplayName: data.planDisplayName || 'Free',
            workflowCount: data.workflowCount || 0,
            workflowLimit: data.workflowLimit || 3,
            apiCallsToday: data.apiCallsToday || 0,
            apiCallsLimit: data.apiCallsLimit || 20,
            storageUsed: data.storageUsed || 0,
            storageLimit: data.storageLimit || 50,
          })
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('Unable to load subscription info for the current session.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSubscriptionInfo()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  if (loading || !subscriptionInfo) {
    return null
  }

  const workflowUsagePercent =
    (subscriptionInfo.workflowCount / subscriptionInfo.workflowLimit) * 100
  const apiUsagePercent = (subscriptionInfo.apiCallsToday / subscriptionInfo.apiCallsLimit) * 100
  const storageUsagePercent = (subscriptionInfo.storageUsed / subscriptionInfo.storageLimit) * 100

  const isWorkflowLimitExceeded = subscriptionInfo.workflowCount >= subscriptionInfo.workflowLimit
  const isApiLimitExceeded = subscriptionInfo.apiCallsToday >= subscriptionInfo.apiCallsLimit
  const isStorageLimitExceeded = subscriptionInfo.storageUsed >= subscriptionInfo.storageLimit

  const hasWarning = workflowUsagePercent > 80 || apiUsagePercent > 80 || storageUsagePercent > 80
  const hasError = isWorkflowLimitExceeded || isApiLimitExceeded || isStorageLimitExceeded

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-control-action="subscription"
          data-control-state={hasError ? 'error' : hasWarning ? 'warning' : subscriptionInfo.plan}
          className={cn(
            'workflow-editor-subscription-badge',
            'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-semibold font-logo tracking-[0.02em] transition-colors duration-200 cursor-help',
            workflowEditorTheme.panelElevated,
            'rounded-[6px] border hover:bg-white/[0.04]',
            workflowEditorTheme.muted,
            hasError && 'text-red-600 dark:text-red-400',
            hasWarning && !hasError && 'text-amber-600 dark:text-amber-400'
          )}
        >
          {hasError ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : subscriptionInfo.plan === 'enterprise' || subscriptionInfo.plan === 'team' ? (
            <Crown className="h-3.5 w-3.5" />
          ) : subscriptionInfo.plan === 'pro' ||
            subscriptionInfo.plan === 'mid' ||
            subscriptionInfo.plan === 'starter' ? (
            <Zap className="h-3.5 w-3.5" />
          ) : (
            <Zap className="h-3.5 w-3.5 opacity-60" />
          )}
          <span className="capitalize">{subscriptionInfo.plan}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="w-64">
        <div className="space-y-2 text-xs font-logo">
          <div className="font-semibold text-zinc-800 dark:text-white">
            {subscriptionInfo.planDisplayName} Plan
          </div>

          <div className="space-y-1 border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
            <div className="flex justify-between">
              <span>Workflows</span>
              <span className={isWorkflowLimitExceeded ? 'text-red-500 font-semibold' : ''}>
                {subscriptionInfo.workflowCount} / {subscriptionInfo.workflowLimit}
              </span>
            </div>
            <div className="w-full rounded-full h-1.5 bg-muted">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  isWorkflowLimitExceeded
                    ? 'bg-red-500/80'
                    : workflowUsagePercent > 80
                      ? 'bg-amber-500/80'
                      : 'bg-emerald-500/80'
                }`}
                style={{ width: `${Math.min(workflowUsagePercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>API Calls (Today)</span>
              <span className={isApiLimitExceeded ? 'text-red-500 font-semibold' : ''}>
                {subscriptionInfo.apiCallsToday} / {subscriptionInfo.apiCallsLimit}
              </span>
            </div>
            <div className="w-full rounded-full h-1.5 bg-muted">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  isApiLimitExceeded
                    ? 'bg-red-500/80'
                    : apiUsagePercent > 80
                      ? 'bg-amber-500/80'
                      : 'bg-emerald-500/80'
                }`}
                style={{ width: `${Math.min(apiUsagePercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Storage</span>
              <span className={isStorageLimitExceeded ? 'text-red-500 font-semibold' : ''}>
                {subscriptionInfo.storageUsed.toFixed(1)} /{' '}
                {subscriptionInfo.storageLimit.toFixed(1)} MB
              </span>
            </div>
            <div className="w-full rounded-full h-1.5 bg-muted">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  isStorageLimitExceeded
                    ? 'bg-red-500/80'
                    : storageUsagePercent > 80
                      ? 'bg-amber-500/80'
                      : 'bg-emerald-500/80'
                }`}
                style={{ width: `${Math.min(storageUsagePercent, 100)}%` }}
              />
            </div>
          </div>

          {hasError && (
            <div className="font-semibold pt-2 border-t text-center text-red-500">
              ⚠️ Limit exceeded! Upgrade your plan.
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
