import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { buildEffectiveEnvVars } from '@/lib/execution/env-vars'
import { createLogger } from '@/lib/logs/console-logger'
import { persistExecutionError, persistExecutionLogs } from '@/lib/logs/execution-logger'
import { buildTraceSpans } from '@/lib/logs/trace-spans'
import { updateWorkflowRunCounts } from '@/lib/workflows/utils'
import { mergeSubblockStateAsync } from '@/stores/workflows/utils'
import { db } from '@/db'
import { userStats } from '@/db/schema'
import { Executor } from '@/executor'
import { Serializer } from '@/serializer'

const logger = createLogger('WebhookWorkflowExecution')

/**
 * Format webhook input based on provider
 */
export function formatWebhookInput(
  foundWebhook: any,
  foundWorkflow: any,
  body: any,
  request: NextRequest
): any {
  if (foundWebhook.provider === 'whatsapp') {
    // WhatsApp input formatting logic
    const data = body?.entry?.[0]?.changes?.[0]?.value
    const messages = data?.messages || []

    if (messages.length > 0) {
      const message = messages[0]
      const phoneNumberId = data.metadata?.phone_number_id
      const from = message.from
      const messageId = message.id
      const timestamp = message.timestamp
      const text = message.text?.body

      return {
        whatsapp: {
          data: {
            messageId,
            from,
            phoneNumberId,
            text,
            timestamp,
            raw: message,
          },
        },
        webhook: {
          data: {
            provider: 'whatsapp',
            path: foundWebhook.path,
            providerConfig: foundWebhook.providerConfig,
            payload: body,
            headers: Object.fromEntries(request.headers.entries()),
            method: request.method,
          },
        },
        workflowId: foundWorkflow.id,
      }
    } else {
      return null
    }
  } else {
    // Generic format for Slack and other providers
    return {
      webhook: {
        data: {
          path: foundWebhook.path,
          provider: foundWebhook.provider,
          providerConfig: foundWebhook.providerConfig,
          payload: body,
          headers: Object.fromEntries(request.headers.entries()),
          method: request.method,
        },
      },
      workflowId: foundWorkflow.id,
    }
  }
}

/**
 * Execute workflow with the provided input
 */
