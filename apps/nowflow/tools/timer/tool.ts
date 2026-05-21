import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('tool')

interface TimerParams {
  delayType: string
  duration?: number
  unit?: string
  maxDuration?: number
  targetTime?: string
  targetDate?: string
  timezone?: string
  message?: string
  skipWeekends?: boolean
  skipHolidays?: boolean
}

interface TimerResponse extends ToolResponse {
  output: {
    content: string
    delayDuration: number
    delayUnit: string
    startTime: string
    endTime: string
    actualDelay: number
  }
}

export const timerTool: ToolConfig<TimerParams, TimerResponse> = {
  id: 'timer',
  name: 'Timer',
  description: 'Add delays and timing control',
  version: '1.0.0',

  params: {
    delayType: {
      type: 'string',
      required: false,
      description: 'Type of delay to apply',
    },
    duration: {
      type: 'number',
      required: false,
      description: 'Duration of delay',
    },
    unit: {
      type: 'string',
      required: false,
      description: 'Time unit for duration',
    },
    maxDuration: {
      type: 'number',
      required: false,
      description: 'Maximum duration for random delay',
    },
    targetTime: {
      type: 'string',
      required: false,
      description: 'Target time to wait until',
    },
    targetDate: {
      type: 'string',
      required: false,
      description: 'Target date to wait until',
    },
    timezone: {
      type: 'string',
      required: false,
      description: 'Timezone for time calculations',
    },
    message: {
      type: 'string',
      required: false,
      description: 'Message to display during wait',
    },
    skipWeekends: {
      type: 'boolean',
      required: false,
      description: 'Skip weekends when waiting until date',
    },
    skipHolidays: {
      type: 'boolean',
      required: false,
      description: 'Skip holidays when waiting until date',
    },
  },

  // Request configuration is not needed due to directExecution, but the type requires it.
  request: {
    url: '', // Not used
    method: 'POST', // Not used
    headers: () => ({}), // Not used
  },

  directExecution: async (params: TimerParams): Promise<TimerResponse> => {
    logger.debug('[Timer Tool] Starting execution with params:', params)
    const startTime = new Date().toISOString()
    let delayMs = 0
    let delayUnit = params.unit || 's'

    try {
      // Default to fixed delay if no type specified
      const delayType = params.delayType || 'fixed'
      logger.debug('[Timer Tool] Using delay type:', delayType)

      switch (delayType) {
        case 'fixed':
          const duration = params.duration || 1 // Default 1 second
          delayMs = convertToMilliseconds(duration, params.unit || 's')
          break

        case 'random':
          if (params.duration && params.maxDuration) {
            const min = convertToMilliseconds(params.duration, params.unit || 's')
            const max = convertToMilliseconds(params.maxDuration, params.unit || 's')
            delayMs = Math.random() * (max - min) + min
          }
          break

        case 'until_time':
          if (params.targetTime) {
            const now = new Date()
            const target = new Date()
            const [hours, minutes] = params.targetTime.split(':').map(Number)
            target.setHours(hours, minutes, 0, 0)

            if (target <= now) {
              target.setDate(target.getDate() + 1) // Next day
            }

            delayMs = target.getTime() - now.getTime()
          }
          break

        case 'until_date':
          if (params.targetDate) {
            const now = new Date()
            const target = new Date(params.targetDate)
            delayMs = target.getTime() - now.getTime()

            if (delayMs < 0) {
              delayMs = 0 // Past date
            }
          }
          break
      }

      // Actually wait for the specified delay
      const actualStartTime = Date.now()

      // Limit delay to maximum 30 seconds for safety
      const maxDelayMs = 30 * 1000
      const actualDelayMs = Math.min(delayMs, maxDelayMs)

      if (actualDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, actualDelayMs))
      }

      const actualEndTime = Date.now()
      const endTime = new Date(actualEndTime).toISOString()

      const message = params.message || `Waited for ${formatDuration(actualDelayMs)}`
      logger.debug('[Timer Tool] Completed successfully:', message)

      return {
        success: true,
        output: {
          content: message,
          delayDuration: params.duration || actualDelayMs / 1000,
          delayUnit,
          startTime,
          endTime,
          actualDelay: actualDelayMs,
        },
      }
    } catch (error) {
      const errorTime = new Date().toISOString()
      return {
        success: false,
        output: {
          content: `Timer error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          delayDuration: 0,
          delayUnit: 's',
          startTime,
          endTime: errorTime,
          actualDelay: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
}

function convertToMilliseconds(duration: number, unit: string): number {
  switch (unit) {
    case 'ms':
      return duration
    case 's':
      return duration * 1000
    case 'm':
      return duration * 60 * 1000
    case 'h':
      return duration * 60 * 60 * 1000
    case 'd':
      return duration * 24 * 60 * 60 * 1000
    default:
      return duration * 1000 // Default to seconds
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`
  return `${(ms / 86400000).toFixed(1)}d`
}
