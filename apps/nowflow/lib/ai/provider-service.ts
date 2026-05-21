import { API_ENDPOINTS, OLLAMA_DEFAULT_HOST } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'
import { decryptApiKey, encryptApiKey } from './encryption'
import { getDefaultModel, getEnvVarConfig, getOpenAICompatibleUrl } from './provider-config'
import {
  streamAnthropic,
  streamGoogle,
  streamOllama,
  streamOpenAICompatible,
} from './provider-streaming'
import {
  AIAction,
  AIProviderCallParams,
  AIProviderResult,
  AnthropicContentBlock,
  OpenAIFunctionTool,
  OpenAIToolCall,
  ResolvedAIConfig,
} from './provider-types'

const logger = createLogger('AIProviderService')

// Re-export types and encryption for backward compatibility
export type { ResolvedAIConfig, AIProviderCallParams }
export { encryptApiKey, decryptApiKey }

// ---------------------------------------------------------------------------
// Environment AI config cache (60s TTL)
// ---------------------------------------------------------------------------

const aiConfigCache: { data: ResolvedAIConfig | null; timestamp: number } = {
  data: null,
  timestamp: 0,
}

const CACHE_TTL = 60000

export function invalidateAIConfigCache() {
  logger.debug('Invalidating AI config cache')
  aiConfigCache.data = null
  aiConfigCache.timestamp = 0
}

// ---------------------------------------------------------------------------
// getResolvedAIConfig - env vars -> null
// ---------------------------------------------------------------------------

export async function getResolvedAIConfig(): Promise<ResolvedAIConfig | null> {
  const now = Date.now()
  if (aiConfigCache.data && now - aiConfigCache.timestamp < CACHE_TTL) {
    return aiConfigCache.data
  }

  const envConfig = getEnvVarConfig()
  if (envConfig) {
    aiConfigCache.data = envConfig
    aiConfigCache.timestamp = now
    return envConfig
  }

  return null
}

// ---------------------------------------------------------------------------
// callAIProvider – unified non-streaming call
// ---------------------------------------------------------------------------

export async function callAIProvider(params: AIProviderCallParams): Promise<AIProviderResult> {
  const {
    provider,
    model,
    apiKey,
    messages,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 2000,
    ollamaHost,
    tools,
    toolChoice,
  } = params

  switch (provider) {
    case 'openai':
      return callOpenAI(
        model,
        apiKey,
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        toolChoice
      )
    case 'anthropic':
      return callAnthropic(
        model,
        apiKey,
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        toolChoice
      )
    case 'groq':
      return callOpenAICompatible(
        API_ENDPOINTS.groq.chat,
        'groq',
        model,
        apiKey,
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        toolChoice
      )
    case 'together':
      return callOpenAICompatible(
        API_ENDPOINTS.together.chat,
        'together',
        model,
        apiKey,
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        toolChoice
      )
    case 'deepseek':
      return callOpenAICompatible(
        API_ENDPOINTS.deepseek.chat,
        'deepseek',
        model,
        apiKey,
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        toolChoice
      )
    case 'xai':
      return callOpenAICompatible(
        API_ENDPOINTS.xai.chat,
        'xai',
        model,
        apiKey,
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        toolChoice
      )
    case 'google':
      return callGoogle(model, apiKey, messages, systemPrompt, temperature, maxTokens)
    case 'ollama':
      return callOllama(
        model,
        ollamaHost || OLLAMA_DEFAULT_HOST,
        messages,
        systemPrompt,
        temperature,
        maxTokens
      )
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

// ---------------------------------------------------------------------------
// callAIProviderStreaming – unified SSE streaming call
// ---------------------------------------------------------------------------

export async function callAIProviderStreaming(
  params: AIProviderCallParams
): Promise<ReadableStream> {
  const {
    provider,
    model,
    apiKey,
    messages,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 2000,
    ollamaHost,
  } = params

  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  switch (provider) {
    case 'openai':
    case 'groq':
    case 'together':
    case 'deepseek':
    case 'xai': {
      const baseUrl = getOpenAICompatibleUrl(provider)
      return streamOpenAICompatible(baseUrl, model, apiKey, fullMessages, temperature, maxTokens)
    }
    case 'anthropic':
      return streamAnthropic(
        model,
        apiKey,
        fullMessages,
        systemPrompt || '',
        temperature,
        maxTokens
      )
    case 'google':
      return streamGoogle(model, apiKey, fullMessages, temperature, maxTokens)
    case 'ollama':
      return streamOllama(
        model,
        ollamaHost || OLLAMA_DEFAULT_HOST,
        fullMessages,
        temperature,
        maxTokens
      )
    default:
      throw new Error(`Unsupported streaming provider: ${provider}`)
  }
}

// ---------------------------------------------------------------------------
// Provider implementations (non-streaming)
// ---------------------------------------------------------------------------

async function callOpenAI(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number,
  tools?: OpenAIFunctionTool[],
  toolChoice?: string
): Promise<AIProviderResult> {
  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  const body: Record<string, unknown> = {
    model,
    messages: fullMessages,
    temperature,
    max_tokens: maxTokens,
  }

  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice || 'auto'
  }

  const response = await fetch(API_ENDPOINTS.openai.chat, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`OpenAI API error (${response.status}): ${errText}`)
  }

  const result = await response.json()
  const message = result.choices?.[0]?.message

  // Handle tool calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const actions = message.tool_calls
      .filter((call: OpenAIToolCall) => call.type === 'function')
      .map((call: OpenAIToolCall): AIAction | null => {
        try {
          return {
            name: call.function.name,
            parameters: JSON.parse(call.function.arguments),
          }
        } catch (e) {
          logger.warn('Failed to parse tool call arguments', {
            name: call.function.name,
            args: call.function.arguments,
          })
          return null
        }
      })
      .filter((a: AIAction | null): a is AIAction => a !== null)

    return {
      content: message.content || '',
      provider: 'openai',
      model,
      actions,
    }
  }

  return {
    content: message?.content || 'I could not generate a response.',
    provider: 'openai',
    model,
  }
}

