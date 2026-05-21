import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CreditCard, ExternalLink, Receipt, Sparkles } from 'lucide-react'
import { ModernSubscriptionIcon } from '@/components/modern-settings-icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization, useSession, useSubscription } from '@/lib/auth-client'
import { openEnterpriseUrl } from '@/lib/community/enterprise'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('Subscription')

const PAID_PLAN_NAMES = ['starter', 'mid', 'pro', 'team', 'enterprise'] as const
type PaidPlanName = (typeof PAID_PLAN_NAMES)[number]
type PlanName = 'free' | PaidPlanName

const PLAN_RANK: Record<PlanName, number> = {
  free: 0,
  starter: 1,
  mid: 2,
  pro: 3,
  team: 4,
  enterprise: 5,
}

const DEFAULT_USAGE_DATA = {
  percentUsed: 0,
  isWarning: false,
  isExceeded: false,
  currentUsage: 0,
  limit: 0,
}

const DEFAULT_LIMIT_DATA: LimitData = {
  workflowCount: 0,
  workflowLimit: 3,
  apiCallsToday: 0,
  apiCallsLimit: 20,
  storageUsed: 0,
  storageLimit: 50,
}

const SEAT_OPTIONS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50]

const PLAN_CARDS: Array<{
  key: Exclude<PlanName, 'enterprise'>
  name: string
  description: string
  price: string
  costLimit: string
  features: string[]
}> = [
  {
    key: 'free',
    name: 'Free',
    description: 'For individuals getting started',
    price: '$0',
    costLimit: '$5 inference credits',
    features: ['3 workflows', '20 API calls/day', '50 MB storage'],
  },
  {
    key: 'starter',
    name: 'Starter',
    description: 'For individuals building automations',
    price: '$9/month',
    costLimit: '$10 inference credits',
    features: ['5 workflows', '100 API calls/day', '256 MB storage'],
  },
  {
    key: 'mid',
    name: 'Mid',
    description: 'For growing teams with sharing needs',
    price: '$15/month',
    costLimit: '$20 inference credits',
    features: ['15 workflows', '500 API calls/day', '1 GB storage', 'Workflow sharing'],
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'For professionals who need full power',
    price: '$30/month',
    costLimit: '$40 inference credits',
    features: [
      '50 workflows',
      '2,000 API calls/day',
      '5 GB storage',
      'Workflow sharing',
      'API access',
    ],
  },
  {
    key: 'team',
    name: 'Team',
    description: 'Real-time collaboration for teams',
    price: '$49/seat/month',
    costLimit: '$40 inference credits/seat',
    features: [
      '200 workflows',
      '10,000 API calls/day',
      '20 GB storage/seat',
      'Multiplayer collaboration',
      'Shared workspace',
    ],
  },
]

const STRIPE_STATUS_CACHE_TTL = 5 * 60 * 1000
let stripeStatusCache: { enabled: boolean; timestamp: number } | null = null
let stripeStatusPromise: Promise<boolean> | null = null

interface SubscriptionProps {
  onOpenChange: (open: boolean) => void
  cachedIsPro?: boolean
  cachedIsTeam?: boolean
  cachedUsageData?: any
  cachedSubscriptionData?: any
  isLoading?: boolean
}

interface LimitData {
  workflowCount: number
  workflowLimit: number
  apiCallsToday: number
  apiCallsLimit: number
  storageUsed: number
  storageLimit: number
}

function isPlanName(plan: unknown): plan is PlanName {
  return typeof plan === 'string' && plan in PLAN_RANK
}

function isPaidPlanName(plan: PlanName): plan is PaidPlanName {
  return PAID_PLAN_NAMES.includes(plan as PaidPlanName)
}

function getSubscriptionPlan(subscriptionData: any): PlanName | null {
  const plan =
    typeof subscriptionData?.plan === 'object'
      ? subscriptionData?.plan?.name
      : subscriptionData?.plan

  return isPlanName(plan) ? plan : null
}

function resolvePlan(subscriptionData: any, isPro?: boolean, isTeam?: boolean): PlanName {
  const subscriptionPlan = getSubscriptionPlan(subscriptionData)
  if (subscriptionPlan) return subscriptionPlan
  if (isTeam) return 'team'
  if (isPro) return 'pro'
  return 'free'
}

