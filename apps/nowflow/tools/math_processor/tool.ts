import { ToolConfig, ToolResponse } from '../types'

interface MathProcessorParams {
  operation: string
  precision?: number
  inputA?: number
  inputB?: number
  inputValue?: number
  inputArray?: string
  expression?: string
  variables?: any
  minValue?: number
  maxValue?: number
  angleUnit?: string
  outputFormat?: string
}

interface MathProcessorResponse extends ToolResponse {
  output: {
    content: string
    operation: string
    result: number
    inputs: number[]
    expression?: string
    unit?: string
    precision: number
  }
}

export const mathProcessorTool: ToolConfig<MathProcessorParams, MathProcessorResponse> = {
  id: 'math_processor',
  name: 'Math Processor',
  description: 'Perform mathematical operations',
  version: '1.0.0',

  params: {
    operation: {
      type: 'string',
      required: false,
      description: 'Mathematical operation to perform',
    },
    precision: {
      type: 'number',
      required: false,
      description: 'Decimal precision for result',
    },
    inputA: {
      type: 'number',
      required: false,
      description: 'First input number',
    },
    inputB: {
      type: 'number',
      required: false,
      description: 'Second input number',
    },
    inputValue: {
      type: 'number',
      required: false,
      description: 'Single input value',
    },
    inputArray: {
      type: 'string',
      required: false,
      description: 'Array of numbers as string',
    },
    expression: {
      type: 'string',
      required: false,
      description: 'Mathematical expression',
    },
    variables: {
      type: 'any',
      required: false,
      description: 'Variables for expression',
    },
    minValue: {
      type: 'number',
      required: false,
      description: 'Minimum value for random',
    },
    maxValue: {
      type: 'number',
      required: false,
      description: 'Maximum value for random',
    },
    angleUnit: {
      type: 'string',
      required: false,
      description: 'Unit for angle calculations',
    },
    outputFormat: {
      type: 'string',
      required: false,
      description: 'Format for output',
    },
  },

  // Request configuration is not needed due to directExecution, but the type requires it.
  request: {
    url: '', // Not used
    method: 'POST', // Not used
    headers: () => ({}), // Not used
  },

  directExecution: async (params: MathProcessorParams): Promise<MathProcessorResponse> => {
    try {
      let result = 0
      let inputs: number[] = []
      const precision = params.precision || 2
      let unit = ''

      // Default to add operation if no operation specified
      const operation = params.operation || 'add'

      switch (operation) {
        case 'add':
          const inputA = params.inputA || 0
          const inputB = params.inputB || 0
          result = inputA + inputB
          inputs = [inputA, inputB]
          break

        case 'subtract':
          const subA = params.inputA || 0
          const subB = params.inputB || 0
          result = subA - subB
          inputs = [subA, subB]
          break

        case 'multiply':
          const mulA = params.inputA || 1
          const mulB = params.inputB || 1
          result = mulA * mulB
          inputs = [mulA, mulB]
          break

        case 'divide':
          const divA = params.inputA || 1
          const divB = params.inputB || 1
          if (divB === 0) throw new Error('Division by zero')
          result = divA / divB
          inputs = [divA, divB]
          break

        case 'power':
          if (params.inputA !== undefined && params.inputB !== undefined) {
            result = Math.pow(params.inputA, params.inputB)
            inputs = [params.inputA, params.inputB]
          }
          break

        case 'sqrt':
          if (params.inputValue !== undefined) {
            if (params.inputValue < 0) throw new Error('Cannot take square root of negative number')
            result = Math.sqrt(params.inputValue)
            inputs = [params.inputValue]
          }
          break

        case 'abs':
          if (params.inputValue !== undefined) {
            result = Math.abs(params.inputValue)
            inputs = [params.inputValue]
          }
          break

        case 'round':
          if (params.inputValue !== undefined) {
            result = Math.round(params.inputValue)
            inputs = [params.inputValue]
          }
          break

        case 'floor':
          if (params.inputValue !== undefined) {
            result = Math.floor(params.inputValue)
            inputs = [params.inputValue]
          }
          break

        case 'ceil':
          if (params.inputValue !== undefined) {
            result = Math.ceil(params.inputValue)
            inputs = [params.inputValue]
          }
          break

        case 'mod':
          if (params.inputA !== undefined && params.inputB !== undefined) {
            if (params.inputB === 0) throw new Error('Modulo by zero')
            result = params.inputA % params.inputB
            inputs = [params.inputA, params.inputB]
          }
          break

        case 'min':
        case 'max':
        case 'avg':
        case 'sum':
          if (params.inputArray) {
            const numbers = parseNumberArray(params.inputArray)
            inputs = numbers

            switch (params.operation) {
              case 'min':
                result = Math.min(...numbers)
                break
              case 'max':
                result = Math.max(...numbers)
                break
              case 'avg':
                result = numbers.reduce((a, b) => a + b, 0) / numbers.length
                break
              case 'sum':
                result = numbers.reduce((a, b) => a + b, 0)
                break
            }
          }
          break

        case 'sin':
        case 'cos':
        case 'tan':
          if (params.inputValue !== undefined) {
            let angle = params.inputValue
            if (params.angleUnit === 'deg') {
              angle = (angle * Math.PI) / 180
            }

            switch (params.operation) {
              case 'sin':
                result = Math.sin(angle)
                break
              case 'cos':
                result = Math.cos(angle)
                break
              case 'tan':
                result = Math.tan(angle)
                break
            }

            inputs = [params.inputValue]
            unit = params.angleUnit || 'rad'
          }
          break

        case 'log':
          if (params.inputValue !== undefined) {
            if (params.inputValue <= 0)
              throw new Error('Cannot take logarithm of non-positive number')
            result = Math.log(params.inputValue)
            inputs = [params.inputValue]
          }
          break

        case 'random':
          const min = params.minValue || 0
          const max = params.maxValue || 1
          result = Math.random() * (max - min) + min
          inputs = [min, max]
          break

        case 'expression':
          if (params.expression && params.variables) {
            result = evaluateExpression(params.expression, params.variables)
            inputs = Object.values(params.variables).filter((v) => typeof v === 'number')
          }
          break

        default:
          throw new Error(`Unknown operation: ${params.operation}`)
      }

      // Apply precision
      const roundedResult = Number(result.toFixed(precision))

      // Format output
      let content = ''
      const outputFormat = params.outputFormat || 'number'

      switch (outputFormat) {
        case 'string':
          content = roundedResult.toString()
          break
        case 'scientific':
          content = roundedResult.toExponential(precision)
          break
        case 'percentage':
          content = (roundedResult * 100).toFixed(precision) + '%'
          break
        default:
          content = roundedResult.toString()
      }

      return {
        success: true,
        output: {
          content,
          operation: params.operation,
          result: roundedResult,
          inputs,
          expression: params.expression,
          unit,
          precision,
        },
      }
    } catch (error) {
      return {
        success: false,
        output: {
          content: `Math operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          operation: params.operation,
          result: 0,
          inputs: [],
          precision: params.precision || 2,
        },
      }
    }
  },
}

function parseNumberArray(arrayString: string): number[] {
  return arrayString
    .split(',')
    .map((s) => s.trim())
    .map((s) => {
      const num = Number(s)
      if (isNaN(num)) throw new Error(`Invalid number: ${s}`)
      return num
    })
}

function evaluateExpression(expression: string, variables: any): number {
  // Simple expression evaluator (in production, use a proper math parser)
  let expr = expression

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'number') {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString())
    }
  }

  // Basic safety check - only allow numbers, operators, and parentheses
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
    throw new Error('Invalid expression - only numbers and basic operators allowed')
  }

  try {
    // Use Function constructor for evaluation (safer than eval)
    return new Function(`return ${expr}`)()
  } catch (error) {
    throw new Error('Invalid mathematical expression')
  }
}
