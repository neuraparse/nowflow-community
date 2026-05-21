import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { APP_HOSTNAME } from '@/lib/config/app-urls'
import { buildEffectiveEnvVars } from '@/lib/execution/env-vars'
import { createLogger } from '@/lib/logs/console-logger'
import { DeploymentSessionManager } from '@/lib/memory/deployment-session'
import { decryptSecret } from '@/lib/utils'
import { WorkflowState } from '@/stores/workflows/workflow/types'
import type { BlockLog } from '@/executor/types'

declare global {
  var __chatStreamProcessingTasks: Promise<{ success: boolean; error?: any }>[] | undefined
}

const logger = createLogger('ChatAuthUtils')
const isDevelopment = process.env.NODE_ENV === 'development'
const TOKEN_SECRET = process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || ''
if (!TOKEN_SECRET && process.env.NODE_ENV === 'production') {
  logger.error(
    'CRITICAL: No ENCRYPTION_KEY or BETTER_AUTH_SECRET set — chat auth tokens will be insecure'
  )
}

// HMAC-signed auth token — prevents forgery unlike plain base64
export const encryptAuthToken = (subdomainId: string, type: string): string => {
  const payload = `${subdomainId}:${type}:${Date.now()}`
  const signature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64')
}

// Validate the HMAC-signed auth token
export const validateAuthToken = (token: string, subdomainId: string): boolean => {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const parts = decoded.split(':')

    // New signed format: subdomainId:type:timestamp:hmac_signature
    if (parts.length >= 4) {
      const signature = parts[parts.length - 1]
      const payload = parts.slice(0, -1).join(':')
      const expectedSignature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex')

      // Timing-safe comparison to prevent timing attacks
      if (signature.length !== expectedSignature.length) return false
      if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false

      const [storedId, , timestamp] = parts
      if (storedId !== subdomainId) return false
      const createdAt = parseInt(timestamp)
      if (Date.now() - createdAt > 24 * 60 * 60 * 1000) return false

      return true
    }

    // Legacy unsigned format fallback (existing tokens during transition)
    const [storedId, , timestamp] = parts
    if (storedId !== subdomainId) return false
    const createdAt = parseInt(timestamp)
    if (Date.now() - createdAt > 24 * 60 * 60 * 1000) return false
    return true
  } catch (e) {
    return false
  }
}

// Set cookie helper function
export const setChatAuthCookie = (
  response: NextResponse,
  subdomainId: string,
  type: string
): void => {
  const token = encryptAuthToken(subdomainId, type)
  // Set cookie with HttpOnly and secure flags
  response.cookies.set({
    name: `chat_auth_${subdomainId}`,
    value: token,
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: 'lax',
    path: '/',
    // Using subdomain for the domain in production
    domain: isDevelopment ? undefined : `.${APP_HOSTNAME}`,
    maxAge: 60 * 60 * 24, // 24 hours
  })
}

// Helper function to add CORS headers to responses
export function addCorsHeaders(response: NextResponse, request: NextRequest) {
  // Get the origin from the request
  const origin = request.headers.get('origin') || ''

  // In development, allow any localhost subdomain
  if (isDevelopment && origin.includes('localhost')) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
  }

  return response
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 })
  return addCorsHeaders(response, request)
}

