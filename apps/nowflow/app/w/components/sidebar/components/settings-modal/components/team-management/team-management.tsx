import { Building } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreateOrgDialog } from './create-org-dialog'
import { MembersTab } from './members-tab'
import { RemoveMemberDialog } from './remove-member-dialog'
import { SettingsTab } from './settings-tab'
import { TeamManagementSkeleton } from './skeletons'
import { useTeamManagement } from './use-team-management'

export function TeamManagement() {
  const tm = useTeamManagement()

  if (tm.isLoading && !tm.activeOrganization && !tm.hasTeamPlan) {
    return <TeamManagementSkeleton />
  }

  // No organization yet - show creation UI
  if (!tm.activeOrganization) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center space-y-4">
          <h3 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
            {tm.hasTeamPlan ? 'Create Your Team Workspace' : 'No Team Workspace'}
          </h3>
          <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
            {tm.hasTeamPlan
              ? "You're subscribed to a team plan. Create your workspace to start collaborating with your team."
              : "You don't have a team workspace yet. Create one to start collaborating with your team."}
          </p>

          <Button onClick={() => tm.setCreateOrgDialogOpen(true)}>
            <Building className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Create Team Workspace
          </Button>
        </div>

        <CreateOrgDialog
          open={tm.createOrgDialogOpen}
          onOpenChange={tm.setCreateOrgDialogOpen}
          orgName={tm.orgName}
          orgSlug={tm.orgSlug}
          onOrgNameChange={tm.handleOrgNameChange}
          onOrgSlugChange={tm.setOrgSlug}
          onSubmit={tm.handleCreateOrganization}
          isCreating={tm.isCreatingOrg}
          error={tm.error}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
          Team Management
        </h3>

        {tm.organizations.length > 1 && (
          <div className="flex items-center space-x-2">
            <select
              className="silver-glass-pane smoky-glass-pane glass-field glass-native-select rounded-lg border-0 bg-transparent px-3 py-2 text-[12px] font-logo text-zinc-800 dark:text-white/88"
              value={tm.activeOrganization.id}
              onChange={(e) => tm.handleSetActiveOrg(e.target.value)}
            >
              {tm.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tm.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{tm.error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tm.activeTab} onValueChange={tm.setActiveTab}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <MembersTab
            isAdminOrOwner={tm.isAdminOrOwner}
            inviteEmail={tm.inviteEmail}
            setInviteEmail={tm.setInviteEmail}
            isInviting={tm.isInviting}
            onInviteMember={tm.handleInviteMember}
            inviteSuccess={tm.inviteSuccess}
            isLoadingSubscription={tm.isLoadingSubscription}
            subscriptionData={tm.subscriptionData}
            activeOrganization={tm.activeOrganization}
            isLoading={tm.isLoading}
            onReduceSeats={tm.handleReduceSeats}
            onAddSeat={() => {
              const currentSeats = tm.subscriptionData[0]?.seats || 1
              tm.confirmTeamUpgrade(currentSeats + 1)
            }}
            onSetupSubscription={() => {
              tm.setError(null)
              tm.confirmTeamUpgrade(2)
            }}
            onRemoveMember={tm.handleRemoveMember}
            onCancelInvitation={tm.handleCancelInvitation}
            session={tm.session}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab
            activeOrganization={tm.activeOrganization}
            isAdminOrOwner={tm.isAdminOrOwner}
            isLoadingSubscription={tm.isLoadingSubscription}
            subscriptionData={tm.subscriptionData}
            userRole={tm.userRole}
          />
        </TabsContent>
      </Tabs>

      {/* Member removal confirmation dialog */}
      <RemoveMemberDialog
        state={tm.removeMemberDialog}
        onStateChange={tm.setRemoveMemberDialog}
        onConfirm={tm.confirmRemoveMember}
      />
    </div>
  )
}
