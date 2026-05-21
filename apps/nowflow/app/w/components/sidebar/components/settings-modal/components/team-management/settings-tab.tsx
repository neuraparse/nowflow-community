import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TeamSeatsSkeleton } from './skeletons'

interface SettingsTabProps {
  activeOrganization: any
  isAdminOrOwner: boolean
  isLoadingSubscription: boolean
  subscriptionData: any
  userRole: string
}

export function SettingsTab({
  activeOrganization,
  isAdminOrOwner,
  isLoadingSubscription,
  subscriptionData,
  userRole,
}: SettingsTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent p-4 space-y-4 dark:border-white/[0.08]">
        <div>
          <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white mb-2">
            Team Workspace Name
          </h4>
          <div className="font-medium">{activeOrganization.name}</div>
        </div>

        <div>
          <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white mb-2">
            URL Slug
          </h4>
          <div className="flex items-center space-x-2">
            <code className="silver-glass-chip px-2 py-1 rounded-lg text-[12px] font-logo border-black/[0.06] dark:border-white/[0.08]">
              {activeOrganization.slug}
            </code>
            <Button variant="ghost" size="sm">
              <Copy className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        <div>
          <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white mb-2">
            Created On
          </h4>
          <div className="text-[12px] font-logo">
            {new Date(activeOrganization.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Only show subscription details to admins/owners */}
        {isAdminOrOwner && (
          <div>
            <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white mb-2">
              Subscription Status
            </h4>
            {isLoadingSubscription ? (
              <TeamSeatsSkeleton />
            ) : subscriptionData ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      subscriptionData.status === 'active'
                        ? 'bg-green-500'
                        : subscriptionData.status === 'trialing'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                  ></div>
                  <span className="capitalize font-medium">
                    {subscriptionData.status}
                    {subscriptionData.cancelAtPeriodEnd ? ' (Cancels at period end)' : ''}
                  </span>
                </div>
                <div className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                  <div>Team seats: {subscriptionData.seats}</div>
                  {subscriptionData.periodEnd && (
                    <div>
                      Next billing date: {new Date(subscriptionData.periodEnd).toLocaleDateString()}
                    </div>
                  )}
                  {subscriptionData.trialEnd && (
                    <div>
                      Trial ends: {new Date(subscriptionData.trialEnd).toLocaleDateString()}
                    </div>
                  )}
                  <div className="mt-2 text-[11px] font-logo">
                    This subscription is associated with this team workspace.
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                No active subscription found
              </div>
            )}
          </div>
        )}

        {!isAdminOrOwner && (
          <div>
            <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white mb-2">
              Your Role
            </h4>
            <div className="text-[12px] font-logo">
              You are a <span className="capitalize font-medium">{userRole}</span> of this
              workspace.
              {userRole === 'member' && (
                <p className="mt-2 text-[11px] font-logo text-zinc-400 dark:text-white/40">
                  Contact a workspace manager or owner for subscription changes or to invite new
                  members.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
