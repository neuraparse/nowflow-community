import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ExecutionLogger')

export type TriggerType = 'api' | 'webhook' | 'schedule' | 'manual' | 'chat' | 'trigger'

// Helper functions for trigger-specific messages
export function getTriggerSuccessMessage(triggerType: TriggerType): string {
  switch (triggerType) {
    case 'api':
      return 'API workflow executed successfully'
    case 'webhook':
      return 'Webhook workflow executed successfully'
    case 'schedule':
      return 'Scheduled workflow executed successfully'
    case 'manual':
      return 'Manual workflow executed successfully'
    case 'chat':
      return 'Chat workflow executed successfully'
    default:
      return 'Workflow executed successfully'
  }
}

export function getTriggerErrorPrefix(triggerType: TriggerType): string {
  switch (triggerType) {
    case 'api':
      return 'API workflow'
    case 'webhook':
      return 'Webhook workflow'
    case 'schedule':
      return 'Scheduled workflow'
    case 'manual':
      return 'Manual workflow'
    case 'chat':
      return 'Chat workflow'
    default:
      return 'Workflow'
  }
}

/**
 * Extracts duration information for tool calls
 * This function preserves actual timing data while ensuring duration is calculated
 */
export function getToolCallTimings(
  toolCalls: any[],
  blockStart: string,
  blockEnd: string,
  totalDuration: number
): any[] {
  if (!toolCalls || toolCalls.length === 0) return []

  logger.debug('Estimating tool call timings', {
    toolCallCount: toolCalls.length,
    blockStartTime: blockStart,
    blockEndTime: blockEnd,
    totalDuration,
  })

  // First, try to preserve any existing timing data
  const result = toolCalls.map((toolCall, index) => {
    // Start with the original tool call
    const enhancedToolCall = { ...toolCall }

    // If we don't have timing data, set it from the block timing info
    // Divide block duration evenly among tools as a fallback
    const toolDuration = totalDuration / toolCalls.length
    const toolStartOffset = index * toolDuration

    // Force a minimum duration of 1000ms if none exists
    if (!enhancedToolCall.duration || enhancedToolCall.duration === 0) {
      enhancedToolCall.duration = Math.max(1000, toolDuration)
    }

    // Force reasonable startTime and endTime if missing
    if (!enhancedToolCall.startTime) {
      const startTimestamp = new Date(blockStart).getTime() + toolStartOffset
      enhancedToolCall.startTime = new Date(startTimestamp).toISOString()
    }

    if (!enhancedToolCall.endTime) {
      const endTimestamp =
        new Date(enhancedToolCall.startTime).getTime() + enhancedToolCall.duration
      enhancedToolCall.endTime = new Date(endTimestamp).toISOString()
    }

    return enhancedToolCall
  })

  return result
}

/**
 * Extracts the duration from a tool call object, trying various property formats
 * that different agent providers might use
 */
export function extractDuration(toolCall: any): number {
  if (!toolCall) return 0

  // Direct duration fields (various formats providers might use)
  if (typeof toolCall.duration === 'number' && toolCall.duration > 0) return toolCall.duration
  if (typeof toolCall.durationMs === 'number' && toolCall.durationMs > 0) return toolCall.durationMs
  if (typeof toolCall.duration_ms === 'number' && toolCall.duration_ms > 0)
    return toolCall.duration_ms
  if (typeof toolCall.executionTime === 'number' && toolCall.executionTime > 0)
    return toolCall.executionTime
  if (typeof toolCall.execution_time === 'number' && toolCall.execution_time > 0)
    return toolCall.execution_time
  if (typeof toolCall.timing?.duration === 'number' && toolCall.timing.duration > 0)
    return toolCall.timing.duration

  // Try to calculate from timestamps if available
  if (toolCall.startTime && toolCall.endTime) {
    try {
      const start = new Date(toolCall.startTime).getTime()
      const end = new Date(toolCall.endTime).getTime()
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return end - start
      }
    } catch (e) {
      // Silently fail if date parsing fails
    }
  }

  // Also check for startedAt/endedAt format
  if (toolCall.startedAt && toolCall.endedAt) {
    try {
      const start = new Date(toolCall.startedAt).getTime()
      const end = new Date(toolCall.endedAt).getTime()
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return end - start
      }
    } catch (e) {
      // Silently fail if date parsing fails
    }
  }

  // For some providers, timing info might be in a separate object
  if (toolCall.timing) {
    if (toolCall.timing.startTime && toolCall.timing.endTime) {
      try {
        const start = new Date(toolCall.timing.startTime).getTime()
        const end = new Date(toolCall.timing.endTime).getTime()
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          return end - start
        }
      } catch (e) {
        // Silently fail if date parsing fails
      }
    }
  }

  // No duration info found
  return 0
}

/**
 * Extract timing information from a tool call object
 * @param toolCall The tool call object
 * @param blockStartTime Optional block start time (for reference, not used as fallback anymore)
 * @param blockEndTime Optional block end time (for reference, not used as fallback anymore)
 * @returns Object with startTime and endTime properties
 */
export function extractTimingInfo(
  toolCall: any,
  blockStartTime?: Date,
  blockEndTime?: Date
): { startTime?: Date; endTime?: Date } {
  let startTime: Date | undefined = undefined
  let endTime: Date | undefined = undefined

  // Try to get direct timing properties
  if (toolCall.startTime && isValidDate(toolCall.startTime)) {
    startTime = new Date(toolCall.startTime)
  } else if (toolCall.timing?.startTime && isValidDate(toolCall.timing.startTime)) {
    startTime = new Date(toolCall.timing.startTime)
  } else if (toolCall.timing?.start && isValidDate(toolCall.timing.start)) {
    startTime = new Date(toolCall.timing.start)
  } else if (toolCall.startedAt && isValidDate(toolCall.startedAt)) {
    startTime = new Date(toolCall.startedAt)
  }

  if (toolCall.endTime && isValidDate(toolCall.endTime)) {
    endTime = new Date(toolCall.endTime)
  } else if (toolCall.timing?.endTime && isValidDate(toolCall.timing.endTime)) {
    endTime = new Date(toolCall.timing.endTime)
  } else if (toolCall.timing?.end && isValidDate(toolCall.timing.end)) {
    endTime = new Date(toolCall.timing.end)
  } else if (toolCall.completedAt && isValidDate(toolCall.completedAt)) {
    endTime = new Date(toolCall.completedAt)
  }

  if (startTime && !endTime) {
    const duration = extractDuration(toolCall)
    if (duration > 0) {
      endTime = new Date(startTime.getTime() + duration)
    }
  }

  logger.debug('Final extracted timing info', {
    tool: toolCall.name,
    startTime: startTime?.toISOString(),
    endTime: endTime?.toISOString(),
    hasStartTime: !!startTime,
    hasEndTime: !!endTime,
  })

  return { startTime, endTime }
}

/**
 * Helper function to check if a string is a valid date
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false

  try {
    const timestamp = Date.parse(dateString)
    return !isNaN(timestamp)
  } catch (e) {
    return false
  }
}

/**
 * Utility function for redacting API keys in tool call inputs
 */
export function redactApiKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(redactApiKeys)
  }

  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Check if the key is 'apiKey' (case insensitive) or related keys
    if (
      key.toLowerCase() === 'apikey' ||
      key.toLowerCase() === 'api_key' ||
      key.toLowerCase() === 'access_token'
    ) {
      result[key] = '***REDACTED***'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactApiKeys(value)
    } else {
      result[key] = value
    }
  }

  return result
}
