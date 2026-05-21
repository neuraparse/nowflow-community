import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('tool')

interface LoopProcessorParams {
  loopType: string
  maxIterations?: number
  iterationCount?: number
  startValue?: number
  endValue?: number
  stepValue?: number
  arrayData?: any
  whileCondition?: string
  breakCondition?: string
  continueCondition?: string
  itemVariable?: string
  indexVariable?: string
  parallel?: boolean
  collectResults?: boolean
}

interface LoopProcessorResponse extends ToolResponse {
  output: {
    content: string
    loopType: string
    iterations: number
    currentIteration: number
    loopData: any[]
    currentItem: any
    breakCondition?: string
    continueCondition?: string
  }
}

export const loopProcessorTool: ToolConfig<LoopProcessorParams, LoopProcessorResponse> = {
  id: 'loop_processor',
  name: 'Loop Processor',
  description: 'Process loops and iterations',
  version: '1.0.0',

  params: {
    loopType: {
      type: 'string',
      required: false,
      description: 'Type of loop to execute',
    },
    maxIterations: {
      type: 'number',
      required: false,
      description: 'Maximum number of iterations',
    },
    iterationCount: {
      type: 'number',
      required: false,
      description: 'Number of iterations for for loop',
    },
    startValue: {
      type: 'number',
      required: false,
      description: 'Start value for range loop',
    },
    endValue: {
      type: 'number',
      required: false,
      description: 'End value for range loop',
    },
    stepValue: {
      type: 'number',
      required: false,
      description: 'Step value for range loop',
    },
    arrayData: {
      type: 'any',
      required: false,
      description: 'Array or object to iterate over',
    },
    whileCondition: {
      type: 'string',
      required: false,
      description: 'Condition for while loop',
    },
    breakCondition: {
      type: 'string',
      required: false,
      description: 'Condition to break loop',
    },
    continueCondition: {
      type: 'string',
      required: false,
      description: 'Condition to continue loop',
    },
    itemVariable: {
      type: 'string',
      required: false,
      description: 'Variable name for current item',
    },
    indexVariable: {
      type: 'string',
      required: false,
      description: 'Variable name for current index',
    },
    parallel: {
      type: 'boolean',
      required: false,
      description: 'Execute iterations in parallel',
    },
    collectResults: {
      type: 'boolean',
      required: false,
      description: 'Collect results from iterations',
    },
  },

  // Request configuration is not needed due to directExecution, but the type requires it.
  request: {
    url: '', // Not used
    method: 'POST', // Not used
    headers: () => ({}), // Not used
  },

  directExecution: async (params: LoopProcessorParams): Promise<LoopProcessorResponse> => {
    try {
      const maxIterations = params.maxIterations || 1000
      const loopType = params.loopType || 'for'
      let iterations = 0
      let currentIteration = 0
      let loopData: any[] = []
      let currentItem: any = null
      let shouldBreak = false

      switch (loopType) {
        case 'for':
          const count = params.iterationCount || 1
          iterations = Math.min(count, maxIterations)

          for (let i = 0; i < iterations; i++) {
            currentIteration = i
            currentItem = i
            loopData.push({ iteration: i, value: i })

            // Check break condition
            if (
              params.breakCondition &&
              evaluateCondition(params.breakCondition, { item: i, index: i })
            ) {
              shouldBreak = true
              break
            }
          }
          break

        case 'range':
          const start = params.startValue || 0
          const end = params.endValue || 10
          const step = params.stepValue || 1

          let value = start
          while ((step > 0 ? value < end : value > end) && iterations < maxIterations) {
            currentIteration = iterations
            currentItem = value
            loopData.push({ iteration: iterations, value })

            // Check break condition
            if (
              params.breakCondition &&
              evaluateCondition(params.breakCondition, { item: value, index: iterations })
            ) {
              shouldBreak = true
              break
            }

            value += step
            iterations++
          }
          break

        case 'foreach':
          if (params.arrayData && Array.isArray(params.arrayData)) {
            const array = params.arrayData
            iterations = Math.min(array.length, maxIterations)

            for (let i = 0; i < iterations; i++) {
              currentIteration = i
              currentItem = array[i]
              loopData.push({ iteration: i, value: array[i], index: i })

              // Check break condition
              if (
                params.breakCondition &&
                evaluateCondition(params.breakCondition, { item: array[i], index: i })
              ) {
                shouldBreak = true
                break
              }

              // Check continue condition
              if (
                params.continueCondition &&
                evaluateCondition(params.continueCondition, { item: array[i], index: i })
              ) {
                continue
              }
            }
          }
          break

        case 'foreach_object':
          if (
            params.arrayData &&
            typeof params.arrayData === 'object' &&
            !Array.isArray(params.arrayData)
          ) {
            const obj = params.arrayData
            const keys = Object.keys(obj)
            iterations = Math.min(keys.length, maxIterations)

            for (let i = 0; i < iterations; i++) {
              const key = keys[i]
              const value = obj[key]
              currentIteration = i
              currentItem = { key, value }
              loopData.push({ iteration: i, key, value, index: i })

              // Check break condition
              if (
                params.breakCondition &&
                evaluateCondition(params.breakCondition, { item: { key, value }, index: i })
              ) {
                shouldBreak = true
                break
              }
            }
          }
          break

        case 'while':
          let condition = true
          while (condition && iterations < maxIterations) {
            currentIteration = iterations
            currentItem = { iteration: iterations }
            loopData.push({ iteration: iterations, value: iterations })

            // Check while condition
            if (params.whileCondition) {
              condition = evaluateCondition(params.whileCondition, {
                iteration: iterations,
                value: iterations,
              })
            }

            // Check break condition
            if (
              params.breakCondition &&
              evaluateCondition(params.breakCondition, { item: iterations, index: iterations })
            ) {
              shouldBreak = true
              break
            }

            iterations++
          }
          break

        default:
          throw new Error(`Unknown loop type: ${loopType}`)
      }

      const content = `Loop completed: ${iterations} iterations${shouldBreak ? ' (broken early)' : ''}`

      return {
        success: true,
        output: {
          content,
          loopType,
          iterations,
          currentIteration,
          loopData,
          currentItem,
          breakCondition: params.breakCondition,
          continueCondition: params.continueCondition,
        },
      }
    } catch (error) {
      return {
        success: false,
        output: {
          content: `Loop processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          loopType: params.loopType || 'for',
          iterations: 0,
          currentIteration: 0,
          loopData: [],
          currentItem: null,
        },
      }
    }
  },
}

function evaluateCondition(condition: string, context: any): boolean {
  try {
    // Simple condition evaluator
    // Replace context variables in the condition
    let expr = condition

    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      if (typeof value === 'string') {
        expr = expr.replace(regex, `"${value}"`)
      } else {
        expr = expr.replace(regex, String(value))
      }
    }

    // Basic safety check
    if (!/^[0-9a-zA-Z+\-*/().<>=!&|"\s]+$/.test(expr)) {
      throw new Error('Invalid condition expression')
    }

    // Use Function constructor for evaluation
    return new Function(`return ${expr}`)()
  } catch (error) {
    logger.warn('Condition evaluation failed:', error)
    return false
  }
}
