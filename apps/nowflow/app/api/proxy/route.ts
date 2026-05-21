import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { assertSafePublicUrl } from '@/lib/network/url-security'
import { requireSessionOrInternalApiKey } from '@/lib/request-auth'
import { executeTool } from '@/tools'
import { getTool } from '@/tools/utils'
import { validateToolRequest } from '@/tools/utils'

const logger = createLogger('ProxyAPI')

/**
 * Creates a minimal set of default headers for proxy requests
 * @returns Record of HTTP headers
 */
const getProxyHeaders = (): Record<string, string> => {
  return {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  }
}

/**
 * Formats a response with CORS headers
 * @param responseData Response data object
 * @param status HTTP status code
 * @returns NextResponse with CORS headers
 */
const formatResponse = (responseData: any, status = 200) => {
  return NextResponse.json(responseData, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

/**
 * Creates an error response with consistent formatting
 * @param error Error object or message
 * @param status HTTP status code
 * @param additionalData Additional data to include in the response
 * @returns Formatted error response
 */
const createErrorResponse = (error: any, status = 500, additionalData = {}) => {
  const errorMessage = error instanceof Error ? error.message : String(error)

  return formatResponse(
    {
      success: false,
      error: errorMessage,
      ...additionalData,
    },
    status
  )
}

/**
 * GET handler for direct external URL proxying
 * This allows for GET requests to external APIs
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')
  const requestId = crypto.randomUUID().slice(0, 8)

  if (!targetUrl) {
    return createErrorResponse("Missing 'url' parameter", 400)
  }

  // Auth — require a valid session for proxy GET
  const session = await getSession()
  if (!session?.user?.id) {
    return createErrorResponse('Unauthorized', 401)
  }

  try {
    await assertSafePublicUrl(targetUrl)
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'URL not allowed', 403)
  }

  // Extract custom headers from the request
  const customHeaders: Record<string, string> = {}

  // Process all header.* parameters in the URL
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('header.')) {
      const headerName = key.substring(7) // Remove 'header.' prefix
      customHeaders[headerName] = value
    }
  }

  logger.info(`[${requestId}] Proxying GET request to: ${targetUrl}`)
  logger.debug(`[${requestId}] Custom headers:`, customHeaders)

  try {
    // Forward the request to the target URL with all specified headers
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        ...getProxyHeaders(),
        ...customHeaders,
      },
    })

    // Get response data
    const contentType = response.headers.get('content-type') || ''
    let data

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    // For error responses, include a more descriptive error message
    const errorMessage = !response.ok
      ? data && typeof data === 'object' && data.error
        ? `${data.error.message || JSON.stringify(data.error)}`
        : response.statusText || `HTTP error ${response.status}`
      : undefined

    // Return the proxied response
    return formatResponse({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      error: errorMessage,
    })
  } catch (error: any) {
    logger.error(`[${requestId}] Proxy GET request failed`, {
      url: targetUrl,
      error: error instanceof Error ? error.message : String(error),
    })

    return createErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const startTime = new Date()
  const startTimeISO = startTime.toISOString()

  try {
    const authResult = await requireSessionOrInternalApiKey(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { toolId, params } = await request.json()

    logger.debug(`[${requestId}] Proxy request for tool`, {
      toolId,
      hasParams: !!params && Object.keys(params).length > 0,
    })

    const tool = getTool(toolId)

    // Validate the tool and its parameters BEFORE credential exchange
    try {
      validateToolRequest(toolId, tool, params)
    } catch (error) {
      logger.warn(`[${requestId}] Tool validation failed`, {
        toolId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Add timing information even to error responses
      const endTime = new Date()
      const endTimeISO = endTime.toISOString()
      const duration = endTime.getTime() - startTime.getTime()

      return createErrorResponse(error, 400, {
        startTime: startTimeISO,
        endTime: endTimeISO,
        duration,
      })
    }

    // Handle credential exchange on the server side AFTER validation
    if (params && params.credential) {
      logger.info(
        `[${requestId}] Credential found for ${toolId}, fetching access token on server.`,
        {
          hasCredential: true,
        }
      )
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const tokenUrl = new URL('/api/auth/oauth/token', baseUrl).toString()

        const tokenPayload: any = {
          credentialId: params.credential,
        }

        // Add workflowId if it exists in params
        const workflowId = params.workflowId || params._context?.workflowId
        if (workflowId) {
          tokenPayload.workflowId = workflowId
          logger.info(`[${requestId}] Added workflowId ${workflowId} to token payload`)
        }

        logger.info(`[${requestId}] Fetching token from ${tokenUrl}`)

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenPayload),
        })

        logger.info(
          `[${requestId}] Token fetch response: ${response.status} ${response.statusText}`
        )

        if (!response.ok) {
          await response.text().catch(() => '')
          logger.error(`[${requestId}] Token fetch failed:`, {
            status: response.status,
            statusText: response.statusText,
          })
          return createErrorResponse(`Failed to fetch access token: ${response.status}`, 401, {
            startTime: startTimeISO,
          })
        }

        const data = await response.json()
        params.accessToken = data.accessToken
        logger.info(`[${requestId}] Successfully fetched access token for ${toolId}`, {
          hasAccessToken: !!data.accessToken,
        })

        // Clean up workflowId but keep credential for validation
        // Note: credential is required for validation but not used in execution (accessToken is used instead)
        if (params.workflowId) delete params.workflowId

        logger.info(`[${requestId}] Params after token exchange:`, {
          paramKeys: Object.keys(params),
          hasAccessToken: !!params.accessToken,
          hasCredential: !!params.credential,
        })
      } catch (error) {
        logger.error(`[${requestId}] Error during credential exchange:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        return createErrorResponse(
          `Failed to obtain credential for tool ${toolId}: ${error instanceof Error ? error.message : String(error)}`,
          500,
          { startTime: startTimeISO }
        )
      }
    }

    try {
      if (!tool) {
        logger.error(`[${requestId}] Tool not found`, { toolId })
        throw new Error(`Tool not found: ${toolId}`)
      }

      logger.info(`[${requestId}] Executing tool ${toolId}`, {
        paramKeys: Object.keys(params),
        hasAccessToken: !!params.accessToken,
      })

      // Use executeTool with skipProxy=true to prevent recursive proxy calls, and skipPostProcess=true to prevent duplicate post-processing
      const result = await executeTool(toolId, params, true, true)

      logger.info(`[${requestId}] Tool execution completed`, {
        success: result.success,
        hasError: !!result.error,
      })

      if (!result.success) {
        logger.warn(`[${requestId}] Tool execution failed`, {
          toolId,
          error: result.error || 'Unknown error',
          output: result.output,
        })

        if (tool.transformError) {
          try {
            const errorResult = tool.transformError(result)

            // Handle both string and Promise return types
            if (typeof errorResult === 'string') {
              throw new Error(errorResult)
            } else {
              // It's a Promise, await it
              const transformedError = await errorResult
              // If it's a string or has an error property, use it
              if (typeof transformedError === 'string') {
                throw new Error(transformedError)
              } else if (
                transformedError &&
                typeof transformedError === 'object' &&
                'error' in transformedError
              ) {
                throw new Error(transformedError.error || 'Tool returned an error')
              }
              // Fallback
              throw new Error('Tool returned an error')
            }
          } catch (e) {
            if (e instanceof Error) {
              throw e
            }
            throw new Error('Tool returned an error')
          }
        } else {
          throw new Error('Tool returned an error')
        }
      }

      const endTime = new Date()
      const endTimeISO = endTime.toISOString()
      const duration = endTime.getTime() - startTime.getTime()

      // Add explicit timing information directly to the response
      const responseWithTimingData = {
        ...result,
        // Add timing data both at root level and in nested timing object
        startTime: startTimeISO,
        endTime: endTimeISO,
        duration,
        timing: {
          startTime: startTimeISO,
          endTime: endTimeISO,
          duration,
        },
      }

      logger.info(`[${requestId}] Tool executed successfully`, {
        toolId,
        duration,
        startTime: startTimeISO,
        endTime: endTimeISO,
      })

      // Return the response with CORS headers
      return formatResponse(responseWithTimingData)
    } catch (error: any) {
      throw error
    }
  } catch (error: any) {
    logger.error(`[${requestId}] Proxy request failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Add timing information even to error responses
    const endTime = new Date()
    const endTimeISO = endTime.toISOString()
    const duration = endTime.getTime() - startTime.getTime()

    return createErrorResponse(error, 500, {
      startTime: startTimeISO,
      endTime: endTimeISO,
      duration,
    })
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
