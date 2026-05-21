import { NextRequest, NextResponse } from 'next/server'
import { AIRequestLimitError, enforceAIRequestAccess } from '@/lib/ai/request-guards'
import { getSession } from '@/lib/auth'
import { OLLAMA_DEFAULT_HOST } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('statusAPI')

// Get AI model status and available models
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()

    // Check Ollama status
    const ollamaHost = OLLAMA_DEFAULT_HOST
    let ollamaStatus = {
      available: false,
      models: [] as string[],
      defaultModel: null as string | null,
      host: ollamaHost,
      error: null as string | null,
    }

    try {
      // Check if Ollama is running
      const healthResponse = await fetch(`${ollamaHost}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (healthResponse.ok) {
        const data = await healthResponse.json()
        const models = data.models?.map((m: any) => m.name) || []

        ollamaStatus = {
          available: true,
          models,
          defaultModel: models[0] || null,
          host: ollamaHost,
          error: null,
        }
      } else {
        ollamaStatus.error = `HTTP ${healthResponse.status}: ${healthResponse.statusText}`
      }
    } catch (error) {
      ollamaStatus.error = error instanceof Error ? error.message : 'Connection failed'
    }

    // Check OpenAI status (if configured)
    let openaiStatus = {
      available: false,
      models: [] as string[],
      apiKey: !!process.env.OPENAI_API_KEY,
      error: null as string | null,
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        // This would check OpenAI API if implemented
        openaiStatus = {
          available: false, // Not implemented yet
          models: ['gpt-4', 'gpt-3.5-turbo'], // Placeholder
          apiKey: true,
          error: 'OpenAI integration not yet implemented',
        }
      } catch (error) {
        openaiStatus.error = error instanceof Error ? error.message : 'OpenAI check failed'
      }
    } else {
      openaiStatus.error = 'No OpenAI API key configured'
    }

    // Check Anthropic status (if configured)
    let anthropicStatus = {
      available: false,
      models: [] as string[],
      apiKey: !!process.env.ANTHROPIC_API_KEY,
      error: null as string | null,
    }

    if (process.env.ANTHROPIC_API_KEY) {
      anthropicStatus = {
        available: false, // Not implemented yet
        models: ['claude-3-sonnet', 'claude-3-haiku'], // Placeholder
        apiKey: true,
        error: 'Anthropic integration not yet implemented',
      }
    } else {
      anthropicStatus.error = 'No Anthropic API key configured'
    }

    // Determine active provider and model
    let activeProvider = 'none'
    let activeModel = null

    if (ollamaStatus.available && ollamaStatus.defaultModel) {
      activeProvider = 'ollama'
      activeModel = ollamaStatus.defaultModel
    } else if (openaiStatus.available && openaiStatus.models.length > 0) {
      activeProvider = 'openai'
      activeModel = openaiStatus.models[0]
    } else if (anthropicStatus.available && anthropicStatus.models.length > 0) {
      activeProvider = 'anthropic'
      activeModel = anthropicStatus.models[0]
    }

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      responseTime,
      activeProvider,
      activeModel,
      providers: {
        ollama: ollamaStatus,
        openai: openaiStatus,
        anthropic: anthropicStatus,
      },
      summary: {
        totalModels:
          ollamaStatus.models.length + openaiStatus.models.length + anthropicStatus.models.length,
        availableProviders: [
          ollamaStatus.available ? 'ollama' : null,
          openaiStatus.available ? 'openai' : null,
          anthropicStatus.available ? 'anthropic' : null,
        ].filter(Boolean),
        hasActiveModel: activeModel !== null,
      },
    })
  } catch (error) {
    logger.error('Error checking AI model status:', error)

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        activeProvider: 'none',
        activeModel: null,
        providers: {
          ollama: { available: false, models: [], error: 'Status check failed' },
          openai: { available: false, models: [], error: 'Status check failed' },
          anthropic: { available: false, models: [], error: 'Status check failed' },
        },
      },
      { status: 500 }
    )
  }
}

// Test AI model with a simple request
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider, model, message } = await request.json()

    if (!provider || !model || !message) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Missing required fields: provider, model, message',
        },
        { status: 400 }
      )
    }

    await enforceAIRequestAccess(session.user.id)

    const startTime = Date.now()
    let response = null
    let error = null

    if (provider === 'ollama') {
      try {
        const ollamaHost = OLLAMA_DEFAULT_HOST

        const ollamaResponse = await fetch(`${ollamaHost}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: message }],
            stream: false,
          }),
        })

        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json()
          response = {
            content: data.message?.content || 'No response content',
            usage: {
              prompt_tokens: data.prompt_eval_count || 0,
              completion_tokens: data.eval_count || 0,
              total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            },
          }
        } else {
          error = `Ollama API error: ${ollamaResponse.status} ${ollamaResponse.statusText}`
        }
      } catch (err) {
        error = err instanceof Error ? err.message : 'Ollama request failed'
      }
    } else {
      error = `Provider '${provider}' not yet implemented`
    }

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: response ? 'success' : 'error',
      timestamp: new Date().toISOString(),
      responseTime,
      provider,
      model,
      message,
      response,
      error,
    })
  } catch (error) {
    if (error instanceof AIRequestLimitError) {
      return NextResponse.json(
        {
          status: 'error',
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      )
    }

    logger.error('Error testing AI model:', error)

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
