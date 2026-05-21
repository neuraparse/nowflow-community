import { OLLAMA_DEFAULT_HOST } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('OllamaDetection')

export interface OllamaConfig {
  isAvailable: boolean
  host: string
  environment: 'local' | 'none'
  version?: string
}

/**
 * Detect Ollama availability and configuration
 */
export async function detectOllamaConfig(): Promise<OllamaConfig> {
  const possibleHosts = [
    'http://localhost:11434', // Local installation
    'http://127.0.0.1:11434', // Alternative local
  ]

  logger.info('Detecting Ollama configuration...', {
    possibleHosts,
  })

  for (const host of possibleHosts) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // Reduced timeout

      const response = await fetch(`${host}/api/version`, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const version = await response.json()

        logger.info('Ollama detected successfully', {
          host,
          environment: 'local',
          version: version.version,
        })

        return {
          isAvailable: true,
          host,
          environment: 'local',
          version: version.version,
        }
      } else {
        logger.debug(`Ollama responded with status ${response.status} at ${host}`)
      }
    } catch (error) {
      // Don't log connection errors as they're expected when Ollama is not available
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (
        process.env.NODE_ENV === 'development' &&
        !errorMessage.includes('AbortError') &&
        !errorMessage.includes('ECONNREFUSED')
      ) {
        logger.debug(`Ollama check failed at ${host}`, { error: errorMessage })
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.debug('Ollama not detected on any host (this is normal if Ollama is not installed)')
  }

  return {
    isAvailable: false,
    host: '',
    environment: 'none',
  }
}

/**
 * Get Ollama host based on environment.
 *
 * Priority:
 *  1. OLLAMA_HOST env var (always wins)
 *  2. Local development → http://localhost:11434
 */
export function getOllamaHost(): string {
  // Check environment variables first
  if (process.env.OLLAMA_HOST) {
    return process.env.OLLAMA_HOST
  }

  // Default to localhost for local development
  return 'http://localhost:11434'
}

/**
 * Check if Ollama is available (client-safe)
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    // Client-side: use API endpoint
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/ollama/status')
      const data = await response.json()
      return data.available === true
    }

    // Server-side: direct check
    const config = await detectOllamaConfig()
    return config.isAvailable
  } catch (error) {
    logger.debug('Ollama availability check failed', { error })
    return false
  }
}
