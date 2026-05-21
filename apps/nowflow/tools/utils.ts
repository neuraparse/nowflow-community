import { createLogger } from '@/lib/logs/console-logger'
import { useCustomToolsStore } from '@/stores/custom-tools/store'
import { useEnvironmentStore } from '@/stores/settings/environment/store'
import { getApiUrl } from '@/executor/utils/api-url'
import { tools } from './registry'
import { TableRow } from './types'
import { ToolConfig, ToolResponse } from './types'

const logger = createLogger('ToolsUtils')

/**
 * Transforms a table from the store format to a key-value object
 * @param table Array of table rows from the store
 * @returns Record of key-value pairs
 */
export const transformTable = (table: TableRow[] | null): Record<string, any> => {
  if (!table) return {}

  return table.reduce(
    (acc, row) => {
      if (row.cells?.Key && row.cells?.Value !== undefined) {
        // Extract the Value cell as is - it should already be properly resolved
        // by the InputResolver based on variable type (number, string, boolean etc.)
        const value = row.cells.Value

        // Store the correctly typed value in the result object
        acc[row.cells.Key] = value
      }
      return acc
    },
    {} as Record<string, any>
  )
}

interface RequestParams {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

/**
 * Format request parameters based on tool configuration and provided params
 */
export function formatRequestParams(tool: ToolConfig, params: Record<string, any>): RequestParams {
  // Process URL
  let url = typeof tool.request.url === 'function' ? tool.request.url(params) : tool.request.url

  // Append query string if provided
  if (tool.request.query) {
    try {
      const query = tool.request.query(params)
      const u = new URL(
        url,
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
      )
      Object.entries(query || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).length > 0) u.searchParams.set(k, String(v))
      })
      url = u.toString()
    } catch (e) {
      // Fallback: simple concatenation
      const q = tool.request.query(params)
      const qs = Object.entries(q || {})
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
      if (qs) url += (url.includes('?') ? '&' : '?') + qs
    }
  }

  // Process method (support function or string)
  const methodFromTool =
    typeof tool.request.method === 'function' ? tool.request.method(params) : tool.request.method
  const method = (params.method as string) || methodFromTool || 'GET'

  // Process headers
  const headers = tool.request.headers ? tool.request.headers(params) : {}

  // Process body
  const hasBody = method !== 'GET' && method !== 'HEAD' && !!tool.request.body
  const bodyResult = tool.request.body ? tool.request.body(params) : undefined

  // Special handling for NDJSON content type or 'application/x-www-form-urlencoded'
  const isPreformattedContent =
    headers['Content-Type'] === 'application/x-ndjson' ||
    headers['Content-Type'] === 'application/x-www-form-urlencoded'
  const body = hasBody
    ? isPreformattedContent && bodyResult
      ? bodyResult.body
      : JSON.stringify(bodyResult)
    : undefined

  return { url, method, headers, body }
}

/**
 * Execute the actual request and transform the response
 */
