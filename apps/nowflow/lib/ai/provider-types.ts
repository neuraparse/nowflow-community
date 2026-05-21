// ---------------------------------------------------------------------------
// Types for AI provider service
// ---------------------------------------------------------------------------

export interface ResolvedAIConfig {
  provider: string
  model: string
  apiKey: string
  temperature: number
  maxTokens: number
  ollamaHost: string
  source: 'env-vars' | 'none'
}

/** OpenAI-compatible function tool definition */
export interface OpenAIFunctionTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

/** A tool call returned by OpenAI-compatible APIs */
export interface OpenAIToolCall {
  type: 'function'
  id: string
  function: {
    name: string
    arguments: string
  }
}

/** A content block returned by the Anthropic API */
export interface AnthropicContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  name?: string
  input?: Record<string, unknown>
}

/** An action extracted from tool calls / tool_use blocks */
export interface AIAction {
  name: string
  parameters: Record<string, unknown>
}

/** Standard result shape from AI provider calls */
export interface AIProviderResult {
  content: string
  provider: string
  model: string
  actions?: AIAction[]
}

export interface AIProviderCallParams {
  provider: string
  model: string
  apiKey: string
  messages: Array<{ role: string; content: string }>
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  ollamaHost?: string
  tools?: OpenAIFunctionTool[]
  toolChoice?: string
}
