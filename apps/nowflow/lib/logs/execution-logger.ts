import { eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { recordExecution } from '@/lib/analytics/analytics-service'
import { getCostMultiplier } from '@/lib/environment'
import {
  getExperiments,
  recordExperimentResult,
  selectVariant,
} from '@/lib/experiments/experiment-service'
import { createLogger } from '@/lib/logs/console-logger'
import { publishWorkflowUpdate } from '@/lib/redis-pubsub'
import { db } from '@/db'
import { executionTrace, userStats, workflow, workflowLogs, workflowRun } from '@/db/schema'
import { ExecutionResult as ExecutorResult } from '@/executor/types'
import { calculateCost } from '@/providers/utils'
import { stripCustomToolPrefix } from '../workflows/utils'
import type { LogEntry, ToolCallMetadata } from './log-types'
import {
  extractDuration,
  extractTimingInfo,
  getToolCallTimings,
  getTriggerErrorPrefix,
  getTriggerSuccessMessage,
  redactApiKeys,
  type TriggerType,
} from './log-utils'

// Re-export types and utils so existing consumers don't break
export type { LogEntry, ToolCallMetadata, ToolCall } from './log-types'
export {
  extractDuration,
  extractTimingInfo,
  isValidDate,
  redactApiKeys,
  getToolCallTimings,
  getTriggerSuccessMessage,
  getTriggerErrorPrefix,
} from './log-utils'

const logger = createLogger('ExecutionLogger')

export async function persistLog(log: LogEntry) {
  await db.insert(workflowLogs).values(log)
}

export async function persistLogsBatch(logs: LogEntry[]) {
  if (logs.length === 0) return
  await db.insert(workflowLogs).values(logs)
}

/**
 * Persists logs for a workflow execution, including individual block logs and the final result
 * @param workflowId - The ID of the workflow
 * @param executionId - The ID of the execution
 * @param result - The execution result
 * @param triggerType - The type of trigger (api, webhook, schedule, manual, chat)
 */
export async function persistExecutionLogs(
  workflowId: string,
  executionId: string,
  result: ExecutorResult,
  triggerType: TriggerType
) {
  try {
    // Get the workflow record to get the userId
    const [workflowRecord] = await db
      .select()
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowRecord) {
      logger.error(`Workflow ${workflowId} not found`)
      return
    }

    const userId = workflowRecord.userId

    // Track accumulated cost data across all agent blocks
    let totalCost = 0
    let totalInputCost = 0
    let totalOutputCost = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalTokens = 0
    let modelCounts: Record<string, number> = {}
    let primaryModel = ''

    // Collect all log entries for batch insert
    const allLogEntries: LogEntry[] = []

    // Log each execution step
    for (const log of result.logs || []) {
      // Check for agent block and tool calls
      let metadata: ToolCallMetadata | undefined = undefined

      // If this is an agent block
      if (log.blockType === 'agent' && log.output) {
        logger.debug('Processing agent block output for tool calls', {
          blockId: log.blockId,
          blockName: log.blockName,
          outputKeys: Object.keys(log.output),
          hasToolCalls: !!log.output.toolCalls,
          hasResponse: !!log.output.response,
        })

        // FIRST PASS - Check if this is a no-tool scenario with tokens data not propagated
        // In some cases, the token data from the streaming callback doesn't properly get into
        // the agent block response. This ensures we capture it.
        if (
          log.output.response &&
          (!log.output.response.tokens?.completion ||
            log.output.response.tokens.completion === 0) &&
          (!log.output.response.toolCalls ||
            !log.output.response.toolCalls.list ||
            log.output.response.toolCalls.list.length === 0)
        ) {
          // Check if output response has providerTiming - this indicates it's a streaming response
          if (log.output.response.providerTiming) {
            logger.debug('Processing streaming response without tool calls for token extraction', {
              blockId: log.blockId,
              hasTokens: !!log.output.response.tokens,
              hasProviderTiming: !!log.output.response.providerTiming,
            })

            // Only for no-tool streaming cases, extract content length and estimate token count
            const contentLength = log.output.response.content?.length || 0
            if (contentLength > 0) {
              // Estimate completion tokens based on content length as a fallback
              const estimatedCompletionTokens = Math.ceil(contentLength / 4)
              const promptTokens = log.output.response.tokens?.prompt || 8

              // Update the tokens object
              log.output.response.tokens = {
                prompt: promptTokens,
                completion: estimatedCompletionTokens,
                total: promptTokens + estimatedCompletionTokens,
              }

              // Update cost information using the provider's cost model
              const model = log.output.response.model || getDefaultModel('openai')
              const costInfo = calculateCost(model, promptTokens, estimatedCompletionTokens)
              log.output.response.cost = {
                input: costInfo.input,
                output: costInfo.output,
                total: costInfo.total,
                pricing: costInfo.pricing,
              }

              logger.debug('Updated token information for streaming no-tool response', {
                blockId: log.blockId,
                contentLength,
                estimatedCompletionTokens,
                tokens: log.output.response.tokens,
              })
            }
          }
        }

        // Special case for streaming responses from agent blocks
        // This format has both stream and executionData properties
        if (log.output.stream && log.output.executionData) {
          logger.debug('Found streaming response with executionData', {
            blockId: log.blockId,
            hasExecutionData: !!log.output.executionData,
            executionDataKeys: log.output.executionData
              ? Object.keys(log.output.executionData)
              : [],
          })

          // Extract the executionData and use it as our primary source of information
          const executionData = log.output.executionData

          // If executionData has output with response, use that as our response
          // This is especially important for streaming responses where the final content
          // is set in the executionData structure by the executor
          if (executionData.output?.response) {
            log.output.response = executionData.output.response
            logger.debug('Using response from executionData', {
              responseKeys: Object.keys(log.output.response),
              hasContent: !!log.output.response.content,
              contentLength: log.output.response.content?.length || 0,
              hasToolCalls: !!log.output.response.toolCalls,
              hasTokens: !!log.output.response.tokens,
              hasCost: !!log.output.response.cost,
            })
          }
        }

        // Extract tool calls and other metadata
        if (log.output.response) {
          const response = log.output.response

          // Process tool calls
          if (response.toolCalls && response.toolCalls.list) {
            metadata = {
              toolCalls: response.toolCalls.list.map((tc: any) => ({
                name: stripCustomToolPrefix(tc.name),
                duration: tc.duration || 0,
                startTime: tc.startTime || new Date().toISOString(),
                endTime: tc.endTime || new Date().toISOString(),
                status: tc.error ? 'error' : 'success',
                input: tc.input || tc.arguments,
                output: tc.output || tc.result,
                error: tc.error,
              })),
            }
          }

          // Add cost information if available
          if (response.cost) {
            if (!metadata) metadata = {}
            metadata.cost = {
              model: response.model,
              input: response.cost.input,
              output: response.cost.output,
              total: response.cost.total,
              tokens: response.tokens,
              pricing: response.cost.pricing,
            }

            // Accumulate costs for workflow-level summary
            if (response.cost.total) {
              totalCost += response.cost.total
              totalInputCost += response.cost.input || 0
              totalOutputCost += response.cost.output || 0

              // Track tokens
              if (response.tokens) {
                totalPromptTokens += response.tokens.prompt || 0
                totalCompletionTokens += response.tokens.completion || 0
                totalTokens += response.tokens.total || 0
              }

              // Track model usage
              if (response.model) {
                modelCounts[response.model] = (modelCounts[response.model] || 0) + 1
                // Set the most frequently used model as primary
                if (!primaryModel || modelCounts[response.model] > modelCounts[primaryModel]) {
                  primaryModel = response.model
                }
              }
            }
          }
        }

        // Extract timing info - try various formats that providers might use
        const blockStartTime = log.startedAt
        const blockEndTime = log.endedAt || new Date().toISOString()
        const blockDuration = log.durationMs || 0
        let toolCallData: any[] = []

        // Case 1: Direct toolCalls array
        if (Array.isArray(log.output.toolCalls)) {
          // Log raw timing data for debugging
          log.output.toolCalls.forEach((tc: any, idx: number) => {
            logger.debug(`Tool call ${idx} raw timing data:`, {
              name: stripCustomToolPrefix(tc.name),
              startTime: tc.startTime,
              endTime: tc.endTime,
              duration: tc.duration,
              timing: tc.timing,
              argumentKeys: tc.arguments ? Object.keys(tc.arguments) : undefined,
            })
          })

          toolCallData = log.output.toolCalls.map((toolCall: any) => {
            // Extract timing info - try various formats that providers might use
            const duration = extractDuration(toolCall)
            const timing = extractTimingInfo(
              toolCall,
              blockStartTime ? new Date(blockStartTime) : undefined,
              blockEndTime ? new Date(blockEndTime) : undefined
            )

            return {
              name: toolCall.name,
              duration: duration,
              startTime: timing.startTime,
              endTime: timing.endTime,
              status: toolCall.error ? 'error' : 'success',
              input: toolCall.input || toolCall.arguments,
              output: toolCall.output || toolCall.result,
              error: toolCall.error,
            }
          })
        }
        // Case 2: toolCalls with a list array (as seen in the screenshot)
        else if (log.output.toolCalls && Array.isArray(log.output.toolCalls.list)) {
          // Log raw timing data for debugging
          log.output.toolCalls.list.forEach((tc: any, idx: number) => {
            logger.debug(`Tool call list ${idx} raw timing data:`, {
              name: stripCustomToolPrefix(tc.name),
              startTime: tc.startTime,
              endTime: tc.endTime,
              duration: tc.duration,
              timing: tc.timing,
              argumentKeys: tc.arguments ? Object.keys(tc.arguments) : undefined,
            })
          })

          toolCallData = log.output.toolCalls.list.map((toolCall: any) => {
            // Extract timing info - try various formats that providers might use
            const duration = extractDuration(toolCall)
            const timing = extractTimingInfo(
              toolCall,
              blockStartTime ? new Date(blockStartTime) : undefined,
              blockEndTime ? new Date(blockEndTime) : undefined
            )

            // Log what we extracted
            logger.debug(`Tool call list timing extracted:`, {
              name: toolCall.name,
              extracted_duration: duration,
              extracted_startTime: timing.startTime,
              extracted_endTime: timing.endTime,
            })

            return {
              name: toolCall.name,
              duration: duration,
              startTime: timing.startTime,
              endTime: timing.endTime,
              status: toolCall.error ? 'error' : 'success',
              input: toolCall.arguments || toolCall.input,
              output: toolCall.result || toolCall.output,
              error: toolCall.error,
            }
          })
        }
        // Case 3: Response has toolCalls
        else if (log.output.response && log.output.response.toolCalls) {
          const toolCalls = Array.isArray(log.output.response.toolCalls)
            ? log.output.response.toolCalls
            : log.output.response.toolCalls.list || []

          logger.debug('Found toolCalls in response', {
            count: toolCalls.length,
          })

          // Log raw timing data for debugging
          toolCalls.forEach((tc: any, idx: number) => {
            logger.debug(`Response tool call ${idx} raw timing data:`, {
              name: stripCustomToolPrefix(tc.name),
              startTime: tc.startTime,
              endTime: tc.endTime,
              duration: tc.duration,
              timing: tc.timing,
              argumentKeys: tc.arguments ? Object.keys(tc.arguments) : undefined,
            })
          })

          toolCallData = toolCalls.map((toolCall: any) => {
            // Extract timing info - try various formats that providers might use
            const duration = extractDuration(toolCall)
            const timing = extractTimingInfo(
              toolCall,
              blockStartTime ? new Date(blockStartTime) : undefined,
              blockEndTime ? new Date(blockEndTime) : undefined
            )

            return {
              name: toolCall.name,
              duration: duration,
              startTime: timing.startTime,
              endTime: timing.endTime,
              status: toolCall.error ? 'error' : 'success',
              input: toolCall.arguments || toolCall.input,
              output: toolCall.result || toolCall.output,
              error: toolCall.error,
            }
          })
        }
        // Case 4: toolCalls is an object and has a list property
        else if (
          log.output.toolCalls &&
          typeof log.output.toolCalls === 'object' &&
          log.output.toolCalls.list
        ) {
          const toolCalls = log.output.toolCalls

          logger.debug('Found toolCalls object with list property', {
            count: toolCalls.list.length,
          })

          // Log raw timing data for debugging
          toolCalls.list.forEach((tc: any, idx: number) => {
            logger.debug(`toolCalls object list ${idx} raw timing data:`, {
              name: stripCustomToolPrefix(tc.name),
              startTime: tc.startTime,
              endTime: tc.endTime,
              duration: tc.duration,
              timing: tc.timing,
              argumentKeys: tc.arguments ? Object.keys(tc.arguments) : undefined,
            })
          })

          toolCallData = toolCalls.list.map((toolCall: any) => {
            // Extract timing info - try various formats that providers might use
            const duration = extractDuration(toolCall)
            const timing = extractTimingInfo(
              toolCall,
              blockStartTime ? new Date(blockStartTime) : undefined,
              blockEndTime ? new Date(blockEndTime) : undefined
            )

            // Log what we extracted
            logger.debug(`toolCalls object list timing extracted:`, {
              name: toolCall.name,
              extracted_duration: duration,
              extracted_startTime: timing.startTime,
              extracted_endTime: timing.endTime,
            })

            return {
              name: toolCall.name,
              duration: duration,
              startTime: timing.startTime,
              endTime: timing.endTime,
              status: toolCall.error ? 'error' : 'success',
              input: toolCall.arguments || toolCall.input,
              output: toolCall.result || toolCall.output,
              error: toolCall.error,
            }
          })
        }
        // Case 5: Look in executionData.output.response for streaming responses
        else if (log.output.executionData?.output?.response?.toolCalls) {
          const toolCallsObj = log.output.executionData.output.response.toolCalls
          const list = Array.isArray(toolCallsObj) ? toolCallsObj : toolCallsObj.list || []

          logger.debug('Found toolCalls in executionData output response', {
            count: list.length,
          })

          // Log raw timing data for debugging
          list.forEach((tc: any, idx: number) => {
            logger.debug(`executionData toolCalls ${idx} raw timing data:`, {
              name: stripCustomToolPrefix(tc.name),
              startTime: tc.startTime,
              endTime: tc.endTime,
              duration: tc.duration,
              timing: tc.timing,
              argumentKeys: tc.arguments ? Object.keys(tc.arguments) : undefined,
            })
          })

          toolCallData = list.map((toolCall: any) => {
            // Extract timing info - try various formats that providers might use
            const duration = extractDuration(toolCall)
            const timing = extractTimingInfo(
              toolCall,
              blockStartTime ? new Date(blockStartTime) : undefined,
              blockEndTime ? new Date(blockEndTime) : undefined
            )

            return {
              name: toolCall.name,
              duration: duration,
              startTime: timing.startTime,
              endTime: timing.endTime,
              status: toolCall.error ? 'error' : 'success',
              input: toolCall.arguments || toolCall.input,
              output: toolCall.result || toolCall.output,
              error: toolCall.error,
            }
          })
        }
        // Case 6: Parse the response string for toolCalls as a last resort
        else if (typeof log.output.response === 'string') {
          const match = log.output.response.match(/"toolCalls"\s*:\s*({[^}]*}|(\[.*?\]))/s)
          if (match) {
            try {
              const toolCallsJson = JSON.parse(`{${match[0]}}`)
              const list = Array.isArray(toolCallsJson.toolCalls)
                ? toolCallsJson.toolCalls
                : toolCallsJson.toolCalls.list || []

              logger.debug('Found toolCalls in parsed response string', {
                count: list.length,
              })

              // Log raw timing data for debugging
              list.forEach((tc: any, idx: number) => {
                logger.debug(`Parsed response ${idx} raw timing data:`, {
                  name: stripCustomToolPrefix(tc.name),
                  startTime: tc.startTime,
                  endTime: tc.endTime,
                  duration: tc.duration,
                  timing: tc.timing,
                  argumentKeys: tc.arguments ? Object.keys(tc.arguments) : undefined,
                })
              })

              toolCallData = list.map((toolCall: any) => {
                // Extract timing info - try various formats that providers might use
                const duration = extractDuration(toolCall)
                const timing = extractTimingInfo(
                  toolCall,
                  blockStartTime ? new Date(blockStartTime) : undefined,
                  blockEndTime ? new Date(blockEndTime) : undefined
                )

                // Log what we extracted
                logger.debug(`Parsed response timing extracted:`, {
                  name: toolCall.name,
                  extracted_duration: duration,
                  extracted_startTime: timing.startTime,
                  extracted_endTime: timing.endTime,
                })

                return {
                  name: toolCall.name,
                  duration: duration,
                  startTime: timing.startTime,
                  endTime: timing.endTime,
                  status: toolCall.error ? 'error' : 'success',
                  input: toolCall.arguments || toolCall.input,
                  output: toolCall.result || toolCall.output,
                  error: toolCall.error,
                }
              })
            } catch (error) {
              logger.error('Error parsing toolCalls from response string', {
                error,
                response: log.output.response,
              })
            }
          }
        }
        // Verbose output debugging as a fallback
        else {
          logger.debug('Could not find tool calls in standard formats, output data:', {
            outputSample: log.output,
          })
        }

        // Fill in missing timing information
        if (toolCallData.length > 0) {
          const getToolCalls = getToolCallTimings(
            toolCallData,
            blockStartTime,
            blockEndTime,
            blockDuration
          )

          const redactedToolCalls = getToolCalls.map((toolCall) => ({
            ...toolCall,
            input: redactApiKeys(toolCall.input),
          }))

          metadata = {
            toolCalls: redactedToolCalls,
          }

          logger.debug('Created metadata with tool calls', {
            count: redactedToolCalls.length,
          })
        }
      }

      allLogEntries.push({
        id: uuidv4(),
        workflowId,
        executionId,
        level: log.success ? 'info' : 'error',
        message: log.success
          ? `Block ${log.blockName || log.blockId} (${log.blockType || 'unknown'}): ${
              log.output?.response?.content ||
              log.output?.executionData?.output?.response?.content ||
              JSON.stringify(log.output?.response || {})
            }`
          : `Block ${log.blockName || log.blockId} (${log.blockType || 'unknown'}): ${log.error || 'Failed'}`,
        duration: log.success ? `${log.durationMs}ms` : 'NA',
        trigger: triggerType,
        createdAt: new Date(log.endedAt || log.startedAt),
        metadata,
      })

      if (metadata) {
        logger.debug('Collected log with metadata', {
          executionId,
          toolCallCount: metadata.toolCalls?.length || 0,
        })
      }
    }

    // Calculate total duration from successful block logs
    const totalDuration = (result.logs || [])
      .filter((log) => log.success)
      .reduce((sum, log) => sum + log.durationMs, 0)

    // For parallel execution, calculate the actual duration from start to end times
    let actualDuration = totalDuration
    if (result.metadata?.startTime && result.metadata?.endTime) {
      const startTime = result.metadata.startTime
        ? new Date(result.metadata.startTime).getTime()
        : 0
      const endTime = new Date(result.metadata.endTime).getTime()
      actualDuration = endTime - startTime
    }

    // Get trigger-specific message
    const successMessage = getTriggerSuccessMessage(triggerType)
    const errorPrefix = getTriggerErrorPrefix(triggerType)

    // Create workflow-level metadata with aggregated cost information
    const workflowMetadata: any = {
      traceSpans: (result as any).traceSpans || [],
      totalDuration: (result as any).totalDuration || actualDuration,
    }

    // Add accumulated cost data to workflow-level log
    if (totalCost > 0) {
      workflowMetadata.cost = {
        model: primaryModel,
        input: totalInputCost,
        output: totalOutputCost,
        total: totalCost,
        tokens: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalTokens,
        },
      }

      // Include pricing info if we have a model
      if (primaryModel && result.logs && result.logs.length > 0) {
        // Find the first agent log with pricing info
        for (const log of result.logs) {
          if (log.output?.response?.cost?.pricing) {
            workflowMetadata.cost.pricing = log.output.response.cost.pricing
            break
          }
        }
      }

      // If result has a direct cost field (for streaming responses completed with calculated cost),
      // use that as a safety check to ensure we have cost data
      if (
        result.metadata &&
        'cost' in result.metadata &&
        (!workflowMetadata.cost || workflowMetadata.cost.total <= 0)
      ) {
        const resultCost = (result.metadata as any).cost
        workflowMetadata.cost = {
          model: primaryModel,
          total: typeof resultCost === 'number' ? resultCost : resultCost?.total || 0,
          input: resultCost?.input || 0,
          output: resultCost?.output || 0,
          tokens: {
            prompt: totalPromptTokens,
            completion: totalCompletionTokens,
            total: totalTokens,
          },
        }
      }

      if (userId) {
        try {
          const userStatsRecords = await db
            .select()
            .from(userStats)
            .where(eq(userStats.userId, userId))

          const costMultiplier = getCostMultiplier()
          const costToStore = totalCost * costMultiplier

          if (userStatsRecords.length === 0) {
            await db.insert(userStats).values({
              id: crypto.randomUUID(),
              userId: userId,
              totalManualExecutions: 0,
              totalApiCalls: 0,
              totalWebhookTriggers: 0,
              totalScheduledExecutions: 0,
              totalTokensUsed: totalTokens,
              totalCost: costToStore.toString(),
              lastActive: new Date(),
            })
          } else {
            await db
              .update(userStats)
              .set({
                totalTokensUsed: sql`total_tokens_used + ${totalTokens}`,
                totalCost: sql`total_cost + ${costToStore}`,
                lastActive: new Date(),
              })
              .where(eq(userStats.userId, userId))
          }
        } catch (error) {
          logger.error(`Error upserting user stats:`, error)
        }
      }
    }

    // Add the final execution result log entry
    allLogEntries.push({
      id: uuidv4(),
      workflowId,
      executionId,
      level: result.success ? 'info' : 'error',
      message: result.success ? successMessage : `${errorPrefix} execution failed: ${result.error}`,
      duration: result.success ? `${actualDuration}ms` : 'NA',
      trigger: triggerType,
      createdAt: new Date(),
      metadata: workflowMetadata,
    })

    // Batch insert all log entries at once
    await persistLogsBatch(allLogEntries)

    // Record execution in workflow_run table for tracking
    try {
      await db.insert(workflowRun).values({
        id: executionId,
        workflowId,
        status: result.success ? 'completed' : 'failed',
        executionTime: actualDuration,
        error: result.success ? null : result.error || null,
        trigger: triggerType,
        metadata: {
          model: primaryModel || null,
          tokensUsed: totalTokens,
          cost: totalCost,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
        },
        startedAt: result.metadata?.startTime ? new Date(result.metadata.startTime) : new Date(),
        completedAt: result.metadata?.endTime ? new Date(result.metadata.endTime) : new Date(),
        createdAt: new Date(),
      })
      logger.debug('Recorded workflow run', {
        executionId,
        workflowId,
        status: result.success ? 'completed' : 'failed',
      })

      // Ensure workflow.lastRunAt is current so SSE fingerprint detects the change
      // This covers failed executions where updateWorkflowRunCounts() wasn't called
      await db.update(workflow).set({ lastRunAt: new Date() }).where(eq(workflow.id, workflowId))

      // Publish real-time update via Redis Pub/Sub
      // Enables near-instant SSE delivery instead of waiting for the next poll cycle
      await publishWorkflowUpdate(
        workflowId,
        userId,
        result.success ? 'execution_completed' : 'execution_failed',
        {
          executionId,
          status: result.success ? 'completed' : 'failed',
          duration: actualDuration,
          trigger: triggerType,
        }
      )
    } catch (runError) {
      logger.error('Error recording workflow run:', runError)
    }

    // Record analytics for this execution
    try {
      await recordExecution({
        executionId,
        workflowId,
        success: result.success,
        durationMs: actualDuration,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens,
        cost: totalCost,
        model: primaryModel || undefined,
        trigger: triggerType,
        error: result.success ? undefined : result.error,
        blockMetrics: (result.logs || []).reduce(
          (acc, log) => {
            if (log.blockId) {
              acc[log.blockId] = {
                durationMs: log.durationMs || 0,
                tokens: log.output?.response?.tokens?.total || 0,
                success: log.success,
              }
            }
            return acc
          },
          {} as Record<string, { durationMs: number; tokens?: number; success: boolean }>
        ),
      })
      logger.debug('Recorded execution analytics', { executionId, workflowId })
    } catch (analyticsError) {
      logger.error('Error recording execution analytics:', analyticsError)
    }

    // Persist execution trace spans for timeline visualization
    try {
      const traceSpans = (result as any).traceSpans || workflowMetadata.traceSpans
      if (traceSpans && Array.isArray(traceSpans) && traceSpans.length > 0) {
        await db.insert(executionTrace).values({
          id: uuidv4(),
          workflowId,
          executionId,
          spans: traceSpans,
          totalDuration: actualDuration,
          blockCount: result.logs?.length || 0,
          createdAt: new Date(),
        })
        logger.debug('Persisted execution trace', { executionId, spanCount: traceSpans.length })
      }
    } catch (traceError) {
      logger.error('Error persisting execution trace:', traceError)
    }

    // Record experiment results for A/B tests
    // Use the variant that was selected BEFORE execution (stored in result metadata)
    // This ensures consistent tracking - the same variant that ran is the one we record
    try {
      const experimentId = (result.metadata as any)?.experimentId
      const variantId = (result.metadata as any)?.variantId

      if (experimentId && variantId) {
        // Use the pre-selected experiment/variant from execution
        await recordExperimentResult(experimentId, variantId, executionId, {
          success: result.success ? 1 : 0,
          latency: actualDuration,
          cost: totalCost,
          tokens: totalTokens,
        })
        logger.info('Recorded A/B experiment result', {
          experimentId,
          variantId,
          variantName: (result.metadata as any)?.variantName,
          executionId,
          success: result.success,
        })

        // Check if experiment should auto-complete (sample size reached)
        const { updateExperimentSampleCount } = await import('@/lib/experiments/experiment-service')
        const completed = await updateExperimentSampleCount(experimentId)
        if (completed) {
          logger.info('A/B Experiment auto-completed: target sample size reached', {
            experimentId,
          })
        }
      } else {
        // Fallback: Check for running experiments if no pre-selected variant
        // This handles legacy executions or edge cases
        const experiments = await getExperiments(workflowId)
        const runningExperiments = experiments.filter((exp) => exp.status === 'running')

        for (const experiment of runningExperiments) {
          const variant = selectVariant(experiment)
          if (variant) {
            await recordExperimentResult(experiment.id, variant.id, executionId, {
              success: result.success ? 1 : 0,
              latency: actualDuration,
              cost: totalCost,
              tokens: totalTokens,
            })
            logger.debug('Recorded experiment result (fallback selection)', {
              experimentId: experiment.id,
              variantId: variant.id,
              executionId,
            })
          }
        }
      }
    } catch (experimentError) {
      logger.error('Error recording experiment results:', experimentError)
    }
  } catch (error: any) {
    logger.error(`Error persisting execution logs: ${error.message}`, {
      error,
    })
  }
}

/**
 * Persists an error log for a workflow execution
 * @param workflowId - The ID of the workflow
 * @param executionId - The ID of the execution
 * @param error - The error that occurred
 * @param triggerType - The type of trigger (api, webhook, schedule, manual, chat)
 */
export async function persistExecutionError(
  workflowId: string,
  executionId: string,
  error: Error,
  triggerType: TriggerType
) {
  try {
    const errorPrefix = getTriggerErrorPrefix(triggerType)

    await persistLog({
      id: uuidv4(),
      workflowId,
      executionId,
      level: 'error',
      message: `${errorPrefix} execution failed: ${error.message}`,
      duration: 'NA',
      trigger: triggerType,
      createdAt: new Date(),
    })
  } catch (logError: any) {
    logger.error(`Error persisting execution error log: ${logError.message}`, {
      logError,
    })
  }
}
