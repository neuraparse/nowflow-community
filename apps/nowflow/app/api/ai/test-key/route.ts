import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { API_ENDPOINTS } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'
import { checkRateLimit } from '@/lib/rate-limit/redis-store'

const logger = createLogger('TEST-KEYAPI')

interface TestKeyRequest {
  provider: string
  apiKey: string
  model?: string
}

interface TestKeyResponse {
  success: boolean
  error?: string
  provider?: string
}

/**
 * Per-user request rate-limit on this endpoint. Test-key calls a third-party
 * API on behalf of the user; without a cap, a misbehaving client (or attacker
 * with a stolen session cookie) can enumerate keys or burn the user's
 * provider-side rate budget. 30 calls per minute is generous for a UI flow
 * (typing + verify) and tight enough to disrupt brute-force.
 */
const RATE_LIMIT_PER_MIN = 30
const RATE_LIMIT_WINDOW_MS = 60_000

/**
 * Test API Key Validation Endpoint
 * Tests API keys for various AI providers using lightweight API calls
 */
export async function POST(request: NextRequest): Promise<NextResponse<TestKeyResponse>> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rl = await checkRateLimit(
      `test-key:${session.user.id}`,
      RATE_LIMIT_PER_MIN,
      RATE_LIMIT_WINDOW_MS
    )
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    const { provider, apiKey }: TestKeyRequest = await request.json()

    logger.debug(`Testing API key for provider: ${provider}`)

    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Provider and API key are required' },
        { status: 400 }
      )
    }

    switch (provider.toLowerCase()) {
      case 'openai':
        return await testWithModelsEndpoint(apiKey, API_ENDPOINTS.openai.models, 'openai')

      case 'anthropic':
        return await testAnthropicKey(apiKey)

      case 'google':
        return await testGoogleKey(apiKey)

      case 'groq':
        return await testWithModelsEndpoint(apiKey, API_ENDPOINTS.groq.models, 'groq')

      case 'deepseek':
        return await testWithModelsEndpoint(apiKey, API_ENDPOINTS.deepseek.models, 'deepseek')

      case 'xai':
        return await testWithModelsEndpoint(apiKey, API_ENDPOINTS.xai.models, 'xai')

      case 'cerebras':
        return await testWithModelsEndpoint(apiKey, 'https://api.cerebras.ai/v1/models', 'cerebras')

      case 'ollama':
        return NextResponse.json({ success: true, provider: 'ollama' })

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        )
    }
  } catch (error) {
    // Log full error server-side, but never echo internal error details (which
    // can include the upstream URL with the key in it for misconfigured clients)
    // back to the browser. Always return a generic message.
    logger.error('API key test error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, error: 'Key validation failed' }, { status: 500 })
  }
}

/**
 * Test API key using OpenAI-compatible /v1/models endpoint
 * Works for: OpenAI, Groq, DeepSeek, xAI, Cerebras
 */
async function testWithModelsEndpoint(
  apiKey: string,
  url: string,
  providerName: string
): Promise<NextResponse<TestKeyResponse>> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ success: false, error: `Invalid ${providerName} API key` })
      }
      return NextResponse.json({
        success: false,
        error: `${providerName} API error: ${response.status}`,
      })
    }

    return NextResponse.json({ success: true, provider: providerName })
  } catch (error) {
    logger.error(`${providerName} API test error:`, error)
    return NextResponse.json({
      success: false,
      error: `Failed to connect to ${providerName} API`,
    })
  }
}

/**
 * Test Anthropic API Key using /v1/messages with max_tokens=1
 */
async function testAnthropicKey(apiKey: string): Promise<NextResponse<TestKeyResponse>> {
  try {
    const response = await fetch(API_ENDPOINTS.anthropic.messages, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ success: false, error: 'Invalid Anthropic API key' })
      }
      return NextResponse.json({
        success: false,
        error: `Anthropic API error: ${response.status}`,
      })
    }

    return NextResponse.json({ success: true, provider: 'anthropic' })
  } catch (error) {
    logger.error('Anthropic API test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to connect to Anthropic API',
    })
  }
}

/**
 * Test Google API Key using the models list endpoint
 */
async function testGoogleKey(apiKey: string): Promise<NextResponse<TestKeyResponse>> {
  try {
    // Send the key in the `x-goog-api-key` header instead of the URL query
    // string. Query-string keys leak into Nginx/proxy access logs, observability
    // pipelines (Loki/Grafana), and outbound `Referer` headers — all of which
    // are persistent and not expected to be sensitive.
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        return NextResponse.json({ success: false, error: 'Invalid Google API key' })
      }
      return NextResponse.json({
        success: false,
        error: `Google API error: ${response.status}`,
      })
    }

    return NextResponse.json({ success: true, provider: 'google' })
  } catch (error) {
    logger.error('Google API test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to connect to Google API',
    })
  }
}
