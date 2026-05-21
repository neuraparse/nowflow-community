import { ToolConfig, ToolResponse } from '../types'

interface VariableManagerParams {
  operation: string
  variableName: string
  variableValue?: any
  dataType?: string
  incrementValue?: number
  scope?: string
  defaultValue?: any
  persistent?: boolean
  encrypted?: boolean
}

interface VariableManagerResponse extends ToolResponse {
  output: {
    content: string
    variableName: string
    variableValue: any
    variableType: string
    operation: string
    previousValue?: any
  }
}

// Simple in-memory variable store (in production, this would be persistent)
const variableStore: Record<string, any> = {}

export const variableManagerTool: ToolConfig<VariableManagerParams, VariableManagerResponse> = {
  id: 'variable_manager',
  name: 'Variable Manager',
  description: 'Store and manage variables',
  version: '1.0.0',

  params: {
    operation: {
      type: 'string',
      required: false,
      description: 'Operation to perform on variable',
    },
    variableName: {
      type: 'string',
      required: false,
      description: 'Name of the variable',
    },
    variableValue: {
      type: 'any',
      required: false,
      description: 'Value to set for the variable',
    },
    dataType: {
      type: 'string',
      required: false,
      description: 'Data type of the variable',
    },
    incrementValue: {
      type: 'number',
      required: false,
      description: 'Value to increment/decrement by',
    },
    scope: {
      type: 'string',
      required: false,
      description: 'Scope of the variable',
    },
    defaultValue: {
      type: 'any',
      required: false,
      description: "Default value if variable doesn't exist",
    },
    persistent: {
      type: 'boolean',
      required: false,
      description: 'Whether variable should persist',
    },
    encrypted: {
      type: 'boolean',
      required: false,
      description: 'Whether variable should be encrypted',
    },
  },

  // Request configuration is not needed due to directExecution, but the type requires it.
  request: {
    url: '', // Not used
    method: 'POST', // Not used
    headers: () => ({}), // Not used
  },

  directExecution: async (params: VariableManagerParams): Promise<VariableManagerResponse> => {
    try {
      const scope = params.scope || 'workflow'
      const variableName = params.variableName || 'defaultVar'
      const operation = params.operation || 'get'
      const key = `${scope}:${variableName}`
      let result: any
      let previousValue: any

      switch (operation) {
        case 'set':
          previousValue = variableStore[key]
          let value = params.variableValue

          // Convert value based on data type
          if (params.dataType && params.dataType !== 'auto') {
            value = convertValue(params.variableValue, params.dataType)
          }

          variableStore[key] = value
          result = value
          break

        case 'get':
          result = variableStore[key]
          if (result === undefined && params.defaultValue !== undefined) {
            result = params.defaultValue
          }
          break

        case 'increment':
          previousValue = variableStore[key] || 0
          const incrementBy = params.incrementValue || 1
          if (typeof previousValue === 'number') {
            result = previousValue + incrementBy
            variableStore[key] = result
          } else {
            throw new Error('Cannot increment non-numeric variable')
          }
          break

        case 'decrement':
          previousValue = variableStore[key] || 0
          const decrementBy = params.incrementValue || 1
          if (typeof previousValue === 'number') {
            result = previousValue - decrementBy
            variableStore[key] = result
          } else {
            throw new Error('Cannot decrement non-numeric variable')
          }
          break

        case 'append':
          previousValue = variableStore[key] || ''
          if (typeof previousValue === 'string') {
            result = previousValue + (params.variableValue || '')
            variableStore[key] = result
          } else if (Array.isArray(previousValue)) {
            result = [...previousValue, params.variableValue]
            variableStore[key] = result
          } else {
            throw new Error('Cannot append to non-string/non-array variable')
          }
          break

        case 'prepend':
          previousValue = variableStore[key] || ''
          if (typeof previousValue === 'string') {
            result = (params.variableValue || '') + previousValue
            variableStore[key] = result
          } else if (Array.isArray(previousValue)) {
            result = [params.variableValue, ...previousValue]
            variableStore[key] = result
          } else {
            throw new Error('Cannot prepend to non-string/non-array variable')
          }
          break

        case 'clear':
          previousValue = variableStore[key]
          delete variableStore[key]
          result = null
          break

        case 'exists':
          result = key in variableStore
          break

        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      const variableType =
        result === null ? 'null' : Array.isArray(result) ? 'array' : typeof result

      const content =
        operation === 'exists'
          ? `Variable '${variableName}' ${result ? 'exists' : 'does not exist'}`
          : `Variable '${variableName}' ${operation} operation completed`

      return {
        success: true,
        output: {
          content,
          variableName,
          variableValue: result,
          variableType,
          operation,
          previousValue,
        },
      }
    } catch (error) {
      return {
        success: false,
        output: {
          content: `Variable operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variableName: params.variableName || 'defaultVar',
          variableValue: null,
          variableType: 'error',
          operation: params.operation || 'get',
        },
      }
    }
  },
}

function convertValue(value: any, dataType: string): any {
  switch (dataType) {
    case 'string':
      return String(value)
    case 'number':
      const num = Number(value)
      if (isNaN(num)) throw new Error('Invalid number value')
      return num
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const lower = value.toLowerCase()
        if (lower === 'true' || lower === '1') return true
        if (lower === 'false' || lower === '0') return false
      }
      return Boolean(value)
    case 'object':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          throw new Error('Invalid JSON object')
        }
      }
      return value
    case 'array':
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (Array.isArray(parsed)) return parsed
          throw new Error('Not an array')
        } catch {
          // Try splitting by comma
          return value.split(',').map((item) => item.trim())
        }
      }
      return [value]
    default:
      return value
  }
}