export async function executeWorkflowFromPayload(
  foundWorkflow: any,
  input: any,
  executionId: string,
  requestId: string
): Promise<void> {
  // Add log at the beginning of this function for clarity
  logger.info(`[${requestId}] Preparing to execute workflow`, {
    workflowId: foundWorkflow.id,
    executionId,
    triggerSource: 'webhook-payload',
  })

  // DEBUG: Log specific payload details
  if (input?.airtableChanges) {
    logger.debug(`[${requestId}] TRACE: Execution received Airtable input`, {
      changeCount: input.airtableChanges.length,
      firstTableId: input.airtableChanges[0]?.tableId,
      timestamp: new Date().toISOString(),
    })
  }

  // Validate and ensure proper input structure
  if (!input) {
    logger.warn(`[${requestId}] Empty input for workflow execution, creating empty object`)
    input = {}
  }

  // Special handling for Airtable webhook inputs
  if (input.airtableChanges) {
    if (!Array.isArray(input.airtableChanges)) {
      logger.warn(
        `[${requestId}] Invalid airtableChanges input type (${typeof input.airtableChanges}), converting to array`
      )
      // Force to array if somehow not an array
      input.airtableChanges = [input.airtableChanges]
    }

    // Log the structure of the payload for debugging
    logger.info(`[${requestId}] Airtable webhook payload:`, {
      changeCount: input.airtableChanges.length,
      hasAirtableChanges: true,
      sampleTableIds: input.airtableChanges.slice(0, 2).map((c: any) => c.tableId),
    })
  }

  // Log the full input format to help diagnose data issues
  logger.debug(`[${requestId}] Workflow input format:`, {
    inputKeys: Object.keys(input || {}),
    hasAirtableChanges: input && input.airtableChanges && Array.isArray(input.airtableChanges),
    airtableChangesCount: input?.airtableChanges?.length || 0,
  })

  // Returns void as errors are handled internally
  try {
    // Get the workflow state
    if (!foundWorkflow.state) {
      logger.error(`[${requestId}] TRACE: Missing workflow state`, {
        workflowId: foundWorkflow.id,
        hasState: false,
      })
      throw new Error(`Workflow ${foundWorkflow.id} has no state`)
    }
    const state = foundWorkflow.state as any
    const { blocks, edges, loops } = state

    // DEBUG: Log state information
    logger.debug(`[${requestId}] TRACE: Retrieved workflow state`, {
      workflowId: foundWorkflow.id,
      blockCount: Object.keys(blocks || {}).length,
      edgeCount: (edges || []).length,
      loopCount: (loops || []).length,
    })

    logger.debug(
      `[${requestId}] Merging subblock states for workflow ${foundWorkflow.id} (Execution: ${executionId})`
    )

    const mergeStartTime = Date.now()
    const mergedStates = await mergeSubblockStateAsync(blocks, foundWorkflow.id)
    logger.debug(`[${requestId}] TRACE: State merging complete`, {
      duration: `${Date.now() - mergeStartTime}ms`,
      mergedBlockCount: Object.keys(mergedStates).length,
    })

    const envStartTime = Date.now()
    const decryptedEnvVars = await buildEffectiveEnvVars({
      userId: foundWorkflow.userId,
      workflowId: foundWorkflow.id,
      executionMode: 'webhook',
      extra: {
        WEBHOOK_TRIGGER: 'true',
      },
    })

    logger.debug(`[${requestId}] TRACE: Environment variables resolved`, {
      duration: `${Date.now() - envStartTime}ms`,
      envVarCount: Object.keys(decryptedEnvVars).length,
    })

    // Process block states (extract subBlock values, parse responseFormat)
    const blockStatesStartTime = Date.now()
    const currentBlockStates = Object.entries(mergedStates).reduce(
      (acc, [id, block]) => {
        acc[id] = Object.entries(block.subBlocks).reduce(
          (subAcc, [key, subBlock]) => {
            subAcc[key] = subBlock.value
            return subAcc
          },
          {} as Record<string, any>
        )
        return acc
      },
      {} as Record<string, Record<string, any>>
    )

    const processedBlockStates = Object.entries(currentBlockStates).reduce(
      (acc, [blockId, blockState]) => {
        const processedState = { ...blockState }
        if (processedState.responseFormat) {
          try {
            if (typeof processedState.responseFormat === 'string') {
              processedState.responseFormat = JSON.parse(processedState.responseFormat)
            }
            if (
              processedState.responseFormat &&
              typeof processedState.responseFormat === 'object'
            ) {
              if (!processedState.responseFormat.schema && !processedState.responseFormat.name) {
                processedState.responseFormat = {
                  name: 'response_schema',
                  schema: processedState.responseFormat,
                  strict: true,
                }
              }
            }
            acc[blockId] = processedState
          } catch (error) {
            logger.warn(
              `[${requestId}] Failed to parse responseFormat for block ${blockId} (Execution: ${executionId})`,
              error
            )
            acc[blockId] = blockState
          }
        } else {
          acc[blockId] = blockState
        }
        return acc
      },
      {} as Record<string, Record<string, any>>
    )

    // DEBUG: Log block state processing
    logger.debug(`[${requestId}] TRACE: Block states processed`, {
      duration: `${Date.now() - blockStatesStartTime}ms`,
      blockCount: Object.keys(processedBlockStates).length,
    })

    // Serialize and get workflow variables
    const serializeStartTime = Date.now()
    const serializedWorkflow = new Serializer().serializeWorkflow(mergedStates as any, edges, loops)
    let workflowVariables = {}
    if (foundWorkflow.variables) {
      try {
        if (typeof foundWorkflow.variables === 'string') {
          workflowVariables = JSON.parse(foundWorkflow.variables)
        } else {
          workflowVariables = foundWorkflow.variables
        }
      } catch (error) {
        logger.error(
          `[${requestId}] Failed to parse workflow variables: ${foundWorkflow.id} (Execution: ${executionId})`,
          error
        )
      }
    }

    // DEBUG: Log serialization completion
    logger.debug(`[${requestId}] TRACE: Workflow serialized`, {
      duration: `${Date.now() - serializeStartTime}ms`,
      hasWorkflowVars: Object.keys(workflowVariables).length > 0,
    })

    logger.debug(`[${requestId}] Starting workflow execution`, {
      executionId,
      blockCount: Object.keys(processedBlockStates).length,
    })

    // Log blocks for debugging (if any missing or invalid)
    if (Object.keys(processedBlockStates).length === 0) {
      logger.error(`[${requestId}] No blocks found in workflow state - this will likely fail`)
    } else {
      logger.debug(`[${requestId}] Block IDs for execution:`, {
        blockIds: Object.keys(processedBlockStates).slice(0, 5), // Log just a few block IDs for debugging
        totalBlocks: Object.keys(processedBlockStates).length,
      })
    }

    // Ensure workflow variables exist
    if (!workflowVariables || Object.keys(workflowVariables).length === 0) {
      logger.debug(`[${requestId}] No workflow variables defined, using empty object`)
      workflowVariables = {}
    }

    // Validate input format for Airtable webhooks to prevent common errors
    if (
      input?.airtableChanges &&
      (!Array.isArray(input.airtableChanges) || input.airtableChanges.length === 0)
    ) {
      logger.warn(
        `[${requestId}] Invalid Airtable input format - airtableChanges should be a non-empty array`
      )
    }

    // DEBUG: Log critical moment before executor creation
    logger.info(`[${requestId}] TRACE: Creating workflow executor`, {
      workflowId: foundWorkflow.id,
      hasSerializedWorkflow: !!serializedWorkflow,
      blockCount: Object.keys(processedBlockStates).length,
      timestamp: new Date().toISOString(),
    })

    // Use new Executor constructor with options object for A/B experiment support
    const executor = new Executor({
      workflow: serializedWorkflow,
      currentBlockStates: processedBlockStates,
      envVarValues: decryptedEnvVars,
      workflowInput: input, // Use the provided input (might be single event or batch)
      workflowVariables,
      workflowState: state, // Pass full workflow state for experiment overrides
    })

    // Log workflow execution start time for tracking
    const executionStartTime = Date.now()
    logger.info(`[${requestId}] TRACE: Executor instantiated, starting workflow execution now`, {
      workflowId: foundWorkflow.id,
      timestamp: new Date().toISOString(),
    })

    // Add direct detailed logging right before executing
    logger.info(
      `[${requestId}] EXECUTION_MONITOR: About to call executor.execute() - CRITICAL POINT`,
      {
        workflowId: foundWorkflow.id,
        executionId: executionId,
        timestamp: new Date().toISOString(),
      }
    )

    // This is THE critical line where the workflow actually executes
    const result = await executor.execute(foundWorkflow.id)

    // Check if we got a StreamingExecution result (with stream + execution properties)
    // For webhook executions, we only care about the ExecutionResult part, not the stream
    const executionResult = 'stream' in result && 'execution' in result ? result.execution : result

    // Add direct detailed logging right after executing
    logger.info(`[${requestId}] EXECUTION_MONITOR: executor.execute() completed with result`, {
      workflowId: foundWorkflow.id,
      executionId: executionId,
      success: executionResult.success,
      resultType: result ? typeof result : 'undefined',
      timestamp: new Date().toISOString(),
    })

    // Log completion and timing
    const executionDuration = Date.now() - executionStartTime
    logger.info(`[${requestId}] TRACE: Workflow execution completed`, {
      workflowId: foundWorkflow.id,
      success: executionResult.success,
      duration: `${executionDuration}ms`,
      actualDurationMs: executionDuration,
      timestamp: new Date().toISOString(),
    })

    logger.info(`[${requestId}] Workflow execution finished`, {
      executionId,
      success: executionResult.success,
      durationMs: executionResult.metadata?.duration || executionDuration,
      actualDurationMs: executionDuration,
    })

    // Update counts and stats if successful
    if (executionResult.success) {
      await updateWorkflowRunCounts(foundWorkflow.id)
      await db
        .update(userStats)
        .set({
          totalWebhookTriggers: sql`total_webhook_triggers + 1`,
          lastActive: new Date(),
        })
        .where(eq(userStats.userId, foundWorkflow.userId))

      // DEBUG: Log stats update
      logger.debug(`[${requestId}] TRACE: Workflow stats updated`, {
        workflowId: foundWorkflow.id,
        userId: foundWorkflow.userId,
      })
    }

    // Build and enrich result with trace spans
    const { traceSpans, totalDuration } = buildTraceSpans(executionResult)
    const enrichedResult = { ...executionResult, traceSpans, totalDuration }

    // Persist logs for this execution using the standard 'webhook' trigger type
    await persistExecutionLogs(foundWorkflow.id, executionId, enrichedResult, 'webhook')

    // DEBUG: Final success log
    logger.info(`[${requestId}] TRACE: Execution logs persisted successfully`, {
      workflowId: foundWorkflow.id,
      executionId,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    // DEBUG: Detailed error information
    logger.error(`[${requestId}] TRACE: Error during workflow execution`, {
      workflowId: foundWorkflow.id,
      executionId,
      errorType: error.constructor.name,
      errorMessage: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })

    logger.error(`[${requestId}] Error executing workflow`, {
      workflowId: foundWorkflow.id,
      executionId,
      error: error.message,
      stack: error.stack,
    })
    // Persist the error for this execution using the standard 'webhook' trigger type
    await persistExecutionError(foundWorkflow.id, executionId, error, 'webhook')
    // Re-throw the error so the caller knows it failed
    throw error
  }
}

/**
 * Process webhook verification and authorization
 */
export async function processWebhook(
  foundWebhook: any,
  foundWorkflow: any,
  body: any,
  request: NextRequest,
  executionId: string,
  requestId: string
): Promise<NextResponse> {
  // Import here to avoid circular dependency
  const { verifyProviderWebhook } = await import('./provider-verification')
  const { fetchAndProcessAirtablePayloads } = await import('./airtable-processing')

  try {
    // --- Handle Airtable differently - it should always use fetchAndProcessAirtablePayloads ---
    if (foundWebhook.provider === 'airtable') {
      logger.info(`[${requestId}] Routing Airtable webhook through dedicated processor`)

      // Use the dedicated Airtable payload fetcher and processor
      await fetchAndProcessAirtablePayloads(foundWebhook, foundWorkflow, requestId)

      // Return standard success response
      return NextResponse.json({ message: 'Airtable webhook processed' }, { status: 200 })
    }

    // --- Provider-specific Auth/Verification (excluding Airtable/WhatsApp/Slack handled earlier) ---
    if (
      foundWebhook.provider &&
      !['airtable', 'whatsapp', 'slack'].includes(foundWebhook.provider)
    ) {
      const verificationResponse = verifyProviderWebhook(foundWebhook, request, requestId)
      if (verificationResponse) {
        return verificationResponse
      }
    }

    // --- Format Input based on provider (excluding Airtable) ---
    const input = formatWebhookInput(foundWebhook, foundWorkflow, body, request)

    if (!input && foundWebhook.provider === 'whatsapp') {
      return new NextResponse('No messages in WhatsApp payload', { status: 200 })
    }

    // --- Execute Workflow ---
    logger.info(
      `[${requestId}] Executing workflow ${foundWorkflow.id} for webhook ${foundWebhook.id} (Execution: ${executionId})`
    )
    // Call the refactored execution function
    await executeWorkflowFromPayload(foundWorkflow, input, executionId, requestId)

    // Since executeWorkflowFromPayload handles logging and errors internally,
    // we just need to return a standard success response for synchronous webhooks.
    // Note: The actual result isn't typically returned in the webhook response itself.
    return NextResponse.json({ message: 'Webhook processed' }, { status: 200 })
  } catch (error: any) {
    // Catch errors *before* calling executeWorkflowFromPayload (e.g., auth errors)
    logger.error(
      `[${requestId}] Error in processWebhook *before* execution for ${foundWebhook.id} (Execution: ${executionId})`,
      error
    )
    return new NextResponse(`Internal Server Error: ${error.message}`, {
      status: 500,
    })
  }
}
