import { NextRequest, NextResponse } from 'next/server'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { callAIProvider, invalidateAIConfigCache } from '@/lib/ai/provider-service'
import { AIRequestLimitError, enforceAIRequestAccess } from '@/lib/ai/request-guards'
import { getSession } from '@/lib/auth'
import { OLLAMA_DEFAULT_HOST } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('AIChatAPI')

export { invalidateAIConfigCache }

export async function POST(request: NextRequest) {
  let settings: any = null

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await enforceAIRequestAccess(session.user.id)

    const {
      message,
      settings: requestSettings,
      workflowContext,
      conversationHistory,
    } = await request.json()
    settings = requestSettings

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    logger.info('Processing AI chat request', {
      messageLength: message.length,
      hasSettings: !!settings,
      hasWorkflowContext: !!workflowContext,
      historyLength: conversationHistory?.length || 0,
    })

    let selectedProvider: string
    let selectedModel: string
    let temperature: number
    let maxTokens: number
    let apiKeys: any
    let ollamaHost: string

    selectedProvider = settings?.selectedProvider || 'openai'
    selectedModel = settings?.selectedModel || getDefaultModel(selectedProvider)
    temperature = settings?.preferences?.temperature || 0.7
    maxTokens = settings?.preferences?.maxTokens || 1000
    apiKeys = settings?.apiKeys || {}
    ollamaHost = settings?.ollamaHost || OLLAMA_DEFAULT_HOST

    // Get the appropriate API key
    const apiKey = apiKeys?.[selectedProvider] || getEnvApiKey(selectedProvider)

    if (!apiKey && selectedProvider !== 'ollama') {
      throw new Error(`${selectedProvider} API key not configured`)
    }

    // Build messages with workflow context
    const messages = buildChatMessages({ message, workflowContext, conversationHistory })
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n')

    const result = await callAIProvider({
      provider: selectedProvider,
      model: selectedModel,
      apiKey: apiKey || '',
      messages: nonSystemMessages,
      systemPrompt,
      temperature,
      maxTokens,
      ollamaHost,
    })

    logger.info('AI chat completed', {
      provider: selectedProvider,
      model: selectedModel,
      responseLength: result.content?.length || 0,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AIRequestLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      )
    }

    logger.error('AI chat processing failed', {
      error: error instanceof Error ? error.message : String(error),
      settings: settings
        ? {
            selectedProvider: settings.selectedProvider,
            selectedModel: settings.selectedModel,
            hasApiKeys: !!settings.apiKeys,
          }
        : null,
    })

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    return NextResponse.json(
      {
        error: 'Failed to process AI chat request',
        details: errorMessage,
        provider: settings?.selectedProvider || 'unknown',
      },
      { status: 500 }
    )
  }
}

function getEnvApiKey(provider: string): string {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY || ''
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY || ''
    case 'groq':
      return process.env.GROQ_API_KEY || ''
    case 'together':
      return process.env.TOGETHER_API_KEY || ''
    case 'google':
      return process.env.GOOGLE_API_KEY || ''
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY || ''
    case 'xai':
      return process.env.XAI_API_KEY || ''
    default:
      return ''
  }
}

function formatWorkflowContextForChat(workflowContext: any): string {
  if (!workflowContext || typeof workflowContext !== 'object') return ''

  const blocks: any[] = Array.isArray(workflowContext.blocks)
    ? workflowContext.blocks
    : workflowContext.blocks && typeof workflowContext.blocks === 'object'
      ? Object.entries(workflowContext.blocks).map(([id, b]: [string, any]) => ({ id, ...b }))
      : []

  const edges: any[] = Array.isArray(workflowContext.edges) ? workflowContext.edges : []

  const blockLines = blocks.slice(0, 30).map((b) => {
    const name = b?.name || b?.data?.name || b?.title || ''
    const id = b?.id ? String(b.id) : ''
    const type = b?.type ? String(b.type) : ''
    const label = name ? `${name}` : type
    return `- ${id ? `${id}: ` : ''}${type}${label && label !== type ? ` (${label})` : ''}`
  })

  const edgeLines = edges.slice(0, 40).map((e) => {
    const source = e?.source ? String(e.source) : ''
    const target = e?.target ? String(e.target) : ''
    const sh = e?.sourceHandle ? String(e.sourceHandle) : ''
    const th = e?.targetHandle ? String(e.targetHandle) : ''
    const handles = sh || th ? ` [${sh || '-'}→${th || '-'}]` : ''
    return `- ${source} → ${target}${handles}`
  })

  const title =
    workflowContext?.metadata?.title ||
    workflowContext?.title ||
    workflowContext?.workflowName ||
    workflowContext?.name ||
    ''

  return [
    '## CURRENT WORKFLOW CONTEXT (read-only)',
    title ? `Title: ${title}` : null,
    `Blocks: ${blocks.length}`,
    `Edges: ${edges.length}`,
    blocks.length
      ? `\nBlocks (first ${Math.min(blocks.length, 30)}):\n${blockLines.join('\n')}`
      : null,
    edges.length ? `\nEdges (first ${Math.min(edges.length, 40)}):\n${edgeLines.join('\n')}` : null,
    '\nIMPORTANT: If the user asks about the current workflow, use the context above. Do not invent blocks or connections.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildChatMessages(params: {
  message: string
  workflowContext?: any
  conversationHistory?: Array<{ role: string; content: string }>
}): Array<{ role: string; content: string }> {
  const { message, workflowContext, conversationHistory } = params

  const workflowContextText = formatWorkflowContextForChat(workflowContext)
  const system =
    'You are a helpful AI assistant for workflow automation.\n' +
    'If workflow context is provided, you MUST use it to answer questions about the current workflow.\n' +
    'Do not hallucinate blocks or connections. If details are missing from context, say so.'

  const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: system }]

  if (workflowContextText) {
    messages.push({ role: 'system', content: workflowContextText })
  }

  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory)
  }

  messages.push({ role: 'user', content: message })
  return messages
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
