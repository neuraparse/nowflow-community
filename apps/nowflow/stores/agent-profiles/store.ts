import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { safeStorage } from '@/stores/safe-storage'
import { AgentProfileDefinition, AgentProfilesStore } from './types'

const logger = createLogger('AgentProfilesStore')
const API_ENDPOINT = '/api/agent-profiles'

export const useAgentProfilesStore = create<AgentProfilesStore>()(
  devtools(
    persist(
      (set, get) => ({
        profiles: {},
        isLoading: false,
        error: null,
        selectedProfileId: null,

        loadProfiles: async () => {
          try {
            set({ isLoading: true, error: null })
            logger.info('Loading agent profiles from server')

            const response = await fetch(API_ENDPOINT)

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                logger.warn('Unauthorized access to agent profiles')
                set({ profiles: {}, isLoading: false, error: null })
                return
              }
              if (response.status === 404) {
                logger.info('Agent profiles API is not available in this build')
                set({ profiles: {}, isLoading: false, error: null })
                return
              }
              if (response.status >= 500) {
                logger.warn(`Server error loading agent profiles: ${response.statusText}`)
                set({ profiles: {}, isLoading: false, error: null })
                return
              }
              throw new Error(`Failed to load agent profiles: ${response.statusText}`)
            }

            const { profiles: profileList } = await response.json()

            if (!Array.isArray(profileList)) {
              throw new Error('Invalid response format')
            }

            const transformedProfiles = profileList.reduce(
              (acc: Record<string, AgentProfileDefinition>, profile: any) => {
                // Parse JSON fields that come as strings
                const parsed: AgentProfileDefinition = {
                  ...profile,
                  skills:
                    typeof profile.skills === 'string'
                      ? JSON.parse(profile.skills)
                      : profile.skills || [],
                  constraints:
                    typeof profile.constraints === 'string'
                      ? JSON.parse(profile.constraints)
                      : profile.constraints || [],
                  tools:
                    typeof profile.tools === 'string'
                      ? JSON.parse(profile.tools)
                      : profile.tools || [],
                  notificationChannels:
                    typeof profile.notificationChannels === 'string'
                      ? JSON.parse(profile.notificationChannels)
                      : profile.notificationChannels || [],
                  tags:
                    typeof profile.tags === 'string'
                      ? JSON.parse(profile.tags)
                      : profile.tags || [],
                  escalationRules:
                    typeof profile.escalationRules === 'string'
                      ? JSON.parse(profile.escalationRules)
                      : profile.escalationRules,
                }
                acc[profile.id] = parsed
                return acc
              },
              {}
            )

            logger.info(`Loaded ${profileList.length} agent profiles`)
            set({ profiles: transformedProfiles, isLoading: false })
          } catch (error) {
            if (isAbortLikeError(error)) {
              logger.warn('Agent profiles request was interrupted')
              set({ isLoading: false, error: null })
              return
            }

            logger.error('Error loading agent profiles:', error)
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false,
            })
          }
        },

        addProfile: async (profileData) => {
          try {
            set({ isLoading: true, error: null })

            const response = await fetch(API_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profileData),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `Failed to create profile: ${response.statusText}`)
            }

            const { profile } = await response.json()

            // Parse JSON fields
            const parsed: AgentProfileDefinition = {
              ...profile,
              skills:
                typeof profile.skills === 'string'
                  ? JSON.parse(profile.skills)
                  : profile.skills || [],
              constraints:
                typeof profile.constraints === 'string'
                  ? JSON.parse(profile.constraints)
                  : profile.constraints || [],
              tools:
                typeof profile.tools === 'string' ? JSON.parse(profile.tools) : profile.tools || [],
              notificationChannels:
                typeof profile.notificationChannels === 'string'
                  ? JSON.parse(profile.notificationChannels)
                  : profile.notificationChannels || [],
              tags:
                typeof profile.tags === 'string' ? JSON.parse(profile.tags) : profile.tags || [],
            }

            set((state) => ({
              profiles: { ...state.profiles, [profile.id]: parsed },
              isLoading: false,
            }))

            return profile.id
          } catch (error) {
            logger.error('Error creating agent profile:', error)
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false,
            })
            return null
          }
        },

        updateProfile: async (id, updates) => {
          try {
            set({ isLoading: true, error: null })

            const response = await fetch(`${API_ENDPOINT}/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            })

            if (!response.ok) {
              throw new Error(`Failed to update profile: ${response.statusText}`)
            }

            const { profile } = await response.json()

            const parsed: AgentProfileDefinition = {
              ...profile,
              skills:
                typeof profile.skills === 'string'
                  ? JSON.parse(profile.skills)
                  : profile.skills || [],
              constraints:
                typeof profile.constraints === 'string'
                  ? JSON.parse(profile.constraints)
                  : profile.constraints || [],
              tools:
                typeof profile.tools === 'string' ? JSON.parse(profile.tools) : profile.tools || [],
              notificationChannels:
                typeof profile.notificationChannels === 'string'
                  ? JSON.parse(profile.notificationChannels)
                  : profile.notificationChannels || [],
              tags:
                typeof profile.tags === 'string' ? JSON.parse(profile.tags) : profile.tags || [],
            }

            set((state) => ({
              profiles: { ...state.profiles, [id]: parsed },
              isLoading: false,
            }))

            return true
          } catch (error) {
            logger.error('Error updating agent profile:', error)
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false,
            })
            return false
          }
        },

        deleteProfile: async (id) => {
          try {
            const response = await fetch(`${API_ENDPOINT}/${id}`, {
              method: 'DELETE',
            })

            if (!response.ok) {
              throw new Error(`Failed to delete profile: ${response.statusText}`)
            }

            set((state) => {
              const newProfiles = { ...state.profiles }
              delete newProfiles[id]
              return { profiles: newProfiles }
            })

            return true
          } catch (error) {
            logger.error('Error deleting agent profile:', error)
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            return false
          }
        },

        getProfile: (id) => {
          return get().profiles[id]
        },

        getAllProfiles: () => {
          return Object.values(get().profiles)
        },

        getProfilesByType: (type) => {
          return Object.values(get().profiles).filter((p) => p.type === type)
        },

        clearProfiles: () => {
          set({ profiles: {}, selectedProfileId: null, error: null, isLoading: false })
        },

        setSelectedProfile: (id) => {
          set({ selectedProfileId: id })
        },
      }),
      {
        name: 'agent-profiles-store',
        storage: safeStorage,
        partialize: () => ({
          profiles: {},
          isLoading: false,
          error: null,
          selectedProfileId: null,
        }),
        onRehydrateStorage: () => {
          return (state) => {
            state?.clearProfiles()
            logger.debug('Agent profiles store rehydrated from localStorage')
          }
        },
      }
    )
  )
)
