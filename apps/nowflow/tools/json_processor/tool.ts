import { ToolConfig, ToolResponse } from '../types'

interface JSONProcessorParams {
  inputData: any
  operation: string
  outputFormat?: string
  fieldPath?: string
  filterCondition?: string
  mapFunction?: string
  mergeData?: any
  schema?: any
  preserveTypes?: boolean
  sortKeys?: boolean
}

interface JSONProcessorResponse extends ToolResponse {
  output: {
    content: string
    originalData: any
    processedData: any
    operation: string
    dataType: string
    size: number
    metadata: Record<string, any>
  }
}

export const jsonProcessorTool: ToolConfig<JSONProcessorParams, JSONProcessorResponse> = {
  id: 'json_processor',
  name: 'JSON Processor',
  description: 'Process and transform JSON data',
  version: '1.0.0',

  params: {
    inputData: {
      type: 'any',
      required: false,
      description: 'The JSON data to process',
    },
    operation: {
      type: 'string',
      required: false,
      description: 'The operation to perform',
    },
    outputFormat: {
      type: 'string',
      required: false,
      description: 'Output format',
    },
    fieldPath: {
      type: 'string',
      required: false,
      description: 'Field path or JSONPath expression',
    },
    filterCondition: {
      type: 'string',
      required: false,
      description: 'Filter condition function',
    },
    mapFunction: {
      type: 'string',
      required: false,
      description: 'Map transformation function',
    },
    mergeData: {
      type: 'any',
      required: false,
      description: 'Data to merge',
    },
    schema: {
      type: 'any',
      required: false,
      description: 'JSON schema for validation',
    },
    preserveTypes: {
      type: 'boolean',
      required: false,
      description: 'Whether to preserve data types',
    },
    sortKeys: {
      type: 'boolean',
      required: false,
      description: 'Whether to sort object keys',
    },
  },

  // Request configuration is not needed due to directExecution, but the type requires it.
  request: {
    url: '', // Not used
    method: 'POST', // Not used
    headers: () => ({}), // Not used
  },

  directExecution: async (params: JSONProcessorParams): Promise<JSONProcessorResponse> => {
    try {
      let data = params.inputData || '{}'
      let processedData = data
      const metadata: Record<string, any> = {}
      const operation = params.operation || 'validate'

      // Parse input data if it's a string
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
          processedData = data
        } catch (e) {
          throw new Error('Invalid JSON input')
        }
      }

      switch (operation) {
        case 'validate':
          try {
            if (typeof data === 'string') {
              JSON.parse(data)
            }
            metadata.valid = true
            processedData = data
          } catch (e) {
            metadata.valid = false
            metadata.error = e instanceof Error ? e.message : 'Invalid JSON'
          }
          break

        case 'format':
          processedData = data
          break

        case 'minify':
          processedData = data
          break

        case 'extract':
          if (params.fieldPath) {
            processedData = extractField(data, params.fieldPath)
          }
          break

        case 'filter':
          if (Array.isArray(data) && params.filterCondition) {
            try {
              const filterFn = new Function(
                'item',
                'index',
                'array',
                `return ${params.filterCondition}`
              ) as (item: any, index: number, array: any[]) => boolean
              processedData = data.filter(filterFn)
            } catch (e) {
              throw new Error('Invalid filter condition')
            }
          }
          break

        case 'map':
          if (Array.isArray(data) && params.mapFunction) {
            try {
              const mapFn = new Function(
                'item',
                'index',
                'array',
                `return ${params.mapFunction}`
              ) as (item: any, index: number, array: any[]) => any
              processedData = data.map(mapFn)
            } catch (e) {
              throw new Error('Invalid map function')
            }
          }
          break

        case 'merge':
          if (params.mergeData) {
            if (Array.isArray(data) && Array.isArray(params.mergeData)) {
              processedData = [...data, ...params.mergeData]
            } else if (typeof data === 'object' && typeof params.mergeData === 'object') {
              processedData = { ...data, ...params.mergeData }
            }
          }
          break

        case 'flatten':
          processedData = flattenObject(data)
          break

        case 'unflatten':
          processedData = unflattenObject(data)
          break

        case 'to_csv':
          if (Array.isArray(data)) {
            processedData = arrayToCSV(data)
          }
          break

        case 'to_xml':
          processedData = jsonToXML(data)
          break
      }

      // Sort keys if requested
      if (params.sortKeys && typeof processedData === 'object') {
        processedData = sortObjectKeys(processedData)
      }

      // Format output
      let content = ''
      const outputFormat = params.outputFormat || 'json'

      switch (outputFormat) {
        case 'string':
          content =
            typeof processedData === 'string' ? processedData : JSON.stringify(processedData)
          break
        case 'json':
          content = JSON.stringify(processedData, null, 2)
          break
        case 'array':
          content = Array.isArray(processedData)
            ? JSON.stringify(processedData, null, 2)
            : JSON.stringify([processedData], null, 2)
          break
        case 'object':
          content = JSON.stringify(processedData, null, 2)
          break
        default:
          content = JSON.stringify(processedData, null, 2)
      }

      const dataType = Array.isArray(processedData) ? 'array' : typeof processedData
      const size = JSON.stringify(processedData).length

      return {
        success: true,
        output: {
          content,
          originalData: params.inputData,
          processedData,
          operation: params.operation,
          dataType,
          size,
          metadata,
        },
      }
    } catch (error) {
      return {
        success: false,
        output: {
          content: '',
          originalData: params.inputData,
          processedData: null,
          operation: params.operation,
          dataType: 'error',
          size: 0,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      }
    }
  },
}

// Helper functions
function extractField(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      return current[key]
    }
    return undefined
  }, obj)
}

function flattenObject(obj: any, prefix = ''): any {
  const flattened: any = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, flattenObject(obj[key], newKey))
      } else {
        flattened[newKey] = obj[key]
      }
    }
  }

  return flattened
}

function unflattenObject(obj: any): any {
  const result: any = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const keys = key.split('.')
      let current = result

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }

      current[keys[keys.length - 1]] = obj[key]
    }
  }

  return result
}

function arrayToCSV(array: any[]): string {
  if (!array.length) return ''

  const headers = Object.keys(array[0])
  const csvContent = [
    headers.join(','),
    ...array.map((row) => headers.map((header) => JSON.stringify(row[header] || '')).join(',')),
  ]

  return csvContent.join('\n')
}

function jsonToXML(obj: any, rootName = 'root'): string {
  function objectToXML(obj: any, name: string): string {
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return `<${name}>${obj}</${name}>`
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => objectToXML(item, name)).join('')
    }

    if (typeof obj === 'object' && obj !== null) {
      const content = Object.keys(obj)
        .map((key) => objectToXML(obj[key], key))
        .join('')
      return `<${name}>${content}</${name}>`
    }

    return `<${name}></${name}>`
  }

  return objectToXML(obj, rootName)
}

function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }

  if (typeof obj === 'object' && obj !== null) {
    const sorted: any = {}
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sorted[key] = sortObjectKeys(obj[key])
      })
    return sorted
  }

  return obj
}
