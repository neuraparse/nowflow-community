import { createLogger } from '@/lib/logs/console-logger'
import { useConsoleStore } from '@/stores/panel/console/store'
import { BlockLog, ExecutionContext, ExecutionResult, StreamingExecution } from './types'

const logger = createLogger('Executor')

/**
 * Checks if an output object is a StreamingExecution response.
 */
export function isStreamingExecution(output: any): output is StreamingExecution {
  return (
    typeof output === 'object' && output !== null && 'stream' in output && 'execution' in output
  )
}

/**
 * Processes a streaming output from a block execution layer.
 * Handles console logging, stream tee-ing for content collection, and building the final execution result.
 *
 * @param streamingOutput - The streaming execution output from a block handler
 * @param context - Current execution context
 * @param startTime - Workflow execution start time
 * @param workflowConnections - Workflow connection metadata
 * @returns A properly formed StreamingExecution object with updated execution result
 */
export function processStreamingOutput(
  streamingOutput: StreamingExecution,
  context: ExecutionContext,
  startTime: Date,
  workflowConnections: Array<{ source: string; target: string }>
): StreamingExecution {
  // Incorporate the execution data from the block into our context
  const executionData = streamingOutput.execution

  // Add any logs from the execution data to our context
  if (executionData.logs && Array.isArray(executionData.logs)) {
    context.blockLogs.push(...executionData.logs)
  }

  // Add proper console entry for the streaming block
  // This ensures identical formatting between streamed and non-streamed outputs
  if (executionData.output) {
    const blockLog = executionData.logs?.find(
      (log: BlockLog) => log.blockId === executionData.blockId
    )
    const consoleStore = useConsoleStore.getState()

    // Create a complete console entry with the full output structure, not the raw streaming object
    const consoleEntry = {
      output: executionData.output, // Use just the output, not the whole streaming structure
      durationMs: blockLog?.durationMs || executionData.metadata?.duration || 0,
      startedAt:
        blockLog?.startedAt || executionData.metadata?.startTime || new Date().toISOString(),
      endedAt: blockLog?.endedAt || executionData.metadata?.endTime || new Date().toISOString(),
      workflowId: context.workflowId,
      timestamp:
        blockLog?.startedAt || executionData.metadata?.startTime || new Date().toISOString(),
      blockId: executionData.blockId,
      blockName: executionData.blockName || blockLog?.blockName || 'Agent Block',
      blockType: executionData.blockType || blockLog?.blockType || 'agent',
    }

    // Add to console
    const newEntry = consoleStore.addConsole(consoleEntry)

    // Save the entryId for potential updates when stream completes
    const consoleEntryId = newEntry?.id

    // Set up a stream completion handler to update the console with final content
    if (consoleEntryId && 'stream' in streamingOutput) {
      // Clone the stream so we don't consume the original one
      const originalStream = streamingOutput.stream
      const [contentStream, returnStream] = originalStream.tee()

      // Replace the original stream with our cloned version that will be returned
      streamingOutput.stream = returnStream

      // Create a reader to process the cloned stream for content collection
      const reader = contentStream.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      // Process the stream in the background to collect the full content
      ;(async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            fullContent += chunk
          }
          // Once stream is complete, update the console entry with the final content
          if (fullContent.length > 0 && executionData.output?.response) {
            const updatedOutput = {
              ...executionData.output,
              response: {
                ...executionData.output.response,
                content: fullContent,
              },
            }

            // Update the console UI with the final content
            consoleStore.updateConsole(consoleEntryId, { output: updatedOutput })

            // Update the execution data itself with the final content
            // so that when logs are persisted, they have the complete content
            executionData.output.response.content = fullContent

            // If there's a block log for this execution, update it with the final content
            if (executionData.blockId) {
              const blockLog = context.blockLogs.find(
                (log) => log.blockId === executionData.blockId
              )
              if (blockLog?.output?.response) {
                blockLog.output.response.content = fullContent
              }
            }
          }
        } catch (e) {
          logger.error('Error processing stream for console update:', e)
        }
      })()
    }
  }

  // Build a complete execution result with our context's logs
  const execution: ExecutionResult & { isStreaming: boolean } = {
    success: executionData.success !== false,
    output: executionData.output || { response: {} },
    error: executionData.error,
    logs: context.blockLogs,
    metadata: {
      duration: Date.now() - startTime.getTime(),
      startTime: context.metadata.startTime!,
      endTime: new Date().toISOString(),
      workflowConnections,
    },
    isStreaming: true,
  }

  // Add block metadata to logs if missing
  if (context.blockLogs.length > 0) {
    for (const log of context.blockLogs) {
      if (!log.output) log.output = { response: {} }

      // For blocks matching the streaming block, ensure we add response and content properly
      if (log.blockId === executionData.blockId) {
        if (!log.output.response) log.output.response = {}

        // Add the output structure, preferring direct response content if available
        if (executionData.output?.response) {
          // Copy all properties from executionData response
          Object.assign(log.output.response, executionData.output.response)

          // For streaming, we may not have content yet, so we store a placeholder
          // that will be updated when the stream completes
          if (!log.output.response.content && executionData.output.response.content) {
            log.output.response.content = executionData.output.response.content
          }
        }
      }
    }
  }

  // Return a properly formed StreamingExecution object
  return {
    stream: streamingOutput.stream,
    execution,
  }
}
