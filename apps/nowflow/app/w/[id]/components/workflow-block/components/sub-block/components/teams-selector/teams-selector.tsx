'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createLogger } from '@/lib/logs/console-logger'
import { Credential, getProviderIdFromServiceId, getServiceIdFromScopes } from '@/lib/oauth'

const logger = createLogger('TeamsSelector')

export interface TeamInfo {
  id: string
  displayName: string
  description?: string
  webUrl?: string
  createdDateTime?: string
}

interface TeamsSelectorProps {
  value: string
  onChange: (value: string, teamInfo?: TeamInfo) => void
  provider: string
  requiredScopes?: string[]
  serviceId?: string
  label?: string
  disabled?: boolean
  onTeamInfoChange?: (info: TeamInfo | null) => void
}

export function TeamsSelector({
  value,
  onChange,
  provider,
  requiredScopes = [],
  serviceId,
  label = 'Select team',
  disabled = false,
  onTeamInfoChange,
}: TeamsSelectorProps) {
  const [open, setOpen] = useState(false)
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('')
  const [selectedTeam, setSelectedTeam] = useState<TeamInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine the appropriate service ID based on provider and scopes
  const getServiceId = (): string => {
    if (serviceId) return serviceId
    return getServiceIdFromScopes(provider, requiredScopes)
  }

  // Determine the appropriate provider ID based on service and scopes
  const getProviderId = (): string => {
    const effectiveServiceId = getServiceId()
    return getProviderIdFromServiceId(effectiveServiceId)
  }

  // Fetch available credentials for this provider
  const fetchCredentials = useCallback(async () => {
    setIsLoading(true)
    try {
      const providerId = getProviderId()
      const response = await fetch(`/api/auth/oauth/credentials?provider=${providerId}`)

      if (response.ok) {
        const data = await response.json()
        setCredentials(data.credentials)

        // Auto-select the first credential if available
        if (data.credentials.length > 0 && !selectedCredentialId) {
          setSelectedCredentialId(data.credentials[0].id)
        }
      } else {
        logger.error('Failed to fetch credentials:', response.statusText)
        setError('Failed to fetch credentials')
      }
    } catch (error) {
      logger.error('Error fetching credentials:', error)
      setError('Error fetching credentials')
    } finally {
      setIsLoading(false)
    }
  }, [getProviderId, selectedCredentialId])

  // Fetch teams from Microsoft Graph API
  const fetchTeams = useCallback(async () => {
    if (!selectedCredentialId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/teams/list?credentialId=${selectedCredentialId}`)

      if (response.ok) {
        const data = await response.json()
        setTeams(data.teams || [])

        // If we have a selected team ID, find the team info
        if (value) {
          const teamInfo = data.teams?.find((team: TeamInfo) => team.id === value)
          if (teamInfo) {
            setSelectedTeam(teamInfo)
            onTeamInfoChange?.(teamInfo)
          }
        }
      } else {
        logger.error('Failed to fetch teams:', response.statusText)
        setError('Failed to fetch teams')
        setTeams([])
      }
    } catch (error) {
      logger.error('Error fetching teams:', error)
      setError('Error fetching teams')
      setTeams([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedCredentialId, value, onTeamInfoChange])

  // Fetch credentials on initial mount
  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

  // Fetch teams when credential is selected
  useEffect(() => {
    if (selectedCredentialId) {
      fetchTeams()
    }
  }, [selectedCredentialId, fetchTeams])

  // Handle team selection
  const handleTeamSelect = (teamId: string) => {
    const teamInfo = teams.find((team) => team.id === teamId)
    setSelectedTeam(teamInfo || null)
    onChange(teamId, teamInfo)
    onTeamInfoChange?.(teamInfo || null)
    setOpen(false)
  }

  // Handle open change
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)

    // Refresh teams when opening
    if (isOpen && selectedCredentialId) {
      fetchTeams()
    }
  }

  return (
    <div className="space-y-2">
      {/* Credential selector if multiple credentials */}
      {credentials.length > 1 && (
        <div className="text-xs text-muted-foreground">
          <select
            value={selectedCredentialId}
            onChange={(e) => setSelectedCredentialId(e.target.value)}
            className="w-full p-1 border rounded text-xs"
          >
            {credentials.map((cred) => (
              <option key={cred.id} value={cred.id}>
                {cred.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Teams selector */}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || !selectedCredentialId}
          >
            <div className="flex items-center gap-2 max-w-[calc(100%-20px)] overflow-hidden">
              <Users className="h-4 w-4 text-muted-foreground" />
              {selectedTeam ? (
                <span className="font-normal truncate">{selectedTeam.displayName}</span>
              ) : (
                <span className="text-muted-foreground truncate">{label}</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[300px]" align="start">
          <Command>
            <CommandInput placeholder="Search teams..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Loading teams...</span>
                  </div>
                ) : error ? (
                  <div className="p-4 text-center text-destructive">
                    <p className="text-sm font-medium">Error loading teams</p>
                    <p className="text-xs">{error}</p>
                  </div>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm font-medium">No teams found</p>
                    <p className="text-xs text-muted-foreground">
                      Make sure you have access to Microsoft Teams.
                    </p>
                  </div>
                )}
              </CommandEmpty>
              {teams.length > 0 && (
                <CommandGroup>
                  {teams.map((team) => (
                    <CommandItem
                      key={team.id}
                      value={team.displayName}
                      onSelect={() => handleTeamSelect(team.id)}
                      className="flex items-center gap-2"
                    >
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{team.displayName}</div>
                        {team.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {team.description}
                          </div>
                        )}
                      </div>
                      {team.id === value && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
