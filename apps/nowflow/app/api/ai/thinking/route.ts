import { NextRequest, NextResponse } from 'next/server'
import { AIRequestLimitError, enforceAIRequestAccess } from '@/lib/ai/request-guards'
import { getSession } from '@/lib/auth'
import { API_ENDPOINTS } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ThinkingAPI')

interface ThinkingRequest {
  prompt: string
  systemPrompt?: string
  model: string
  apiKey: string
  thinkingBudget?: number
  showThinkingProcess?: boolean
}

/**
 * POST /api/ai/thinking
 * Runs extended thinking using Anthropic's claude-sonnet-4-6 or claude-opus-4 models.
 * Falls back to a standard reasoning prompt for OpenAI o-series models.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ThinkingRequest = await req.json()
    const {
      prompt,
      systemPrompt,
      model,
      apiKey,
      thinkingBudget = 5000,
      showThinkingProcess = true,
    } = body

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    // Legacy mode: simple acknowledgment without LLM call
    if ((body as any).legacyMode || model === '__legacy__') {
      return NextResponse.json({
        thinkingContent: undefined,
        response: prompt,
        model: 'legacy',
        acknowledgedThought: prompt,
        tokens: { prompt: 0, completion: 0, total: 0 },
      })
    }

    if (!model) {
      return NextResponse.json({ error: 'model is required' }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })
    }

    await enforceAIRequestAccess(session.user.id)

    const isAnthropic = model.includes('claude') || model.startsWith('anthropic/')
    const isOpenAIReasoning =
      model.startsWith('o1') ||
      model.startsWith('o3') ||
      model.startsWith('o4') ||
      model.includes('reasoning')

    if (isAnthropic) {
      return await runAnthropicExtendedThinking({
        prompt,
        systemPrompt,
        model: model.replace('anthropic/', ''),
        apiKey,
        thinkingBudget,
        showThinkingProcess,
      })
    } else if (isOpenAIReasoning) {
      return await runOpenAIReasoning({
        prompt,
        systemPrompt,
        model: model.replace('openai/', ''),
        apiKey,
        showThinkingProcess,
      })
    } else {
      return NextResponse.json(
        {
          error: `Model ${model} does not support extended thinking. Use claude-sonnet-4-6, claude-opus-4, o3, or o4-mini.`,
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    if (error instanceof AIRequestLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      )
    }

    logger.error('Thinking API error:', error)
    return NextResponse.json({ error: error.message || 'Thinking request failed' }, { status: 500 })
  }
}

async function runAnthropicExtendedThinking({
  prompt,
  systemPrompt,
  model,
  apiKey,
  thinkingBudget,
  showThinkingProcess,
}: {
  prompt: string
  systemPrompt?: string
  model: string
  apiKey: string
  thinkingBudget: number
  showThinkingProcess: boolean
}) {
  // Extended thinking requires a minimum of 1024 budget tokens
  const budget = Math.max(1024, Math.min(thinkingBudget, 16000))

  const requestBody: Record<string, any> = {
    model,
    max_tokens: budget + 4096,
    thinking: {
      type: 'enabled',
      budget_tokens: budget,
    },
    messages: [{ role: 'user', content: prompt }],
  }

  if (systemPrompt) {
    requestBody.system = systemPrompt
  }

  const response = await fetch(API_ENDPOINTS.anthropic.messages, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    const errMsg = errData?.error?.message || `Anthropic API error ${response.status}`
    logger.error('Anthropic extended thinking error:', errMsg)
    return NextResponse.json({ error: errMsg }, { status: response.status })
  }

  const data = await response.json()

  let thinkingContent = ''
  let textContent = ''

  // Parse interleaved thinking and text blocks
  for (const block of data.content || []) {
    if (block.type === 'thinking') {
      thinkingContent += (thinkingContent ? '\n\n' : '') + block.thinking
    } else if (block.type === 'text') {
      textContent += (textContent ? '\n\n' : '') + block.text
    }
  }

  const tokens = {
    prompt: data.usage?.input_tokens,
    completion: data.usage?.output_tokens,
    total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  }

  return NextResponse.json({
    thinkingContent: showThinkingProcess ? thinkingContent : undefined,
    response: textContent,
    model: data.model || model,
    tokens,
  })
}

async function runOpenAIReasoning({
  prompt,
  systemPrompt,
  model,
  apiKey,
  showThinkingProcess,
}: {
  prompt: string
  systemPrompt?: string
  model: string
  apiKey: string
  showThinkingProcess: boolean
}) {
  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    messages.push({ role: 'developer', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const requestBody: Record<string, any> = {
    model,
    messages,
    reasoning_effort: 'high',
  }

  const response = await fetch(API_ENDPOINTS.openai.chat, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    const errMsg = errData?.error?.message || `OpenAI API error ${response.status}`
    return NextResponse.json({ error: errMsg }, { status: response.status })
  }

  const data = await response.json()
  const choice = data.choices?.[0]
  const textContent = choice?.message?.content || ''

  // OpenAI o-series may include reasoning_content in some API versions
  const reasoningContent = choice?.message?.reasoning_content || ''

  const tokens = {
    prompt: data.usage?.prompt_tokens,
    completion: data.usage?.completion_tokens,
    total: data.usage?.total_tokens,
  }

  return NextResponse.json({
    thinkingContent: showThinkingProcess && reasoningContent ? reasoningContent : undefined,
    response: textContent,
    model: data.model || model,
    tokens,
  })
}