async function callAnthropic(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number,
  tools?: OpenAIFunctionTool[],
  toolChoice?: string
): Promise<AIProviderResult> {
  const nonSystemMessages = messages.filter((m) => m.role !== 'system')
  const systemContent = [
    systemPrompt,
    ...messages.filter((m) => m.role === 'system').map((m) => m.content),
  ]
    .filter(Boolean)
    .join('\n\n')

  // Convert OpenAI-style tools to Anthropic format
  const anthropicTools = tools?.map((tool: OpenAIFunctionTool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }))

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    ...(systemContent ? { system: systemContent } : {}),
    messages: nonSystemMessages,
  }

  if (anthropicTools && anthropicTools.length > 0) {
    body.tools = anthropicTools
    if (toolChoice === 'auto') {
      body.tool_choice = { type: 'auto' }
    }
  }

  const response = await fetch(API_ENDPOINTS.anthropic.messages, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Anthropic API error (${response.status}): ${errText}`)
  }

  const result = await response.json()

  // Extract text content
  const blocks: AnthropicContentBlock[] = result.content || []
  const textBlocks = blocks.filter((b) => b.type === 'text')
  const content =
    textBlocks.map((b) => b.text).join('\n') || "I've updated the workflow based on your request."

  // Extract tool_use blocks as actions
  const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use')
  if (toolUseBlocks.length > 0) {
    const actions: AIAction[] = toolUseBlocks.map((b) => ({
      name: b.name || '',
      parameters: b.input || {},
    }))
    return { content, provider: 'anthropic', model, actions }
  }

  return { content, provider: 'anthropic', model }
}

async function callOpenAICompatible(
  baseUrl: string,
  providerName: string,
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number,
  tools?: OpenAIFunctionTool[],
  toolChoice?: string
): Promise<AIProviderResult> {
  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  const body: Record<string, unknown> = {
    model,
    messages: fullMessages,
    temperature,
    max_tokens: maxTokens,
  }

  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice || 'auto'
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`${providerName} API error (${response.status}): ${errText}`)
  }

  const result = await response.json()
  const message = result.choices?.[0]?.message

  // Handle tool calls (OpenAI-compatible format)
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const actions = message.tool_calls
      .filter((call: OpenAIToolCall) => call.type === 'function')
      .map((call: OpenAIToolCall): AIAction | null => {
        try {
          return {
            name: call.function.name,
            parameters: JSON.parse(call.function.arguments),
          }
        } catch (e) {
          logger.warn('Failed to parse tool call arguments', {
            name: call.function.name,
            args: call.function.arguments,
          })
          return null
        }
      })
      .filter((a: AIAction | null): a is AIAction => a !== null)

    return {
      content: message.content || '',
      provider: providerName,
      model,
      actions,
    }
  }

  return {
    content: message?.content || 'I could not generate a response.',
    provider: providerName,
    model,
  }
}

async function callGoogle(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number
): Promise<{ content: string; provider: string; model: string }> {
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = [
    systemPrompt,
    ...messages.filter((m) => m.role === 'system').map((m) => m.content),
  ]
    .filter(Boolean)
    .join('\n\n')

  const response = await fetch(
    `${API_ENDPOINTS.google.chat}/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Google API error (${response.status}): ${errText}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  return {
    content: text || 'I could not generate a response.',
    provider: 'google',
    model,
  }
}

async function callOllama(
  model: string,
  ollamaHost: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number
): Promise<{ content: string; provider: string; model: string }> {
  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  const response = await fetch(`${ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      options: { temperature, num_predict: maxTokens },
      stream: false,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Ollama API error (${response.status}): ${errText}`)
  }

  const result = await response.json()
  return {
    content: result.message?.content || 'I could not generate a response.',
    provider: 'ollama',
    model,
  }
}
