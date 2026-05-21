export interface LogEntry {
  id: string
  workflowId: string
  executionId: string
  level: string
  message: string
  createdAt: Date
  duration?: string
  trigger?: string
  metadata?: ToolCallMetadata | Record<string, any>
}

export interface ToolCallMetadata {
  toolCalls?: ToolCall[]
  cost?: {
    model?: string
    input?: number
    output?: number
    total?: number
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
    pricing?: {
      input: number
      output: number
      cachedInput?: number
      updatedAt: string
    }
  }
}

export interface ToolCall {
  name: string
  duration: number // in milliseconds
  startTime: string // ISO timestamp
  endTime: string // ISO timestamp
  status: 'success' | 'error' // Status of the tool call
  input?: Record<string, any> // Input parameters (optional)
  output?: Record<string, any> // Output data (optional)
  error?: string // Error message if status is 'error'
}
