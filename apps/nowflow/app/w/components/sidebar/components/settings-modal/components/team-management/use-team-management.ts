import { useCallback, useEffect, useState } from 'react'
import { client, useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { useSubscription } from '@/hooks/use-subscription'
import { generateSlug } from './utils'

const logger = createLogger('TeamManagement')

export interface RemoveMemberDialogState {
  open: boolean
  memberId: string
  memberName: string
  shouldReduceSeats: boolean
}

export function useTeamManagement() {
  const { data: session } = useSession()
  const { data: activeOrg } = client.useActiveOrganization()

  // Use shared subscription hook (cached)
  const { isPro, plan, loading: subLoading } = useSubscription()
  const hasTeamPlan = plan?.name === 'team'

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false)
  const [removeMemberDialog, setRemoveMemberDialog] = useState<RemoveMemberDialogState>({
    open: false,
    memberId: '',
    memberName: '',
    shouldReduceSeats: false,
  })
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('members')
  const [activeOrganization, setActiveOrganization] = useState<any>(null)
  const [subscriptionData, setSubscriptionData] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('member')
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false)

  // Load organization's subscription data
  const loadOrganizationSubscription = async (orgId: string) => {
    try {
      setIsLoadingSubscription(true)
      logger.info('Loading subscription for organization', { orgId })

      const { data, error } = await client.subscription.list({
        query: { referenceId: orgId },
      })

      if (error) {
        logger.error('Error fetching organization subscription', { error })
        setError('Failed to load subscription data')
      } else {
        logger.info('Organization subscription data loaded', {
          subscriptions: data?.map((s) => ({
            id: s.id,
            plan: s.plan,
            status: s.status,
            seats: s.seats,
            referenceId: s.referenceId,
          })),
        })

        // Filter to only active team subscription
        const teamSubscription = data?.find((sub) => sub.status === 'active' && sub.plan === 'team')

        if (teamSubscription) {
          logger.info('Found active team subscription', {
            id: teamSubscription.id,
            seats: teamSubscription.seats,
          })
          setSubscriptionData([teamSubscription])
        } else {
          logger.warn('No active team subscription found for organization', {
            orgId,
          })
          setSubscriptionData([])
        }
      }
    } catch (err: any) {
      logger.error('Error loading subscription data', { error: err })
      setError(err.message || 'Failed to load subscription data')
    } finally {
      setIsLoadingSubscription(false)
    }
  }

  const loadData = useCallback(async () => {
    if (!session?.user) return

    try {
      setIsLoading(true)
      setError(null)

      // Get all organizations the user is a member of
      const orgsResponse = await client.organization.list()
      setOrganizations(orgsResponse.data || [])

      // If user has team plan but no organizations, prompt to create one
      if (hasTeamPlan && (!orgsResponse.data || orgsResponse.data.length === 0)) {
        setOrgName(`${session.user.name || 'My'}'s Team`)
        setOrgSlug(generateSlug(`${session.user.name || 'My'}'s Team`))
        setCreateOrgDialogOpen(true)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
      logger.error('Failed to load data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user])

  // Update local state when the active organization changes
  useEffect(() => {
    if (activeOrg) {
      setActiveOrganization(activeOrg)

      // Determine the user's role in this organization
      if (session?.user?.email && activeOrg.members) {
        const currentMember = activeOrg.members.find(
          (m: any) => m.user?.email === session.user?.email
        )

        if (currentMember) {
          setUserRole(currentMember.role)
          setIsAdminOrOwner(currentMember.role === 'owner' || currentMember.role === 'admin')
          logger.info('User role in organization', {
            role: currentMember.role,
            isAdminOrOwner: currentMember.role === 'owner' || currentMember.role === 'admin',
          })
        }
      }

      // Load subscription data for the organization
      if (activeOrg.id) {
        loadOrganizationSubscription(activeOrg.id)
      }
    }
  }, [activeOrg, session?.user?.email])

  // Initial data loading
  useEffect(() => {
    loadData()
  }, [loadData])

  // Refresh organization data
  const refreshOrganization = useCallback(async () => {
    if (!activeOrganization?.id) return

    try {
      const fullOrgResponse = await client.organization.getFullOrganization()
      setActiveOrganization(fullOrgResponse.data)

      // Also refresh subscription data when organization is refreshed
      if (fullOrgResponse.data?.id) {
        await loadOrganizationSubscription(fullOrgResponse.data.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh organization data')
    }
  }, [activeOrganization?.id])

  // Handle seat reduction - remove members when seats are reduced
  const handleReduceSeats = async () => {
    if (!session?.user || !activeOrganization || !subscriptionData || subscriptionData.length === 0)
      return

    const currentSeats = subscriptionData[0]?.seats || 0
    if (currentSeats <= 1) {
      setError('Cannot reduce seats below 1')
      return
    }

    // Calculate current usage
    const currentMemberCount = activeOrganization.members?.length || 0
    const pendingInvitationCount =
      activeOrganization.invitations?.filter((inv: any) => inv.status === 'pending').length || 0
    const totalCount = currentMemberCount + pendingInvitationCount

    // Check if we need to remove members before reducing seats
    if (totalCount >= currentSeats) {
      setError(
        `You have ${totalCount} active members/invitations. Please remove members or cancel invitations before reducing seats.`
      )
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Reduce the seats by 1
      const newSeatCount = currentSeats - 1

      // Upgrade with reduced seat count
      const { error } = await client.subscription.upgrade({
        plan: 'team',
        referenceId: activeOrganization.id,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
        seats: newSeatCount,
      })

      if (error) {
        setError(error.message || 'Failed to update seat count')
      } else {
        await refreshOrganization()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reduce seats')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle organization name change
  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setOrgName(newName)
    setOrgSlug(generateSlug(newName))
  }

  // Create a new organization
  const handleCreateOrganization = async () => {
    if (!session?.user) return

    try {
      setIsCreatingOrg(true)
      setError(null)

      logger.info('Creating team organization', { name: orgName, slug: orgSlug })

      // Create the organization using Better Auth API
      const result = await client.organization.create({
        name: orgName,
        slug: orgSlug,
      })

      if (!result.data?.id) {
        throw new Error('Failed to create organization')
      }

      const orgId = result.data.id
      logger.info('Organization created', { orgId })

      // Set the new organization as active
      logger.info('Setting organization as active', { orgId })
      await client.organization.setActive({
        organizationId: orgId,
      })

      // If the user has a team subscription, update the subscription reference
      if (hasTeamPlan) {
        const userSubResponse = await client.subscription.list()
        const teamSubscription = userSubResponse.data?.find(
          (sub) => sub.plan === 'team' && sub.status === 'active'
        )

        if (teamSubscription) {
          logger.info('Found user team subscription to transfer', {
            subscriptionId: teamSubscription.id,
            seats: teamSubscription.seats,
            targetOrgId: orgId,
          })

          // Use a custom API endpoint to transfer the subscription without going to Stripe
          const transferResponse = await fetch('/api/user/transfer-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscriptionId: teamSubscription.id,
              organizationId: orgId,
            }),
          })

          if (!transferResponse.ok) {
            const errorData = await transferResponse.json()
            throw new Error(errorData.error || 'Failed to transfer subscription to organization')
          }

          logger.info('Successfully transferred subscription to organization')
        }
      }

      // Refresh the organization list
      await loadData()

      // Close the dialog
      setCreateOrgDialogOpen(false)
      setOrgName('')
      setOrgSlug('')
    } catch (err: any) {
      logger.error('Failed to create organization', { error: err })
      setError(err.message || 'Failed to create organization')
    } finally {
      setIsCreatingOrg(false)
    }
  }

  // Upgrade to team subscription with organization as reference
  const confirmTeamUpgrade = async (seats: number) => {
    if (!session?.user || !activeOrganization) return

    try {
      setIsLoading(true)
      setError(null)

      const { error } = await client.subscription.upgrade({
        plan: 'team',
        referenceId: activeOrganization.id,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
        seats: seats,
      })

      if (error) {
        setError(error.message || 'Failed to upgrade to team subscription')
      } else {
        await refreshOrganization()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upgrade to team subscription')
    } finally {
      setIsLoading(false)
    }
  }

  // Set an organization as active
  const handleSetActiveOrg = async (orgId: string) => {
    if (!session?.user) return

    try {
      setIsLoading(true)

      await client.organization.setActive({
        organizationId: orgId,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to set active organization')
    } finally {
      setIsLoading(false)
    }
  }

  // Invite a member to the organization
  const handleInviteMember = async () => {
    if (!session?.user || !activeOrganization) return

    try {
      setIsInviting(true)
      setError(null)
      setInviteSuccess(false)

      // Check seat limit
      const currentMemberCount = activeOrganization.members?.length || 0
      const pendingInvitationCount =
        activeOrganization.invitations?.filter((inv: any) => inv.status === 'pending').length || 0
      const totalCount = currentMemberCount + pendingInvitationCount

      const teamSubscription = subscriptionData?.[0]
      const seatLimit = teamSubscription?.seats || 0

      logger.info('Checking seat availability for invitation', {
        currentMembers: currentMemberCount,
        pendingInvites: pendingInvitationCount,
        totalUsed: totalCount,
        seatLimit: seatLimit,
        subscriptionId: teamSubscription?.id,
      })

      if (totalCount >= seatLimit) {
        const error = `You've reached your team seat limit of ${seatLimit}. Please upgrade your plan for more seats.`
        logger.warn('Invitation failed - seat limit reached', {
          totalCount,
          seatLimit,
        })
        setError(error)
        return
      }

      if (!inviteEmail || !inviteEmail.includes('@')) {
        setError('Please enter a valid email address')
        return
      }

      logger.info('Sending invitation to member', {
        email: inviteEmail,
        organizationId: activeOrganization.id,
      })

      const inviteResult = await client.organization.inviteMember({
        email: inviteEmail,
        role: 'member',
        organizationId: activeOrganization.id,
      })

      if (inviteResult.error) {
        throw new Error(inviteResult.error.message || 'Failed to send invitation')
      }

      logger.info('Invitation sent successfully')

      setInviteEmail('')
      setInviteSuccess(true)

      await refreshOrganization()
    } catch (err: any) {
      logger.error('Error inviting member', { error: err })
      setError(err.message || 'Failed to invite member')
    } finally {
      setIsInviting(false)
    }
  }

  // Remove a member from the organization
  const handleRemoveMember = async (member: any) => {
    if (!session?.user || !activeOrganization) return

    setRemoveMemberDialog({
      open: true,
      memberId: member.id,
      memberName: member.user?.name || member.user?.email || 'this member',
      shouldReduceSeats: false,
    })
  }

  // Actual member removal after confirmation
  const confirmRemoveMember = async (shouldReduceSeats: boolean = false) => {
    const { memberId } = removeMemberDialog
    if (!session?.user || !activeOrganization || !memberId) return

    try {
      setIsLoading(true)

      await client.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: activeOrganization.id,
      })

      if (shouldReduceSeats && subscriptionData && subscriptionData.length > 0) {
        const currentSeats = subscriptionData[0]?.seats || 0

        if (currentSeats > 1) {
          await client.subscription.upgrade({
            plan: 'team',
            referenceId: activeOrganization.id,
            successUrl: window.location.href,
            cancelUrl: window.location.href,
            seats: currentSeats - 1,
          })
        }
      }

      await refreshOrganization()

      setRemoveMemberDialog({ open: false, memberId: '', memberName: '', shouldReduceSeats: false })
    } catch (err: any) {
      setError(err.message || 'Failed to remove member')
    } finally {
      setIsLoading(false)
    }
  }

  // Cancel an invitation
  const handleCancelInvitation = async (invitationId: string) => {
    if (!session?.user || !activeOrganization) return

    try {
      setIsLoading(true)

      await client.organization.cancelInvitation({
        invitationId,
      })

      await refreshOrganization()
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invitation')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    // State
    session,
    isLoading,
    error,
    setError,
    organizations,
    inviteEmail,
    setInviteEmail,
    isInviting,
    isCreatingOrg,
    createOrgDialogOpen,
    setCreateOrgDialogOpen,
    removeMemberDialog,
    setRemoveMemberDialog,
    orgName,
    orgSlug,
    setOrgSlug,
    inviteSuccess,
    activeTab,
    setActiveTab,
    activeOrganization,
    subscriptionData,
    userRole,
    isAdminOrOwner,
    isLoadingSubscription,
    hasTeamPlan,

    // Handlers
    handleOrgNameChange,
    handleCreateOrganization,
    confirmTeamUpgrade,
    handleSetActiveOrg,
    handleInviteMember,
    handleRemoveMember,
    confirmRemoveMember,
    handleCancelInvitation,
    handleReduceSeats,
  }
}