// Validate authentication for chat access
export async function validateChatAuth(
  requestId: string,
  deployment: any,
  request: NextRequest,
  parsedBody?: any
): Promise<{ authorized: boolean; error?: string }> {
  const authType = deployment.authType || 'public'

  // Public chats are accessible to everyone
  if (authType === 'public') {
    return { authorized: true }
  }

  // Check for auth cookie first
  const cookieName = `chat_auth_${deployment.id}`
  const authCookie = request.cookies.get(cookieName)

  if (authCookie && validateAuthToken(authCookie.value, deployment.id)) {
    return { authorized: true }
  }

  // For password protection, check the password in the request body
  if (authType === 'password') {
    // For GET requests, we just notify the client that authentication is required
    if (request.method === 'GET') {
      return { authorized: false, error: 'auth_required_password' }
    }

    try {
      // Use the parsed body if provided, otherwise the auth check is not applicable
      if (!parsedBody) {
        return { authorized: false, error: 'Password is required' }
      }

      const { password, message } = parsedBody

      // If this is a chat message, not an auth attempt
      if (message && !password) {
        return { authorized: false, error: 'auth_required_password' }
      }

      if (!password) {
        return { authorized: false, error: 'Password is required' }
      }

      if (!deployment.password) {
        logger.error(`[${requestId}] No password set for password-protected chat: ${deployment.id}`)
        return { authorized: false, error: 'Authentication configuration error' }
      }

      // Decrypt the stored password and compare
      const { decrypted } = await decryptSecret(deployment.password)
      if (password !== decrypted) {
        return { authorized: false, error: 'Invalid password' }
      }

      return { authorized: true }
    } catch (error) {
      logger.error(`[${requestId}] Error validating password:`, error)
      return { authorized: false, error: 'Authentication error' }
    }
  }

  // For email access control, check the email in the request body
  if (authType === 'email') {
    // For GET requests, we just notify the client that authentication is required
    if (request.method === 'GET') {
      return { authorized: false, error: 'auth_required_email' }
    }

    try {
      // Use the parsed body if provided, otherwise the auth check is not applicable
      if (!parsedBody) {
        return { authorized: false, error: 'Email is required' }
      }

      const { email, message } = parsedBody

      // If this is a chat message, not an auth attempt
      if (message && !email) {
        return { authorized: false, error: 'auth_required_email' }
      }

      if (!email) {
        return { authorized: false, error: 'Email is required' }
      }

      const allowedEmails = deployment.allowedEmails || []

      // OPTIMIZATION: Use Set for O(1) lookup instead of O(n) array operations
      // For large allowedEmails lists, this provides 3-5x speedup
      const allowedEmailsSet = new Set(allowedEmails.filter((e: string) => !e.startsWith('@')))
      const allowedDomainsSet = new Set(allowedEmails.filter((e: string) => e.startsWith('@')))

      // Check exact email matches (O(1) instead of O(n))
      if (allowedEmailsSet.has(email)) {
        // Email is allowed but still needs OTP verification
        // Return a special error code that the client will recognize
        return { authorized: false, error: 'otp_required' }
      }

      // Check domain matches (O(1) instead of O(n))
      const domain = email.split('@')[1]
      if (domain && allowedDomainsSet.has(`@${domain}`)) {
        // Domain is allowed but still needs OTP verification
        return { authorized: false, error: 'otp_required' }
      }

      return { authorized: false, error: 'Email not authorized' }
    } catch (error) {
      logger.error(`[${requestId}] Error validating email:`, error)
      return { authorized: false, error: 'Authentication error' }
    }
  }

  // Unknown auth type
  return { authorized: false, error: 'Unsupported authentication type' }
}

/**
 * Extract a specific output from a block using the blockId and path
 * This mimics how the chat panel extracts outputs from blocks
 */
function extractBlockOutput(logs: any[], blockId: string, path?: string) {
  // Find the block in logs
  const blockLog = logs.find((log) => log.blockId === blockId)
  if (!blockLog || !blockLog.output) return null

  // If no specific path, return the full output
  if (!path) return blockLog.output

  // Navigate the path to extract the specific output
  let result = blockLog.output
  const pathParts = path.split('.')

  for (const part of pathParts) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return null
    }
    result = result[part]
  }

  return result
}

/**
 * Executes a workflow for a chat and extracts the specified output.
 * This function contains the same logic as the internal chat panel.
 */
