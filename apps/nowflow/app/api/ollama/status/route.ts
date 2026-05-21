import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { detectOllamaConfig } from '@/lib/ollama-detection'

const logger = createLogger('OllamaStatusAPI')

export const dynamic = 'force-dynamic'

/**
 * Get Ollama status and configuration
 */
export async function GET() {
  try {
    logger.info('Checking Ollama status...')

    const config = await detectOllamaConfig()

    logger.info('Ollama status check complete', {
      available: config.isAvailable,
      environment: config.environment,
      host: config.host,
    })

    return NextResponse.json({
      available: config.isAvailable,
      host: config.host,
      environment: config.environment,
      version: config.version,
    })
  } catch (error) {
    logger.error('Failed to check Ollama status:', error)
    return NextResponse.json(
      {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
