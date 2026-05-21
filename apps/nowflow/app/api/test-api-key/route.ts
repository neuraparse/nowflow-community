import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { API_ENDPOINTS } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('test-api-keyAPI')

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { provider, apiKey } = await request.json()

    logger.debug('Testing API key for provider:', provider)
    logger.debug('🔑 API Key length:', apiKey?.length || 0)

    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Provider and API key are required' },
        { status: 400 }
      )
    }

    // Skip test for Ollama (local)
    if (provider === 'ollama') {
      return NextResponse.json({ success: true, message: 'Ollama is local, no test needed' })
    }

    let testUrl = ''
    let testHeaders: any = {}
    let method = 'GET'
    let body: string | undefined

    // Configure test based on provider
    switch (provider) {
      case 'openai':
        testUrl = API_ENDPOINTS.openai.models
        testHeaders = {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
        break

      case 'anthropic':
        testUrl = API_ENDPOINTS.anthropic.messages
        method = 'POST'
        testHeaders = {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        }
        body = JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        })
        break

      case 'groq':
        testUrl = API_ENDPOINTS.groq.models
        testHeaders = {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
        break

      case 'together':
        testUrl = API_ENDPOINTS.together.models
        testHeaders = {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        )
    }

    logger.debug('🌐 Testing URL:', testUrl)
    logger.debug('📋 Method:', method)

    // Make the API request
    const response = await fetch(testUrl, {
      method,
      headers: testHeaders,
      body,
    })

    logger.debug('📡 Response status:', response.status)
    logger.debug('📡 Response ok:', response.ok)

    // Check for success based on provider
    let isSuccess = false
    let errorMessage = ''

    if (provider === 'anthropic') {
      // For Anthropic, 200 or 400 (with proper error) means valid API key
      const contentType = response.headers.get('content-type') || ''
      isSuccess =
        response.status === 200 ||
        (response.status === 400 && contentType.includes('application/json'))
    } else {
      // For others, 200 means success
      isSuccess = response.ok
    }

    if (isSuccess) {
      logger.debug('API test successful')

      // For OpenAI, also get available models
      let availableModels = []
      if (provider === 'openai') {
        try {
          const modelsResponse = await fetch(API_ENDPOINTS.openai.models, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          })

          if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json()
            availableModels = modelsData.data?.map((model: any) => model.id) || []
            logger.debug('📋 Available models:', availableModels.length)
          }
        } catch (e) {
          logger.debug('⚠️ Could not fetch available models')
        }
      }

      return NextResponse.json({
        success: true,
        message: 'API key is valid',
        provider,
        status: response.status,
        availableModels,
      })
    } else {
      logger.debug('API test failed with status:', response.status)

      // Try to get error message
      try {
        const errorText = await response.text()
        logger.debug('API test error response', {
          status: response.status,
          statusText: response.statusText,
        })

        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message
        } else if (errorJson.message) {
          errorMessage = errorJson.message
        } else {
          errorMessage = `API test failed: ${response.status} ${response.statusText}`
        }
      } catch (e) {
        errorMessage = `API test failed: ${response.status} ${response.statusText}`
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          provider,
          status: response.status,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    logger.error('API test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}
