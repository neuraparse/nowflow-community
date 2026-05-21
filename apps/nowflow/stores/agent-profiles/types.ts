export type AgentProfileType = 'ai_agent' | 'human_agent' | 'hybrid'

export interface AgentProfileDefinition {
  id: string
  userId: string
  workspaceId?: string | null
  name: string
  avatar?: string | null
  description?: string | null
  type: AgentProfileType

  // Persona & Identity
  role?: string | null
  goal?: string | null
  personality?: string | null
  systemPrompt?: string | null
  communicationStyle?: string | null

  // Skills & Constraints
  skills: string[]
  constraints: string[]
  tools: any[]

  // Human Agent configuration
  linkedUserId?: string | null
  notificationChannels: string[]
  responseTimeoutMinutes?: number | null
  escalationRules?: any

  // Sharing & Marketplace
  isPublic: boolean
  tags: string[]
  category?: string | null
  rating?: string
  ratingCount: number
  usageCount: number
  version: number
  parentProfileId?: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentProfilesStore {
  profiles: Record<string, AgentProfileDefinition>
  isLoading: boolean
  error: string | null
  selectedProfileId: string | null

  // CRUD
  loadProfiles: () => Promise<void>
  addProfile: (
    profile: Omit<
      AgentProfileDefinition,
      | 'id'
      | 'userId'
      | 'createdAt'
      | 'updatedAt'
      | 'rating'
      | 'ratingCount'
      | 'usageCount'
      | 'version'
    >
  ) => Promise<string | null>
  updateProfile: (id: string, updates: Partial<AgentProfileDefinition>) => Promise<boolean>
  deleteProfile: (id: string) => Promise<boolean>
  getProfile: (id: string) => AgentProfileDefinition | undefined
  getAllProfiles: () => AgentProfileDefinition[]
  getProfilesByType: (type: AgentProfileType) => AgentProfileDefinition[]
  clearProfiles: () => void

  // Selection
  setSelectedProfile: (id: string | null) => void
}