function getCachedStripeStatus() {
  if (!stripeStatusCache) return null
  return Date.now() - stripeStatusCache.timestamp < STRIPE_STATUS_CACHE_TTL
    ? stripeStatusCache.enabled
    : null
}

function loadStripeStatus() {
  const cachedStatus = getCachedStripeStatus()
  if (cachedStatus !== null) return Promise.resolve(cachedStatus)
  if (stripeStatusPromise) return stripeStatusPromise

  stripeStatusPromise = fetch('/api/stripe/status')
    .then((response) => response.json())
    .then((data) => data?.enabled === true)
    .catch(() => false)
    .then((enabled) => {
      stripeStatusCache = { enabled, timestamp: Date.now() }
      return enabled
    })
    .finally(() => {
      stripeStatusPromise = null
    })

  return stripeStatusPromise
}

/** Map plan name -> display info */
const PLAN_INFO: Record<
  string,
  { label: string; price: string; costLimit: string; color: string }
> = {
  free: { label: 'Free', price: '$0', costLimit: '$5', color: '' },
  starter: { label: 'Starter', price: '$9/mo', costLimit: '$10', color: 'text-emerald-600' },
  mid: { label: 'Mid', price: '$15/mo', costLimit: '$20', color: 'text-sky-600' },
  pro: { label: 'Pro', price: '$30/mo', costLimit: '$40', color: 'text-indigo-600' },
  team: { label: 'Team', price: '$49/seat/mo', costLimit: '$40/seat', color: 'text-purple-600' },
  enterprise: {
    label: 'Enterprise',
    price: 'Custom',
    costLimit: 'Custom',
    color: 'text-amber-600',
  },
}

const useSubscriptionData = (
  userId: string | null | undefined,
  activeOrgId: string | null | undefined,
  cachedIsPro?: boolean,
  cachedIsTeam?: boolean,
  cachedUsageData?: any,
  cachedSubscriptionData?: any,
  isParentLoading?: boolean
) => {
  const [isPro, setIsPro] = useState<boolean>(cachedIsPro || false)
  const [isTeam, setIsTeam] = useState<boolean>(cachedIsTeam || false)
  const [currentPlan, setCurrentPlan] = useState<PlanName>(() =>
    resolvePlan(cachedSubscriptionData, cachedIsPro, cachedIsTeam)
  )
  const [usageData, setUsageData] = useState<{
    percentUsed: number
    isWarning: boolean
    isExceeded: boolean
    currentUsage: number
    limit: number
  }>(cachedUsageData || DEFAULT_USAGE_DATA)
  const [limitData, setLimitData] = useState<LimitData>(DEFAULT_LIMIT_DATA)
  const [subscriptionData, setSubscriptionData] = useState<any>(cachedSubscriptionData || null)
  const [loading, setLoading] = useState<boolean>(
    isParentLoading !== undefined ? isParentLoading : true
  )
  const [error, setError] = useState<string | null>(null)
  const subscription = useSubscription()
  const subscriptionRef = useRef(subscription)

  useEffect(() => {
    subscriptionRef.current = subscription
  }, [subscription])

  useEffect(() => {
    if (
      isParentLoading !== undefined ||
      (cachedIsPro !== undefined &&
        cachedIsTeam !== undefined &&
        cachedUsageData &&
        cachedSubscriptionData)
    ) {
      if (cachedIsPro !== undefined) setIsPro(cachedIsPro)
      if (cachedIsTeam !== undefined) setIsTeam(cachedIsTeam)
      setCurrentPlan(resolvePlan(cachedSubscriptionData, cachedIsPro, cachedIsTeam))
      setUsageData(cachedUsageData || DEFAULT_USAGE_DATA)
      setSubscriptionData(cachedSubscriptionData || null)
      if (isParentLoading !== undefined) setLoading(isParentLoading)
      return
    }

    async function loadSubscriptionData() {
      if (!userId) return

      try {
        setLoading(true)
        setError(null)

        const [usageResponse, limitsResponse] = await Promise.all([
          fetch('/api/user/usage'),
          fetch('/api/user/limits'),
        ])

        if (!usageResponse.ok) {
          throw new Error('Failed to fetch usage data')
        }

        if (cachedIsPro !== undefined) setIsPro(cachedIsPro)
        if (cachedIsTeam !== undefined) setIsTeam(cachedIsTeam)

        const usageDataResponse = await usageResponse.json()
        setUsageData(usageDataResponse)

        if (limitsResponse.ok) {
          try {
            const limitsData = await limitsResponse.json()
            setLimitData(limitsData)
          } catch (error) {
            logger.warn('Failed to parse limits data:', error)
          }
        }

        let activeSubscription = null

        if (activeOrgId) {
          const result = await subscriptionRef.current.list({
            query: { referenceId: activeOrgId },
          })
          const orgSubscriptions = result.data
          if (orgSubscriptions) {
            activeSubscription = orgSubscriptions.find(
              (sub) => sub.status === 'active' && sub.plan === 'team'
            )
          }
        }

        if (!activeSubscription) {
          const result = await subscriptionRef.current.list()
          const userSubscriptions = result.data
          if (userSubscriptions) {
            activeSubscription = userSubscriptions.find((sub) => sub.status === 'active')
          }
        }

        if (activeSubscription) {
          const activePlan = resolvePlan(activeSubscription)

          setSubscriptionData(activeSubscription)
          setCurrentPlan(activePlan)
          setIsPro(isPaidPlanName(activePlan))
          setIsTeam(activePlan === 'team' || activePlan === 'enterprise')
        }
      } catch (error) {
        logger.error('Error checking subscription status:', error)
        setError('Failed to load subscription data')
      } finally {
        setLoading(false)
      }
    }

    loadSubscriptionData()
  }, [
    userId,
    activeOrgId,
    cachedIsPro,
    cachedIsTeam,
    cachedUsageData,
    cachedSubscriptionData,
    isParentLoading,
  ])

  return { isPro, isTeam, currentPlan, usageData, subscriptionData, loading, error, limitData }
}

