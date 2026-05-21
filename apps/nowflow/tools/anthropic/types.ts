export interface AnthropicParams {
  apiKey: string
  model:
    | 'claude-opus-4-20250514'
    | 'claude-sonnet-4-20250514'
    | 'claude-3-5-sonnet-20241022'
    | 'claude-3-5-haiku-20241022'
    | 'claude-3-opus-20240229'
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  stopSequences?: string[]
}

export interface AnthropicOutput {
  success: boolean
  content?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  model?: string
  stopReason?: string
  error?: string
}
