import { PlusCircle, UserX, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { getInvitationStatus } from './invitation-status'
import { ButtonSkeleton, TeamSeatsSkeleton } from './skeletons'

interface MembersTabProps {
  isAdminOrOwner: boolean
  inviteEmail: string
  setInviteEmail: (email: string) => void
  isInviting: boolean
  onInviteMember: () => void
  inviteSuccess: boolean
  isLoadingSubscription: boolean
  subscriptionData: any
  activeOrganization: any
  isLoading: boolean
  onReduceSeats: () => void
  onAddSeat: () => void
  onSetupSubscription: () => void
  onRemoveMember: (member: any) => void
  onCancelInvitation: (invitationId: string) => void
  session: any
}

export function MembersTab({
  isAdminOrOwner,
  inviteEmail,
  setInviteEmail,
  isInviting,
  onInviteMember,
  inviteSuccess,
  isLoadingSubscription,
  subscriptionData,
  activeOrganization,
  isLoading,
  onReduceSeats,
  onAddSeat,
  onSetupSubscription,
  onRemoveMember,
  onCancelInvitation,
  session,
}: MembersTabProps) {
  return (
    <div className="space-y-4 mt-4">
      {isAdminOrOwner && (
        <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent p-4 dark:border-white/[0.08]">
          <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white mb-4">
            Invite Team Members
          </h4>

          <div className="flex items-center space-x-2">
            <Input
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={isInviting}
            />
            <Button onClick={onInviteMember} disabled={!inviteEmail || isInviting}>
              {isInviting ? (
                <ButtonSkeleton />
              ) : (
                <PlusCircle className="w-4 h-4 mr-2" strokeWidth={1.5} />
              )}
              <span>Invite</span>
            </Button>
          </div>

          {inviteSuccess && (
            <p className="text-[12px] font-logo text-green-500 mt-2">
              Invitation sent successfully
            </p>
          )}
        </div>
      )}

      {/* Team Seats Usage - only show to admins/owners */}
      {isAdminOrOwner && (
        <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent p-4 dark:border-white/[0.08]">
          <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white mb-2">
            Team Seats
          </h4>

          {isLoadingSubscription ? (
            <TeamSeatsSkeleton />
          ) : subscriptionData && subscriptionData.length > 0 ? (
            <>
              <div className="flex justify-between text-[12px] font-logo mb-2">
                <span>Used</span>
                <span>
                  {(activeOrganization.members?.length || 0) +
                    (activeOrganization.invitations?.filter((inv: any) => inv.status === 'pending')
                      .length || 0)}
                  /{subscriptionData[0]?.seats || 0}
                </span>
              </div>
              <Progress
                value={
                  (((activeOrganization.members?.length || 0) +
                    (activeOrganization.invitations?.filter((inv: any) => inv.status === 'pending')
                      .length || 0)) /
                    (subscriptionData[0]?.seats || 1)) *
                  100
                }
                className="h-2"
              />

              <div className="mt-4 flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReduceSeats}
                  disabled={(subscriptionData[0]?.seats || 0) <= 1 || isLoading}
                >
                  Remove Seat
                </Button>
                <Button variant="outline" size="sm" onClick={onAddSeat} disabled={isLoading}>
                  Add Seat
                </Button>
              </div>
            </>
          ) : (
            <div className="text-[12px] font-logo text-zinc-400 dark:text-white/40 space-y-2">
              <p>No active team subscription found for this organization.</p>
              <p>
                This might happen if your subscription was created for your personal account but
                hasn't been properly transferred to the organization.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onSetupSubscription}
                disabled={isLoading}
              >
                Set Up Team Subscription
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Team Members - show to all users */}
      <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent dark:border-white/[0.08]">
        <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white p-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          Team Members
        </h4>

        {activeOrganization.members?.length === 0 ? (
          <div className="p-4 text-[12px] font-logo text-zinc-400 dark:text-white/40">
            No members in this organization yet.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {activeOrganization.members?.map((member: any) => (
              <div key={member.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{member.user?.name || 'Unknown'}</div>
                  <div className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                    {member.user?.email}
                  </div>
                  <div className="text-[11px] font-logo mt-1 bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] text-[#4A7A68] dark:text-[#94B8A6] px-2 py-0.5 rounded-lg inline-block">
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </div>
                </div>

                {/* Only show remove button for non-owners and if current user is admin/owner */}
                {isAdminOrOwner &&
                  member.role !== 'owner' &&
                  member.user?.email !== session?.user?.email && (
                    <Button variant="outline" size="sm" onClick={() => onRemoveMember(member)}>
                      <UserX className="w-4 h-4" strokeWidth={1.5} />
                    </Button>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations - only show to admins/owners */}
      {isAdminOrOwner && activeOrganization.invitations?.length > 0 && (
        <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent dark:border-white/[0.08]">
          <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white p-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            Pending Invitations
          </h4>

          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {activeOrganization.invitations?.map((invitation: any) => (
              <div key={invitation.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{invitation.email}</div>
                  <div className="text-[11px] font-logo mt-1">
                    {getInvitationStatus(invitation.status)}
                  </div>
                </div>

                {invitation.status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCancelInvitation(invitation.id)}
                  >
                    <XCircle className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
