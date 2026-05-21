import { ToolResponse } from '../types'

export interface ThinkingToolParams {
  prompt: string
  systemPrompt?: string
  model: string
  apiKey: string
  thinkingBudget?: number
  showThinkingProcess?: boolean
  // Legacy: kept for backward compatibility with old "thought" field
  thought?: string
}

export interface ThinkingToolResponse extends ToolResponse {
  output: {
    thinkingContent?: string
    response: string
    model: string
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
    // Legacy: kept for backward compatibility
    acknowledgedThought?: string
  }
}