export async function executeRequest(
  toolId: string,
  tool: ToolConfig,
  requestParams: RequestParams
): Promise<ToolResponse> {
  try {
    const { url, method, headers, body } = requestParams

    // Log request details for debugging (mask sensitive data)
    logger.debug(`[executeRequest] ${toolId} request:`, {
      url,
      method,
      hasAuthHeader: !!headers['Authorization'],
      authHeaderPrefix: headers['Authorization']?.substring(0, 20) + '...',
    })

    const externalResponse = await fetch(url, { method, headers, body })

    if (!externalResponse.ok) {
      let errorContent
      try {
        errorContent = await externalResponse.json()
      } catch (e) {
        errorContent = { message: externalResponse.statusText }
      }

      // Use the tool's error transformer or a default message
      if (tool.transformError) {
        try {
          const errorResult = tool.transformError(errorContent)

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
          throw new Error(`${toolId} API error: ${externalResponse.statusText}`)
        }
      } else {
        const error = errorContent.message || `${toolId} API error: ${externalResponse.statusText}`
        logger.error(`${toolId} error:`, { error })
        throw new Error(error)
      }
    }

    const transformResponse =
      tool.transformResponse ||
      (async (resp: Response) => ({
        success: true,
        output: await resp.json(),
      }))

    return await transformResponse(externalResponse)
  } catch (error: any) {
    return {
      success: false,
      output: {},
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Validates the tool and its parameters
 */
export function validateToolRequest(
  toolId: string,
  tool: ToolConfig | undefined,
  params: Record<string, any>
): void {
  if (!tool) {
    throw new Error(`Tool not found: ${toolId}`)
  }

  // Ensure all required parameters for tool call are provided
  // Note: optionalToolInput parameters are not checked here as they're optional
  for (const [paramName, paramConfig] of Object.entries(tool.params)) {
    if (paramConfig.requiredForToolCall && !(paramName in params)) {
      throw new Error(`Parameter "${paramName}" is required for ${toolId} but was not provided`)
    }
  }
}

// Check if we're running in the browser
function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Creates parameter schema from custom tool schema
 */
export function createParamSchema(customTool: any): Record<string, any> {
  const params: Record<string, any> = {}

  if (customTool.schema.function?.parameters?.properties) {
    const properties = customTool.schema.function.parameters.properties
    const required = customTool.schema.function.parameters.required || []
    const optionalToolInputs = customTool.schema.function.parameters.optionalToolInputs || []

    Object.entries(properties).forEach(([key, config]: [string, any]) => {
      const isRequired = required.includes(key)
      const isOptionalInput = optionalToolInputs.includes(key)

      // Create the base parameter configuration
      const paramConfig: Record<string, any> = {
        type: config.type || 'string',
        required: isRequired,
        requiredForToolCall: isRequired,
        description: config.description || '',
      }

      // Only add optionalToolInput if it's true to maintain backward compatibility with tests
      if (isOptionalInput) {
        paramConfig.optionalToolInput = true
      }

      params[key] = paramConfig
    })
  }

  return params
}

/**
 * Get environment variables from store (client-side only)
 * @param getStore Optional function to get the store (useful for testing)
 */
export function getClientEnvVars(getStore?: () => any): Record<string, string> {
  if (!isBrowser()) return {}

  try {
    // Allow injecting the store for testing
    const envStore = getStore ? getStore() : useEnvironmentStore.getState()
    const allEnvVars = envStore.getAllVariables()

    // Convert environment variables to a simple key-value object
    return Object.entries(allEnvVars).reduce(
      (acc, [key, variable]: [string, any]) => {
        acc[key] = variable.value
        return acc
      },
      {} as Record<string, string>
    )
  } catch (error) {
    // In case of any errors (like in testing), return empty object
    return {}
  }
}

/**
 * Creates the request body configuration for custom tools
 * @param customTool The custom tool configuration
 * @param isClient Whether running on client side
 * @param workflowId Optional workflow ID for server-side
 * @param getStore Optional function to get the store (useful for testing)
 */
export function createCustomToolRequestBody(
  customTool: any,
  isClient: boolean = true,
  workflowId?: string,
  getStore?: () => any
) {
  return (params: Record<string, any>) => {
    // Get environment variables - empty on server, from store on client
    const envVars = isClient ? getClientEnvVars(getStore) : {}

    // Include everything needed for execution
    return {
      code: customTool.code,
      params: params, // These will be available in the VM context
      schema: customTool.schema.function.parameters, // For validation
      envVars: envVars, // Environment variables
      workflowId: workflowId, // Pass workflowId for server-side context
      isCustomTool: true, // Flag to indicate this is a custom tool execution
    }
  }
}

// Get a tool by its ID
export function getTool(toolId: string): ToolConfig | undefined {
  // Check for built-in tools
  const builtInTool = tools[toolId]
  if (builtInTool) return builtInTool

  // Check if it's a custom tool
  if (toolId.startsWith('custom_') && typeof window !== 'undefined') {
    // Only try to use the sync version on the client
    const customToolsStore = useCustomToolsStore.getState()
    const identifier = toolId.replace('custom_', '')

    // Try to find the tool directly by ID first
    let customTool = customToolsStore.getTool(identifier)

    // If not found by ID, try to find by title (for backward compatibility)
    if (!customTool) {
      const allTools = customToolsStore.getAllTools()
      customTool = allTools.find((tool) => tool.title === identifier)
    }

    if (customTool) {
      return createToolConfig(customTool, toolId)
    }
  }

  // If not found or running on the server, return undefined
  return undefined
}

// Get a tool by its ID asynchronously (supports server-side)
export async function getToolAsync(
  toolId: string,
  workflowId?: string
): Promise<ToolConfig | undefined> {
  // Check for built-in tools
  const builtInTool = tools[toolId]
  if (builtInTool) return builtInTool

  // Check if it's a custom tool
  if (toolId.startsWith('custom_')) {
    return getCustomTool(toolId, workflowId)
  }

  return undefined
}

// Helper function to create a tool config from a custom tool
function createToolConfig(customTool: any, customToolId: string): ToolConfig {
  // Create a parameter schema from the custom tool schema
  const params = createParamSchema(customTool)

  // Create a tool config for the custom tool
  return {
    id: customToolId,
    name: customTool.title,
    description: customTool.schema.function?.description || '',
    version: '1.0.0',
    params,

    // Request configuration - for custom tools we'll use the execute endpoint
    request: {
      url: '/api/function/execute',
      method: 'POST',
      headers: () => ({ 'Content-Type': 'application/json' }),
      body: createCustomToolRequestBody(customTool, true),
      isInternalRoute: true,
    },

    // Direct execution support for browser environment with Freestyle
    directExecution: async (params: Record<string, any>) => {
      // If there's no code, we can't execute directly
      if (!customTool.code) {
        return {
          success: false,
          output: {},
          error: 'No code provided for tool execution',
        }
      }

      // Custom tools always execute server-side via /api/function/execute,
      // which goes through the CodeRunner dispatcher (Freestyle when configured,
      // QuickJS WASM otherwise). Returning undefined here makes the tool
      // framework fall through to that API route. The old browser-side
      // Freestyle branch was unreachable in practice — it required
      // `window.crossOriginIsolated`, which the app never opts into — and it
      // would have leaked the Freestyle API key into the client bundle.
      return undefined
    },

    // Standard response handling for custom tools
    transformResponse: async (response: Response, params: Record<string, any>) => {
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Custom tool execution failed')
      }

      return {
        success: true,
        output: data.output.result || data.output,
        error: undefined,
      }
    },
    transformError: async (error: any) =>
      `Custom tool execution error: ${error.message || 'Unknown error'}`,
  }
}

// Create a tool config from a custom tool definition
async function getCustomTool(
  customToolId: string,
  workflowId?: string
): Promise<ToolConfig | undefined> {
  const identifier = customToolId.replace('custom_', '')

  try {
    const url = getApiUrl('/api/tools/custom', workflowId ? { workflowId } : undefined)

    const response = await fetch(url)

    if (!response.ok) {
      logger.error(`Failed to fetch custom tools: ${response.statusText}`)
      return undefined
    }

    const result = await response.json()

    if (!result.data || !Array.isArray(result.data)) {
      logger.error(`Invalid response when fetching custom tools: ${JSON.stringify(result)}`)
      return undefined
    }

    // Try to find the tool by ID or title
    const customTool = result.data.find(
      (tool: any) => tool.id === identifier || tool.title === identifier
    )

    if (!customTool) {
      logger.error(`Custom tool not found: ${identifier}`)
      return undefined
    }

    // Create a parameter schema
    const params = createParamSchema(customTool)

    // Create a tool config for the custom tool
    return {
      id: customToolId,
      name: customTool.title,
      description: customTool.schema.function?.description || '',
      version: '1.0.0',
      params,

      // Request configuration - for custom tools we'll use the execute endpoint
      request: {
        url: '/api/function/execute',
        method: 'POST',
        headers: () => ({ 'Content-Type': 'application/json' }),
        body: createCustomToolRequestBody(customTool, false, workflowId),
        isInternalRoute: true,
      },

      // Same response handling as client-side
      transformResponse: async (response: Response, params: Record<string, any>) => {
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Custom tool execution failed')
        }

        return {
          success: true,
          output: data.output.result || data.output,
          error: undefined,
        }
      },
      transformError: async (error: any) =>
        `Custom tool execution error: ${error.message || 'Unknown error'}`,
    }
  } catch (error) {
    logger.error(`Error fetching custom tool ${identifier} from API:`, error)
    return undefined
  }
}
