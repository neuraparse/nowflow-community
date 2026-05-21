export type HITLRequestType = 'approval' | 'input' | 'review' | 'escalation'
export type HITLRequestStatus = 'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled'
export type HITLPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface CreateHITLRequestOptions {
  workflowId: string
  executionId: string
  blockId: string
  requestType: HITLRequestType
  title: string
  description?: string
  data?: any
  options?: any[]
  assignedTo?: string
  assignedToEmail?: string
  timeoutMinutes?: number
  priority?: HITLPriority
  notificationChannels?: string[]
  metadata?: any
}

export interface HITLRequestData {
  id: string
  workflowId: string
  executionId: string
  blockId: string
  requestType: HITLRequestType
  status: HITLRequestStatus
  title: string
  description: string | null
  data: any
  options: any
  assignedTo: string | null
  assignedToEmail: string | null
  respondedBy: string | null
  response: any
  responseNote: string | null
  timeoutAt: Date | null
  priority: HITLPriority
  notificationSent: boolean
  notificationChannels: string[]
  createdAt: Date
  respondedAt: Date | null
  metadata: any
}

export interface RespondToRequestOptions {
  requestId: string
  userId: string
  response: any
  status: 'approved' | 'rejected'
  responseNote?: string
}

export interface PausedExecutionState {
  blockStates: Record<string, any>
  loopIterations: Record<string, number>
  decisions: {
    router: Record<string, string>
    condition: Record<string, string>
  }
  executedBlocks: string[]
  activeExecutionPath: string[]
  environmentVariables: Record<string, string>
  metadata: any
}