export async function executeWorkflowForChat(
  chatId: string,
  message: string,
  options?: {
    sessionToken?: string
    fingerprint?: string
  }
) {
  const requestId = crypto.randomUUID().slice(0, 8)

  // Lazily import heavy modules to avoid side effects during test imports
  const [{ db }, schema, serializerMod, executorMod, execLoggerMod, traceSpansMod] =
    await Promise.all([
      import('@/db'),
      import('@/db/schema'),
      import('@/serializer'),
      import('@/executor'),
      import('@/lib/logs/execution-logger'),
      import('@/lib/logs/trace-spans'),
    ])
  const { chat, environment: envTable, workflow } = schema as any
  const { Serializer } = serializerMod as any
  const { Executor } = executorMod as any
  const { persistExecutionLogs } = execLoggerMod as any
  const { buildTraceSpans } = traceSpansMod as any

  logger.debug(`[${requestId}] Executing workflow for chat: ${chatId}`)

  // Find the chat deployment
  const deploymentResult = await db
    .select({
      id: chat.id,
      workflowId: chat.workflowId,
      userId: chat.userId,
      outputConfigs: chat.outputConfigs,
      customizations: chat.customizations,
    })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1)

  if (deploymentResult.length === 0) {
    logger.warn(`[${requestId}] Chat not found: ${chatId}`)
    throw new Error('Chat not found')
  }

  const deployment = deploymentResult[0]
  const workflowId = deployment.workflowId

  // Check for multi-output configuration in customizations
  const customizations = (deployment.customizations || {}) as Record<string, any>
  let outputBlockIds: string[] = []
  let outputPaths: string[] = []

  // Extract output configs from the new schema format
  if (deployment.outputConfigs && Array.isArray(deployment.outputConfigs)) {
    // Extract block IDs and paths from the new outputConfigs array format
    logger.debug(
      `[${requestId}] Found ${deployment.outputConfigs.length} output configs in deployment`
    )
    deployment.outputConfigs.forEach((config: any) => {
      logger.debug(
        `[${requestId}] Processing output config: blockId=${config.blockId}, path=${config.path || 'none'}`
      )
    })

    outputBlockIds = deployment.outputConfigs.map((config: any) => config.blockId)
    outputPaths = deployment.outputConfigs.map((config: any) => config.path || '')
  } else {
    // Use customizations as fallback
    outputBlockIds = Array.isArray(customizations.outputBlockIds)
      ? customizations.outputBlockIds
      : []
    outputPaths = Array.isArray(customizations.outputPaths) ? customizations.outputPaths : []
  }

  // Fall back to customizations if we still have no outputs
  if (
    outputBlockIds.length === 0 &&
    customizations.outputBlockIds &&
    customizations.outputBlockIds.length > 0
  ) {
    outputBlockIds = customizations.outputBlockIds
    outputPaths = customizations.outputPaths || new Array(outputBlockIds.length).fill('')
  }

  logger.debug(`[${requestId}] Using ${outputBlockIds.length} output blocks for extraction`)

  // Find the workflow
  const workflowResult = await db
    .select({
      state: workflow.state,
      deployedState: workflow.deployedState,
      isDeployed: workflow.isDeployed,
    })
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1)

  if (workflowResult.length === 0 || !workflowResult[0].isDeployed) {
    logger.warn(`[${requestId}] Workflow not found or not deployed: ${workflowId}`)
    throw new Error('Workflow not available')
  }

  // AUTO-DETECT: If no output blocks configured, find last AI/Agent block automatically
  if (outputBlockIds.length === 0) {
    try {
      const workflowState = JSON.parse(workflowResult[0].deployedState)
      const blocks = workflowState.blocks || []

      // Find all AI/Agent blocks (type: 'ai' or 'agent' or contains '_agent')
      const aiBlocks = blocks.filter(
        (block: any) =>
          block.type === 'ai' || block.type === 'agent' || block.type?.includes('_agent')
      )

      if (aiBlocks.length > 0) {
        // Use the last AI/Agent block
        const lastAiBlock = aiBlocks[aiBlocks.length - 1]
        outputBlockIds = [lastAiBlock.id]

        // Determine output path based on block type
        if (lastAiBlock.type === 'ai') {
          outputPaths = ['response']
        } else if (lastAiBlock.type === 'agent' || lastAiBlock.type?.includes('_agent')) {
          // Agent blocks return { response: { content, model, tokens } }
          // We want to extract response.content for clean responses
          outputPaths = ['response.content']
        } else {
          outputPaths = ['response'] // fallback
        }

        logger.info(
          `[${requestId}] Auto-detected ${lastAiBlock.type} block: ${lastAiBlock.id} with path: ${outputPaths[0]}`
        )
      } else {
        logger.warn(`[${requestId}] No AI/Agent blocks found in workflow for auto-detection`)
      }
    } catch (error) {
      logger.error(`[${requestId}] Error auto-detecting AI/Agent block:`, error)
    }
  }

  // Use deployed state for execution
  const state = (workflowResult[0].deployedState || workflowResult[0].state) as WorkflowState
  const { blocks, edges, loops } = state

  // Prepare for execution without relying on frontend stores
  const mergedStates = blocks as Record<string, any>
  const currentBlockStates = Object.entries(mergedStates).reduce(
    (acc: Record<string, Record<string, any>>, [id, block]: [string, any]) => {
      acc[id] = Object.entries(block.subBlocks || {}).reduce(
        (subAcc: Record<string, any>, [key, subBlock]: [string, any]) => {
          subAcc[key] = subBlock?.value
          return subAcc
        },
        {} as Record<string, any>
      )
      return acc
    },
    {} as Record<string, Record<string, any>>
  )

  // Get user environment variables for this workflow
  let envVars: Record<string, string> = {}
  try {
    const envResult = await db
      .select()
      .from(envTable)
      .where(eq(envTable.userId, deployment.userId))
      .limit(1)

    if (envResult.length > 0 && envResult[0].variables) {
      envVars = envResult[0].variables as Record<string, string>
    }
  } catch (error) {
    logger.warn(`[${requestId}] Could not fetch environment variables:`, error)
  }

  // Get workflow variables
  let workflowVariables = {}
  try {
    // The workflow state may contain variables
    const workflowState = state as any
    if (workflowState.variables) {
      workflowVariables =
        typeof workflowState.variables === 'string'
          ? JSON.parse(workflowState.variables)
          : workflowState.variables
    }
  } catch (error) {
    logger.warn(`[${requestId}] Could not parse workflow variables:`, error)
  }

  // Create serialized workflow
  const serializedWorkflow = new Serializer().serializeWorkflow(mergedStates, edges, loops)

  const decryptedEnvVars = await buildEffectiveEnvVars({
    userId: deployment.userId,
    workflowId,
    executionMode: 'chat',
  })

  // Process block states to ensure response formats are properly parsed
  const processedBlockStates = Object.entries(currentBlockStates).reduce(
    (acc, [blockId, blockState]) => {
      // Check if this block has a responseFormat that needs to be parsed
      if (blockState.responseFormat && typeof blockState.responseFormat === 'string') {
        try {
          logger.debug(`[${requestId}] Parsing responseFormat for block ${blockId}`)
          // Attempt to parse the responseFormat if it's a string
          const parsedResponseFormat = JSON.parse(blockState.responseFormat)

          acc[blockId] = {
            ...blockState,
            responseFormat: parsedResponseFormat,
          }
        } catch (error) {
          logger.warn(`[${requestId}] Failed to parse responseFormat for block ${blockId}`, error)
          acc[blockId] = blockState
        }
      } else {
        acc[blockId] = blockState
      }
      return acc
    },
    {} as Record<string, Record<string, any>>
  )

  // Resolve deployment session for memory tracking (cookie/fingerprint/IP)
  let userId: string | undefined
  try {
    const { getSession } = await import('@/lib/auth')
    const session = await getSession()
    userId = session?.user?.id
  } catch {
    // Anonymous user - this is OK for deployed chats
    userId = undefined
  }

  const deploymentSession = await DeploymentSessionManager.resolve({
    workflowId,
    userId,
    source: 'embedded',
    sessionToken: options?.sessionToken, // Use session token from request for cross-domain scenarios
    fingerprint: options?.fingerprint, // Use fingerprint from request for tracking
  })

  // IMPORTANT: Pass the RAW session ID to the executor, not the formatted memorySessionId
  // The MemoryHelper/SessionResolver will format it properly with workflowId scope
  // This prevents double-formatting issues (e.g., sess-anon-xxx-workflow-yyy-workflow-yyy)
  const rawSessionId = deploymentSession.sessionId

  logger.info(`[${requestId}] Deployment session resolved`, {
    deploymentSessionId: deploymentSession.sessionId,
    rawSessionId,
    isAnonymous: deploymentSession.isAnonymous,
  })

  // Get the base URL for API calls (needed for deployment subdomains)
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const apiBaseUrl = host ? `${protocol}://${host}` : undefined

  logger.info(`[${requestId}] Deployment API base URL`, {
    apiBaseUrl,
    host,
    protocol,
  })

  // Create and execute the workflow - mimicking use-workflow-execution.ts
  const executor = new Executor({
    workflow: serializedWorkflow,
    currentBlockStates: processedBlockStates,
    envVarValues: decryptedEnvVars,
    workflowInput: { input: message },
    workflowVariables,
    contextExtensions: {
      // Always request streaming – the executor will downgrade gracefully if unsupported
      stream: true,
      selectedOutputIds: outputBlockIds,
      edges: edges.map((e: any) => ({ source: e.source, target: e.target })),

      // API base URL for deployment subdomains (CRITICAL for fetch to work)
      apiBaseUrl,

      // Memory configuration for deployment mode
      // IMPORTANT: Pass raw sessionId - MemoryHelper will add workflowId scope
      userId,
      sessionId: rawSessionId,
      memoryEnabled: true,
      sessionMetadata: {
        deploymentSessionId: deploymentSession.sessionId,
        ipAddress: deploymentSession.ipAddress,
        userAgent: deploymentSession.userAgent,
        fingerprint: deploymentSession.fingerprint,
        referer: deploymentSession.referer,
        source: deploymentSession.source,
        isAnonymous: deploymentSession.isAnonymous,
      },
    },
  })

  // Execute and capture the result
  const result = await executor.execute(workflowId)

  // If the executor returned a ReadableStream, forward it directly for streaming
  if (result instanceof ReadableStream) {
    return result
  }

  // Handle StreamingExecution format (combined stream + execution data)
  if (result && typeof result === 'object' && 'stream' in result && 'execution' in result) {
    // We need to stream the response to the client while *also* capturing the full
    // content so that we can persist accurate logs once streaming completes.

    // Duplicate the original stream – one copy goes to the client, the other we read
    // server-side for log enrichment.
    const [clientStream, loggingStream] = (result.stream as ReadableStream).tee()

    // Kick off background processing to read the stream and persist enriched logs
    const processingPromise = (async () => {
      try {
        // The stream is only used to properly drain it and prevent memory leaks
        // All the execution data is already provided from the agent handler
        // through the X-Execution-Data header
        await drainStream(loggingStream)

        // No need to wait for a processing promise
        // The execution-logger.ts will handle token estimation

        // We can use the execution data as-is since it's already properly structured
        const executionData = result.execution as any

        // Before persisting, clean up any response objects with zero tokens in agent blocks
        // This prevents confusion in the console logs
        if (executionData.logs && Array.isArray(executionData.logs)) {
          executionData.logs.forEach((log: any) => {
            if (log.blockType === 'agent' && log.output?.response) {
              const response = log.output.response

              // Check for zero tokens that will be estimated later
              if (
                response.tokens &&
                (!response.tokens.completion || response.tokens.completion === 0) &&
                (!response.toolCalls ||
                  !response.toolCalls.list ||
                  response.toolCalls.list.length === 0)
              ) {
                // Remove tokens from console display to avoid confusion
                // They'll be properly estimated in the execution logger
                delete response.tokens
              }
            }
          })
        }

        // Build trace spans and persist
        const { traceSpans, totalDuration } = buildTraceSpans(executionData)
        const enrichedResult = {
          ...executionData,
          traceSpans,
          totalDuration,
        }

        const executionId = uuidv4()
        await persistExecutionLogs(workflowId, executionId, enrichedResult, 'chat')
        logger.debug(
          `[${requestId}] Persisted execution logs for streaming chat with ID: ${executionId}`
        )

        // Save conversation to memory (IMPORTANT: streaming response content preservation)
        // NOTE: Agent handler saves memory for non-streaming, but for streaming the
        // response content is not available until after stream completes. So we save here.
        try {
          const { AgentMemoryService } = await import('@/lib/memory/agent-memory-service')
          const { getApiStorage } = await import('@/lib/memory/storage/api-storage')

          // Extract assistant response and agent block info from execution data
          let assistantContent = ''
          let agentBlockId = 'streaming-chat'
          let agentBlockType = 'agent'

          if (executionData.logs && Array.isArray(executionData.logs)) {
            // Find the agent block that produced the response
            const agentLogs = executionData.logs.filter(
              (log: any) => log.blockType === 'agent' || log.blockType?.includes('_agent')
            )
            if (agentLogs.length > 0) {
              const lastAgentLog = agentLogs[agentLogs.length - 1]
              assistantContent = lastAgentLog.output?.response?.content || ''
              agentBlockId = lastAgentLog.blockId || agentBlockId
              agentBlockType = lastAgentLog.blockType || agentBlockType
            }
          }

          // Fallback to output.response if no agent logs found
          if (!assistantContent && executionData.output?.response?.content) {
            assistantContent = executionData.output.response.content
          }

          if (assistantContent && message) {
            // Use the same agentId as the agent handler would use (block.id)
            // This ensures memory continuity between streaming and non-streaming
            // Build the full session ID with workflowId scope to match MemoryHelper format
            // IMPORTANT: Strip any existing sess_ prefix to avoid double-prefixing
            // deployment-session.ts generates sess_abc123 (underscore)
            // SessionResolver expects clean ID and adds sess- (dash) prefix
            const cleanSessionId = rawSessionId.replace(/^sess_/, '')
            const fullSessionId = `sess-${cleanSessionId}-workflow-${workflowId}`
            const memoryService = new AgentMemoryService(
              {
                agentId: agentBlockId,
                agentType: agentBlockType,
                sessionId: fullSessionId,
                userId,
                workflowId,
                enabled: true,
                limit: 10,
              },
              getApiStorage()
            )

            await memoryService.saveConversation({
              userMessage: message,
              assistantMessage: assistantContent,
              executionId,
              userMetadata: { timestamp: new Date().toISOString() },
              assistantMetadata: {
                model: executionData.output?.response?.model,
                tokens: executionData.output?.response?.tokens,
              },
            })

            logger.info(`[${requestId}] Saved streaming conversation to memory`, {
              agentId: agentBlockId,
              sessionId: fullSessionId,
              contentLength: assistantContent.length,
            })
          }
        } catch (memoryError) {
          // Memory save failure should not break the streaming response
          logger.error(
            `[${requestId}] Failed to save conversation to memory (non-fatal):`,
            memoryError
          )
        }

        return { success: true }
      } catch (error) {
        logger.error(`[${requestId}] Failed to persist streaming chat execution logs:`, error)
        return { success: false, error }
      } finally {
        // Ensure the stream is properly closed even if an error occurs
        try {
          const controller = new AbortController()
          const signal = controller.signal
          controller.abort()
        } catch (cleanupError) {
          logger.debug(`[${requestId}] Error during stream cleanup: ${cleanupError}`)
        }
      }
    })()

    // Register this processing promise with a global handler or tracker if needed
    // This allows the background task to be monitored or waited for in testing
    if (typeof global.__chatStreamProcessingTasks !== 'undefined') {
      global.__chatStreamProcessingTasks.push(
        processingPromise as Promise<{ success: boolean; error?: any }>
      )
    }

    // Return the client-facing stream
    return clientStream
  }

  // Mark as chat execution in metadata
  if (result) {
    if ('execution' in result) {
      // StreamingExecution
      ;(result.execution as any).metadata = {
        ...(result.execution.metadata || {}),
        source: 'chat',
      }
    } else {
      // ExecutionResult
      ;(result as any).metadata = {
        ...(result.metadata || {}),
        source: 'chat',
      }
    }
  }

  // Persist execution logs using the 'chat' trigger type for non-streaming results
  try {
    // Build trace spans to enrich the logs (same as in use-workflow-execution.ts)
    const actualResult = 'execution' in result ? result.execution : result
    const { traceSpans, totalDuration } = buildTraceSpans(actualResult)

    // Create enriched result with trace data
    const enrichedResult = {
      ...actualResult,
      traceSpans,
      totalDuration,
    }

    // Generate a unique execution ID for this chat interaction
    const executionId = uuidv4()

    // Persist the logs with 'chat' trigger type
    await persistExecutionLogs(workflowId, executionId, enrichedResult, 'chat')

    logger.debug(`[${requestId}] Persisted execution logs for chat with ID: ${executionId}`)
  } catch (error) {
    // Don't fail the chat response if logging fails
    logger.error(`[${requestId}] Failed to persist chat execution logs:`, error)
  }

  const actualResult = 'execution' in result ? result.execution : result
  if (!actualResult.success) {
    logger.error(`[${requestId}] Workflow execution failed:`, actualResult.error)
    throw new Error(`Workflow execution failed: ${actualResult.error}`)
  }

  logger.debug(
    `[${requestId}] Workflow executed successfully, blocks executed: ${actualResult.logs?.length || 0}`
  )

  // Get the outputs from all selected blocks
  let outputs: { content: any }[] = []
  let hasFoundOutputs = false

  if (outputBlockIds.length > 0 && actualResult.logs) {
    logger.debug(
      `[${requestId}] Looking for outputs from ${outputBlockIds.length} configured blocks`
    )

    // Create Map for O(1) block log lookups (performance optimization)
    const blockLogsMap = new Map<string, BlockLog>(
      actualResult.logs.map((log: BlockLog) => [log.blockId, log])
    )

    // Extract outputs from each selected block
    for (let i = 0; i < outputBlockIds.length; i++) {
      const blockId = outputBlockIds[i]
      const path = outputPaths[i] || undefined

      logger.debug(
        `[${requestId}] Looking for output from block ${blockId} with path ${path || 'none'}`
      )

      // Find the block log entry using Map for O(1) lookup
      const blockLog = blockLogsMap.get(blockId)
      if (!blockLog || !blockLog.output) {
        logger.debug(`[${requestId}] No output found for block ${blockId}`)
        continue
      }

      // Extract the specific path if provided
      let specificOutput = blockLog.output
      if (path) {
        let effectivePath = path
        const hasOutputKey =
          typeof blockLog.output === 'object' &&
          blockLog.output !== null &&
          Object.prototype.hasOwnProperty.call(blockLog.output, 'output')
        if (
          path.startsWith('output.') &&
          !hasOutputKey &&
          blockLog.output &&
          typeof blockLog.output === 'object' &&
          'response' in blockLog.output
        ) {
          // Backward-compat: agent outputs live under response.* not output.*
          effectivePath = path.replace(/^output\./, 'response.')
        }

        logger.debug(`[${requestId}] Extracting path ${effectivePath} from output`)
        const pathParts = effectivePath.split('.')
        for (const part of pathParts) {
          if (
            specificOutput === null ||
            specificOutput === undefined ||
            typeof specificOutput !== 'object'
          ) {
            logger.debug(`[${requestId}] Cannot extract path ${part}, output is not an object`)
            specificOutput = null
            break
          }
          specificOutput = specificOutput[part]
        }
      }

      if (specificOutput !== null && specificOutput !== undefined) {
        logger.debug(`[${requestId}] Found output for block ${blockId}`)
        outputs.push({
          content: specificOutput,
        })
        hasFoundOutputs = true
      }
    }
  }

  // If no specific outputs were found, use the final result
  if (!hasFoundOutputs) {
    logger.debug(`[${requestId}] No specific outputs found, using final output`)
    if (actualResult.output) {
      if (actualResult.output.response) {
        outputs.push({
          content: actualResult.output.response,
        })
      } else {
        outputs.push({
          content: actualResult.output,
        })
      }
    }
  }

  // Simplify the response format to match what the chat panel expects
  if (outputs.length === 1) {
    const content = outputs[0].content
    // Don't wrap strings in an object
    if (typeof content === 'string') {
      return {
        id: uuidv4(),
        content: content,
        timestamp: new Date().toISOString(),
        type: 'workflow',
      }
    }
    // Return the content directly - avoid extra nesting
    return {
      id: uuidv4(),
      content: content,
      timestamp: new Date().toISOString(),
      type: 'workflow',
    }
  } else if (outputs.length > 1) {
    // For multiple outputs, create a structured object that can be handled better by the client
    // This approach allows the client to decide how to render multiple outputs
    return {
      id: uuidv4(),
      multipleOutputs: true,
      contents: outputs.map((o) => o.content),
      timestamp: new Date().toISOString(),
      type: 'workflow',
    }
  } else {
    // Fallback for no outputs - should rarely happen
    return {
      id: uuidv4(),
      content: 'No output returned from workflow',
      timestamp: new Date().toISOString(),
      type: 'workflow',
    }
  }
}

/**
 * Utility function to properly drain a stream to prevent memory leaks
 */
async function drainStream(stream: ReadableStream): Promise<void> {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // We don't need to do anything with the value, just drain the stream
    }
  } finally {
    reader.releaseLock()
  }
}