export function Subscription({
  cachedIsPro,
  cachedIsTeam,
  cachedUsageData,
  cachedSubscriptionData,
  isLoading,
}: SubscriptionProps) {
  const { data: session } = useSession()
  const { data: activeOrg } = useActiveOrganization()
  const subscription = useSubscription()
  const subscriptionRef = useRef(subscription)

  const {
    isPro,
    isTeam,
    currentPlan,
    usageData,
    subscriptionData,
    loading,
    error: subscriptionError,
    limitData,
  } = useSubscriptionData(
    session?.user?.id,
    activeOrg?.id,
    cachedIsPro,
    cachedIsTeam,
    cachedUsageData,
    cachedSubscriptionData,
    isLoading
  )

  const [isCanceling, setIsCanceling] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState<boolean>(false)
  const [seats, setSeats] = useState<number>(1)
  const [isUpgradingTeam, setIsUpgradingTeam] = useState<boolean>(false)
  const [isUpgrading, setIsUpgrading] = useState<boolean>(false)
  const [stripeEnabled, setStripeEnabled] = useState<boolean>(() => getCachedStripeStatus() ?? true)
  const [stripeLoading, setStripeLoading] = useState<boolean>(
    () => getCachedStripeStatus() === null
  )

  useEffect(() => {
    subscriptionRef.current = subscription
  }, [subscription])

  useEffect(() => {
    let cancelled = false

    loadStripeStatus().then((enabled) => {
      if (cancelled) return
      setStripeEnabled(enabled)
      setStripeLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (subscriptionError) {
      setError(subscriptionError)
    }
  }, [subscriptionError])

  const activePlan = useMemo(() => {
    const subscriptionPlan = getSubscriptionPlan(subscriptionData)
    if (subscriptionPlan) return subscriptionPlan
    if (currentPlan !== 'free') return currentPlan
    return resolvePlan(null, isPro, isTeam)
  }, [currentPlan, isPro, isTeam, subscriptionData])

  const activePlanRank = PLAN_RANK[activePlan]
  const currentPlans = useMemo(
    () => ({
      free: activePlan === 'free',
      starter: activePlan === 'starter',
      mid: activePlan === 'mid',
      pro: activePlan === 'pro',
      team: activePlan === 'team',
    }),
    [activePlan]
  )
  const hasPaidSubscription = activePlan !== 'free' || isPro || isTeam
  const shouldShowUpgrade = useCallback(
    (plan: Exclude<PlanName, 'free' | 'enterprise'>) => activePlanRank < PLAN_RANK[plan],
    [activePlanRank]
  )

  const handleUpgrade = useCallback(
    async (plan: PaidPlanName) => {
      if (!session?.user) {
        setError('You need to be logged in to upgrade your subscription')
        return
      }
      if (!stripeEnabled) {
        setError('Payment system is not configured. Please contact support.')
        return
      }

      setIsUpgrading(true)
      setError(null)

      try {
        const result = await subscriptionRef.current.upgrade({
          plan,
          successUrl: window.location.href,
          cancelUrl: window.location.href,
        })

        if ('error' in result && result.error) {
          setError(result.error.message || `There was an error upgrading to the ${plan} plan`)
          logger.error('Subscription upgrade error:', result.error)
        }
      } catch (error: any) {
        logger.error('Subscription upgrade exception:', error)
        setError(error.message || `There was an unexpected error upgrading to the ${plan} plan`)
      } finally {
        setIsUpgrading(false)
      }
    },
    [session?.user, stripeEnabled]
  )

  const handleCancel = useCallback(async () => {
    if (!session?.user) {
      setError('You need to be logged in to cancel your subscription')
      return
    }

    setIsCanceling(true)
    setError(null)

    try {
      const result = await subscriptionRef.current.cancel({
        returnUrl: window.location.href,
      })

      if ('error' in result && result.error) {
        setError(result.error.message || 'There was an error canceling your subscription')
        logger.error('Subscription cancellation error:', result.error)
      }
    } catch (error: any) {
      logger.error('Subscription cancellation exception:', error)
      setError(error.message || 'There was an unexpected error canceling your subscription')
    } finally {
      setIsCanceling(false)
    }
  }, [session?.user])

  const handleTeamUpgrade = useCallback(() => {
    if (!stripeEnabled) {
      setError('Payment system is not configured. Please contact support.')
      return
    }
    setIsTeamDialogOpen(true)
  }, [stripeEnabled])

  const confirmTeamUpgrade = useCallback(async () => {
    if (!session?.user) {
      setError('You need to be logged in to upgrade your team subscription')
      return
    }

    setIsUpgradingTeam(true)
    setError(null)

    try {
      const result = await subscriptionRef.current.upgrade({
        plan: 'team',
        seats,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
      })

      if ('error' in result && result.error) {
        setError(result.error.message || 'There was an error upgrading to the team plan')
        logger.error('Team subscription upgrade error:', result.error)
      } else {
        setIsTeamDialogOpen(false)
      }
    } catch (error: any) {
      logger.error('Team subscription upgrade exception:', error)
      setError(error.message || 'There was an unexpected error upgrading to the team plan')
    } finally {
      setIsUpgradingTeam(false)
    }
  }, [seats, session?.user])

  const planActions = useMemo(
    () => ({
      starter: () => handleUpgrade('starter'),
      mid: () => handleUpgrade('mid'),
      pro: () => handleUpgrade('pro'),
      team: handleTeamUpgrade,
    }),
    [handleTeamUpgrade, handleUpgrade]
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-[15px] font-logo font-semibold mb-1 text-zinc-800 dark:text-white flex items-center gap-2">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <ModernSubscriptionIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          Subscription Plans
        </h3>
        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-6 ml-9">
          Manage your subscription and billing details.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4 border-rose-500/18">
          <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stripe not configured notice */}
      {!stripeLoading && !stripeEnabled && (
        <Alert className="mb-4 border-amber-500/18 text-amber-800 dark:border-amber-400/18 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" strokeWidth={1.5} />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200 font-logo text-[12px]">
            Payment system not configured
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300 font-logo text-[11px]">
            Upgrade features are currently unavailable. Please contact support to upgrade your plan.
          </AlertDescription>
        </Alert>
      )}

      {(usageData.isWarning || usageData.isExceeded) && !isPro && (
        <Alert variant="destructive" className="mb-4 border-rose-500/18">
          <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
          <AlertTitle className="font-logo text-[12px]">
            {usageData.isExceeded ? 'Usage Limit Exceeded' : 'Usage Warning'}
          </AlertTitle>
          <AlertDescription className="font-logo text-[11px]">
            You've used {usageData.percentUsed}% of your free tier limit (
            {usageData.currentUsage.toFixed(2)}$ of {usageData.limit}$).
            {usageData.isExceeded
              ? ' Upgrade to continue using all features.'
              : ' Upgrade to avoid any service interruptions.'}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <SubscriptionSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_CARDS.map((plan) => {
              const isCurrent = currentPlans[plan.key]
              const canUpgrade = plan.key !== 'free' && shouldShowUpgrade(plan.key)
              const onUpgrade =
                stripeEnabled && plan.key !== 'free' ? planActions[plan.key] : undefined
              const showUsage = isCurrent && ['free', 'pro', 'team'].includes(plan.key)

              return (
                <PlanCard
                  key={plan.key}
                  name={plan.name}
                  description={plan.description}
                  price={plan.price}
                  costLimit={plan.costLimit}
                  features={plan.features}
                  isCurrent={isCurrent}
                  onUpgrade={onUpgrade}
                  isUpgrading={isUpgrading}
                  stripeEnabled={stripeEnabled}
                  showUpgrade={canUpgrade}
                  onDowngrade={
                    isCurrent && plan.key === 'starter' && hasPaidSubscription
                      ? handleCancel
                      : undefined
                  }
                  isDowngrading={isCanceling}
                  showUsage={showUsage}
                  usageData={usageData}
                  limitData={limitData}
                  seats={plan.key === 'team' ? subscriptionData?.seats || 1 : undefined}
                  costPerSeat={plan.key === 'team' ? 49 : undefined}
                />
              )
            })}

            {/* Enterprise Tier */}
            <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent p-4 transition-all duration-200 dark:border-white/[0.08] md:col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                  <Sparkles
                    className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                    strokeWidth={1.5}
                  />
                </span>
                <h4 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                  Enterprise
                </h4>
              </div>
              <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mt-1 ml-9">
                For larger teams and organizations
              </p>
              <ul className="mt-3 space-y-1.5 text-[12px] font-logo text-black/60 dark:text-white/70 ml-9">
                <li>• Custom cost limits</li>
                <li>• Priority support</li>
                <li>• Custom integrations</li>
                <li>• Dedicated account manager</li>
                <li>• White-label solution</li>
              </ul>
              <div className="mt-4 ml-9">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEnterpriseUrl}
                  className="border-[#4A7A68]/20 text-[#4A7A68] hover:bg-[#4A7A68]/[0.08] dark:border-[#94B8A6]/20 dark:text-[#94B8A6] dark:hover:bg-[#94B8A6]/[0.10]"
                >
                  Contact Us
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          </div>

          {subscriptionData && (
            <div className="space-y-3">
              <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
                Subscription Details
              </h4>
              <div className="silver-glass-pane rounded-lg bg-transparent p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                    Plan
                  </span>
                  <span className="text-[12px] font-logo font-medium text-zinc-800 dark:text-white capitalize">
                    {PLAN_INFO[activePlan]?.label || activePlan}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                    Status
                  </span>
                  <span className="text-[12px] font-logo font-medium capitalize inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-zinc-800 dark:text-white">{subscriptionData.status}</span>
                  </span>
                </div>
                {subscriptionData.periodEnd && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                      Next billing date
                    </span>
                    <span className="text-[12px] font-logo font-medium text-zinc-800 dark:text-white">
                      {new Date(subscriptionData.periodEnd).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {hasPaidSubscription && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isCanceling}
                      className="text-[12px] font-logo"
                    >
                      {isCanceling ? <ButtonSkeleton /> : <span>Manage Subscription</span>}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Billing & Payment */}
          {hasPaidSubscription && (
            <div className="space-y-3">
              <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
                Billing & Payment
              </h4>
              <button
                type="button"
                onClick={() => window.open('/api/auth/portal', '_blank', 'noopener,noreferrer')}
                className="silver-glass-pane flex w-full items-center gap-3 rounded-lg border border-black/[0.06] bg-transparent px-4 py-3 text-left transition-all duration-200 hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4A7A68]/30 dark:border-white/[0.08] dark:hover:bg-white/[0.04] dark:focus-visible:ring-[#94B8A6]/30"
              >
                <span className="shrink-0 rounded-lg bg-[#4A7A68]/[0.08] p-2 dark:bg-[#94B8A6]/[0.10]">
                  <CreditCard
                    className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                    strokeWidth={1.5}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium">
                    Manage Payment Method
                  </p>
                  <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                    Update your card, view payment details via Stripe.
                  </p>
                </div>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-zinc-400 dark:text-white/40"
                  strokeWidth={1.5}
                />
              </button>

              <button
                type="button"
                onClick={() => window.open('/api/auth/portal', '_blank', 'noopener,noreferrer')}
                className="silver-glass-pane flex w-full items-center gap-3 rounded-lg border border-black/[0.06] bg-transparent px-4 py-3 text-left transition-all duration-200 hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4A7A68]/30 dark:border-white/[0.08] dark:hover:bg-white/[0.04] dark:focus-visible:ring-[#94B8A6]/30"
              >
                <span className="shrink-0 rounded-lg bg-[#4A7A68]/[0.08] p-2 dark:bg-[#94B8A6]/[0.10]">
                  <Receipt
                    className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                    strokeWidth={1.5}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium">
                    Invoice History
                  </p>
                  <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                    View and download past invoices and receipts.
                  </p>
                </div>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-zinc-400 dark:text-white/40"
                  strokeWidth={1.5}
                />
              </button>
            </div>
          )}

          <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
            <DialogContent className="rounded-lg">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                    <ModernSubscriptionIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
                  </span>
                  <DialogTitle className="text-zinc-800 dark:text-white font-logo">
                    Team Subscription
                  </DialogTitle>
                </div>
                <DialogDescription className="text-[12px] font-logo text-zinc-400 dark:text-white/40 ml-9">
                  Set up a team workspace with collaborative features. Each seat costs $49/month and
                  gets $40 of inference credits.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <Label
                  htmlFor="seats"
                  className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white"
                >
                  Number of seats
                </Label>
                <Select
                  value={seats.toString()}
                  onValueChange={(value) => setSeats(Number.parseInt(value, 10))}
                >
                  <SelectTrigger
                    id="seats"
                    className="mt-1.5 h-9 text-[13px] font-logo focus:ring-0"
                  >
                    <SelectValue placeholder="Select number of seats" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEAT_OPTIONS.map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'seat' : 'seats'} (${num * 49}/month)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <p className="mt-2 text-[11px] font-logo text-zinc-400 dark:text-white/40">
                  Your team will have {seats} {seats === 1 ? 'seat' : 'seats'} with a total of $
                  {seats * 40} inference credits per month.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsTeamDialogOpen(false)}
                  disabled={isUpgradingTeam}
                  className="text-[12px] font-logo"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmTeamUpgrade}
                  disabled={isUpgradingTeam}
                  className="text-[12px] font-logo bg-[#4A7A68] hover:bg-[#3d6657] dark:bg-[#94B8A6] dark:hover:bg-[#7da38f] dark:text-black"
                >
                  {isUpgradingTeam ? <ButtonSkeleton /> : <span>Upgrade to Team Plan</span>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------------------
// PlanCard sub-component
// -------------------------------------------------------------------------

interface PlanCardProps {
  name: string
  description: string
  price: string
  costLimit: string
  features: string[]
  isCurrent: boolean
  stripeEnabled?: boolean
  onUpgrade?: () => void
  onDowngrade?: () => void
  isUpgrading?: boolean
  isDowngrading?: boolean
  showUpgrade?: boolean
  showUsage?: boolean
  usageData?: {
    percentUsed: number
    isWarning: boolean
    isExceeded: boolean
    currentUsage: number
    limit: number
  }
  limitData?: LimitData
  seats?: number
  costPerSeat?: number
}

const PlanCard = memo(function PlanCard({
  name,
  description,
  price,
  costLimit,
  features,
  isCurrent,
  stripeEnabled = true,
  onUpgrade,
  onDowngrade,
  isUpgrading,
  isDowngrading,
  showUpgrade,
  showUsage,
  usageData,
  limitData,
  seats,
  costPerSeat,
}: PlanCardProps) {
  const usagePercent = usageData ? Math.min(Math.max(usageData.percentUsed, 0), 100) : 0
  const workflowPercent = limitData?.workflowLimit
    ? Math.min((limitData.workflowCount / limitData.workflowLimit) * 100, 100)
    : 0
  const hasActions = (showUpgrade && !isCurrent) || (onDowngrade && isCurrent)

  return (
    <div
      className={`silver-glass-pane flex h-full flex-col rounded-lg border border-black/[0.06] bg-transparent p-4 transition-all duration-200 dark:border-white/[0.08] ${isCurrent ? 'border-[#4A7A68]/40 shadow-sm dark:border-[#94B8A6]/30' : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="min-w-0 text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
          {name}
        </h4>
        {isCurrent && (
          <span className="shrink-0 rounded-full border border-[#4A7A68]/20 bg-[#4A7A68]/[0.08] px-2 py-0.5 text-[10px] font-logo font-medium text-[#4A7A68] dark:border-[#94B8A6]/20 dark:bg-[#94B8A6]/[0.10] dark:text-[#94B8A6]">
            Current
          </span>
        )}
      </div>
      <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mt-1">{description}</p>
      <p className="text-[13px] font-logo font-medium text-zinc-800 dark:text-white mt-1">
        {price}
      </p>

      <ul className="mt-3 space-y-1.5 text-[12px] font-logo text-black/60 dark:text-white/70">
        <li>• {costLimit}</li>
        {features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>

      {/* Usage bars for current plan */}
      {showUsage && usageData && limitData && (
        <div className="mt-4 space-y-3">
          {/* Cost usage */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-logo text-zinc-400 dark:text-white/40">
              <span>Usage</span>
              <span>
                {usageData.currentUsage.toFixed(2)}$ / {usageData.limit}$
              </span>
            </div>
            <Progress
              value={usagePercent}
              className={`h-1.5 ${usageData.isExceeded ? 'bg-muted [&>*]:bg-destructive' : usageData.isWarning ? 'bg-muted [&>*]:bg-amber-500' : ''}`}
            />
          </div>
          {/* Workflow usage */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-logo text-zinc-400 dark:text-white/40">
              <span>Workflows</span>
              <span>
                {limitData.workflowCount} / {limitData.workflowLimit}
              </span>
            </div>
            <Progress value={workflowPercent} className="h-1.5" />
          </div>
          {/* Team seats */}
          {seats !== undefined && costPerSeat !== undefined && (
            <div className="flex justify-between text-[11px] font-logo text-zinc-400 dark:text-white/40">
              <span>Team Size</span>
              <span>
                {seats} {seats === 1 ? 'seat' : 'seats'} (${seats * costPerSeat}/mo)
              </span>
            </div>
          )}
        </div>
      )}

      {hasActions && (
        <div className="mt-auto flex gap-2 pt-4">
          {showUpgrade &&
            !isCurrent &&
            (stripeEnabled ? (
              <Button
                variant="default"
                size="sm"
                onClick={onUpgrade}
                disabled={isUpgrading}
                className="min-w-[92px] justify-center bg-[#4A7A68] text-[12px] font-logo hover:bg-[#3d6657] dark:bg-[#94B8A6] dark:text-black dark:hover:bg-[#7da38f]"
              >
                {isUpgrading ? <ButtonSkeleton /> : <span>Upgrade</span>}
              </Button>
            ) : (
              <div className="inline-flex h-8 items-center rounded-lg border border-dashed border-black/[0.10] px-2 text-[11px] font-logo text-zinc-400 dark:border-white/[0.10] dark:text-white/40">
                Payment unavailable
              </div>
            ))}

          {onDowngrade && isCurrent && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDowngrade}
              disabled={isDowngrading}
              className="min-w-[92px] justify-center text-[12px] font-logo"
            >
              {isDowngrading ? <ButtonSkeleton /> : <span>Downgrade</span>}
            </Button>
          )}
        </div>
      )}
    </div>
  )
})

// -------------------------------------------------------------------------
// Skeleton components
// -------------------------------------------------------------------------

function SubscriptionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="silver-glass-pane rounded-lg p-4 bg-transparent">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-5 w-24" />
              {i === 1 && <Skeleton className="h-5 w-16 rounded-full" />}
            </div>
            <Skeleton className="h-4 w-48 mb-1" />
            <Skeleton className="h-4 w-20 mb-3" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="mt-4">
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ButtonSkeleton() {
  return <Skeleton className="h-4 w-16" />
}
