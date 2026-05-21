// ─── Shared Copilot Types ────────────────────────────────────────────────────

export type CopilotMood =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'curious'
  | 'excited'
  | 'sleepy'
  | 'surprised'
  | 'wink'
  | 'confident'
  | 'focused'
  | 'playful'
  | 'love'
  | 'confused'
  | 'proud'
  | 'mischievous'

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  context?: string
  actionSummary?: ActionSummary
}

export interface ActionSummary {
  added?: string[]
  inserted?: string[]
  removed?: number
  configured?: number
  connections?: number
  repositioned?: number
}

export interface WorkflowContext {
  blocks: Record<string, any>
  edges: any[]
  subBlockValues?: Record<string, Record<string, any>>
  validationErrors?: Record<string, { field: string; message: string; suggestion?: string }[]>
  validationWarnings?: Record<string, { field: string; message: string; suggestion?: string }[]>
}

export interface CopilotConversation {
  id: string
  title: string | null
  context: string
  workspaceId: string | null
  workflowId: string | null
  updatedAt: string
}

export interface CopilotContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  messages: CopilotMessage[]
  sendMessage: (content: string) => Promise<void>
  isLoading: boolean
  currentContext: string
  clearMessages: () => void
  setWorkflowContext: (ctx: WorkflowContext | null) => void
  // Conversation management
  activeConversation: CopilotConversation | null
  conversations: CopilotConversation[]
  isLoadingConversation: boolean
  startNewConversation: () => Promise<void>
  switchConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
}
