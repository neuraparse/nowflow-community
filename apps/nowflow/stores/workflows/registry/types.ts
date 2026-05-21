export interface MarketplaceData {
  id: string // Marketplace entry ID to track original marketplace source
  status: 'owner' | 'temp'
}

export interface WorkflowMetadata {
  id: string
  name: string
  lastModified: Date
  description?: string
  color: string
  icon?: string // Workflow icon ID
  marketplaceData?: MarketplaceData | null
  workspaceId?: string
  isShared?: boolean
  isDeployed?: boolean
  role?: 'owner' | 'editor' | 'viewer' // User's role in the workflow
  lastFetchedAt?: number // Timestamp when this workflow was last fetched from DB
  state?: any // Cached workflow state from DB
}

export interface WorkflowRegistryState {
  workflows: Record<string, WorkflowMetadata>
  activeWorkflowId: string | null
  activeWorkspaceId: string | null
  creatingWorkflowIds: Record<string, number>
  pendingCreationIds: Record<string, number>
  pendingDeletionIds: Record<string, number>
  isLoading: boolean
  isLoadingWorkflow: boolean // Loading state for switching workflows
  error: string | null
}

export interface WorkflowRegistryActions {
  setLoading: (loading: boolean) => void
  setLoadingWorkflow: (loading: boolean) => void
  setActiveWorkflow: (id: string) => Promise<void>
  setActiveWorkspace: (id: string) => void
  handleWorkspaceDeletion: (newWorkspaceId: string) => void
  removeWorkflow: (id: string) => void
  updateWorkflow: (id: string, metadata: Partial<WorkflowMetadata>) => void
  createWorkflow: (options?: {
    isInitial?: boolean
    marketplaceId?: string
    marketplaceState?: any
    name?: string
    description?: string
    workspaceId?: string
  }) => Promise<string | null>
  duplicateWorkflow: (sourceId: string) => Promise<string | null>
}

export type WorkflowRegistry = WorkflowRegistryState & WorkflowRegistryActions
