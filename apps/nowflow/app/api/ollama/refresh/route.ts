import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { detectOllamaConfig } from '@/lib/ollama-detection'
import { isProPlan } from '@/lib/subscription'
import { useOllamaStore } from '@/stores/ollama/store'

const logger = createLogger('OllamaRefreshAPI')

export const dynamic = 'force-dynamic'

/**
 * Refresh Ollama models using dynamic host detection
 */
export async function POST() {
  try {
    // Gate Ollama access to Pro+ plans
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const userIsPro = await isProPlan(session.user.id)
    if (!userIsPro) {
      return NextResponse.json(
        { success: false, error: 'Local models require a Pro plan.' },
        { status: 403 }
      )
    }

    logger.info('Manual Ollama refresh requested by user')

    // Detect Ollama configuration
    const config = await detectOllamaConfig()

    if (!config.isAvailable) {
      logger.warn('Ollama is not available for manual refresh')
      return NextResponse.json({
        success: false,
        error: 'Ollama service is not available. Please ensure Ollama is running.',
        models: [],
        modelCount: 0,
      })
    }

    // Fetch models from detected Ollama host
    const response = await fetch(`${config.host}/api/tags`)
    if (!response.ok) {
      throw new Error(`Ollama API returned status ${response.status}`)
    }

    const data = await response.json()
    const models = data.models?.map((model: any) => model.name) || []

    // Update the store
    useOllamaStore.getState().setModels(models)

    logger.info('Ollama models refreshed successfully', {
      host: config.host,
      environment: config.environment,
      modelCount: models.length,
      models,
    })

    return NextResponse.json({
      success: true,
      models,
      modelCount: models.length,
      host: config.host,
      environment: config.environment,
    })
  } catch (error) {
    logger.error('Failed to refresh Ollama models:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Get current Ollama models from store
 */
export async function GET() {
  try {
    // Gate Ollama access to Pro+ plans
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const userIsPro = await isProPlan(session.user.id)
    if (!userIsPro) {
      return NextResponse.json(
        { success: false, error: 'Local models require a Pro plan.' },
        { status: 403 }
      )
    }

    const models = useOllamaStore.getState().models
    return NextResponse.json({
      success: true,
      models,
      modelCount: models.length,
    })
  } catch (error) {
    logger.error('Failed to get Ollama models:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
