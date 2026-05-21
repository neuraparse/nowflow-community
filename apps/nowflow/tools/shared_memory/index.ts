import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('SharedMemoryTool')

export interface SharedMemoryParams {
  // Operation
  operation: 'get' | 'set' | 'delete' | 'increment' | 'append' | 'cas'
  key: string

  // Value (for set operations)
  value?: any
  defaultValue?: any

  // Advanced options
  scope?: 'execution' | 'workflow' | 'global'
  ttl?: number
  version?: number // For compare-and-swap
  appendValue?: any // For append operation
  incrementBy?: number // For increment operation

  // Context
  workflowId?: string
  executionId?: string
}

export interface SharedMemoryResponse extends ToolResponse {
  output: {
    key: string
    value: any
    exists: boolean
    version?: number
    previousValue?: any
    updated?: boolean
  }
}

// In-memory store for execution-scoped data (reset per execution)
const memoryStore: Map<string, { value: any; version: number; expiresAt?: number }> = new Map()

export const sharedMemoryTool: ToolConfig<SharedMemoryParams, SharedMemoryResponse> = {
  id: 'shared_memory',
  name: 'Shared Memory',
  description: 'Shared key-value store for agents to read/write data during workflow execution',
  version: '1.0.0',

  params: {
    operation: {
      type: 'string',
      required: true,
      description:
        'Memory operation: get, set, delete, increment, append, or cas (compare-and-swap)',
    },
    key: {
      type: 'string',
      required: true,
      description: 'Memory key to operate on',
    },
    value: {
      type: 'any',
      required: false,
      description: 'Value to set (for set/cas operations)',
    },
    defaultValue: {
      type: 'any',
      required: false,
      description: 'Default value if key does not exist (for get operation)',
    },
    scope: {
      type: 'string',
      required: false,
      default: 'execution',
      description: 'Memory scope: execution (default), workflow, or global',
    },
    ttl: {
      type: 'number',
      required: false,
      description: 'Time-to-live in seconds (optional)',
    },
    version: {
      type: 'number',
      required: false,
      description: 'Expected version for compare-and-swap operation',
    },
    appendValue: {
      type: 'any',
      required: false,
      description: 'Value to append (for append operation on arrays)',
    },
    incrementBy: {
      type: 'number',
      required: false,
      default: 1,
      description: 'Amount to increment (for increment operation)',
    },
    workflowId: {
      type: 'string',
      required: false,
      description: 'Workflow ID for scoping',
    },
    executionId: {
      type: 'string',
      required: false,
      description: 'Execution ID for scoping',
    },
  },

  request: {
    url: '/api/agents/memory',
    method: 'POST',
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    body: (params) => ({
      operation: params.operation,
      key: params.key,
      value: params.value,
      defaultValue: params.defaultValue,
      scope: params.scope || 'execution',
      ttl: params.ttl,
      version: params.version,
      appendValue: params.appendValue,
      incrementBy: params.incrementBy,
      workflowId: params.workflowId,
      executionId: params.executionId,
    }),
    isInternalRoute: true,
  },

  // Direct in-memory execution for performance
  directExecution: async (params) => {
    const fullKey = `${params.scope || 'execution'}:${params.workflowId || 'default'}:${params.executionId || 'default'}:${params.key}`
    const now = Date.now()

    // Clean expired entries
    for (const [k, v] of memoryStore.entries()) {
      if (v.expiresAt && v.expiresAt < now) {
        memoryStore.delete(k)
      }
    }

    switch (params.operation) {
      case 'get': {
        const entry = memoryStore.get(fullKey)
        if (!entry || (entry.expiresAt && entry.expiresAt < now)) {
          return {
            success: true,
            output: {
              key: params.key,
              value: params.defaultValue ?? null,
              exists: false,
            },
          }
        }
        return {
          success: true,
          output: {
            key: params.key,
            value: entry.value,
            exists: true,
            version: entry.version,
          },
        }
      }

      case 'set': {
        const existingEntry = memoryStore.get(fullKey)
        const newVersion = (existingEntry?.version ?? 0) + 1
        const expiresAt = params.ttl ? now + params.ttl * 1000 : undefined

        memoryStore.set(fullKey, {
          value: params.value,
          version: newVersion,
          expiresAt,
        })

        logger.debug('Shared memory set', { key: params.key, version: newVersion })

        return {
          success: true,
          output: {
            key: params.key,
            value: params.value,
            exists: true,
            version: newVersion,
            previousValue: existingEntry?.value,
            updated: true,
          },
        }
      }

      case 'delete': {
        const existingEntry = memoryStore.get(fullKey)
        memoryStore.delete(fullKey)

        return {
          success: true,
          output: {
            key: params.key,
            value: null,
            exists: false,
            previousValue: existingEntry?.value,
            updated: !!existingEntry,
          },
        }
      }

      case 'increment': {
        const existingEntry = memoryStore.get(fullKey)
        const currentValue = existingEntry?.value ?? 0
        const incrementBy = params.incrementBy ?? 1
        const newValue = (typeof currentValue === 'number' ? currentValue : 0) + incrementBy
        const newVersion = (existingEntry?.version ?? 0) + 1

        memoryStore.set(fullKey, {
          value: newValue,
          version: newVersion,
          expiresAt: existingEntry?.expiresAt,
        })

        return {
          success: true,
          output: {
            key: params.key,
            value: newValue,
            exists: true,
            version: newVersion,
            previousValue: currentValue,
            updated: true,
          },
        }
      }

      case 'append': {
        const existingEntry = memoryStore.get(fullKey)
        const currentValue = existingEntry?.value ?? []
        const newValue = Array.isArray(currentValue)
          ? [...currentValue, params.appendValue]
          : [currentValue, params.appendValue]
        const newVersion = (existingEntry?.version ?? 0) + 1

        memoryStore.set(fullKey, {
          value: newValue,
          version: newVersion,
          expiresAt: existingEntry?.expiresAt,
        })

        return {
          success: true,
          output: {
            key: params.key,
            value: newValue,
            exists: true,
            version: newVersion,
            previousValue: currentValue,
            updated: true,
          },
        }
      }

      case 'cas': {
        const existingEntry = memoryStore.get(fullKey)

        if (existingEntry && params.version !== existingEntry.version) {
          return {
            success: false,
            output: {
              key: params.key,
              value: existingEntry.value,
              exists: true,
              version: existingEntry.version,
              updated: false,
            },
            error: `Version mismatch: expected ${params.version}, got ${existingEntry.version}`,
          }
        }

        const newVersion = (existingEntry?.version ?? 0) + 1
        const expiresAt = params.ttl ? now + params.ttl * 1000 : existingEntry?.expiresAt

        memoryStore.set(fullKey, {
          value: params.value,
          version: newVersion,
          expiresAt,
        })

        return {
          success: true,
          output: {
            key: params.key,
            value: params.value,
            exists: true,
            version: newVersion,
            previousValue: existingEntry?.value,
            updated: true,
          },
        }
      }

      default:
        return {
          success: false,
          output: {
            key: params.key,
            value: null,
            exists: false,
          },
          error: `Unknown operation: ${params.operation}`,
        }
    }
  },

  transformResponse: async (response: Response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Shared memory API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      success: true,
      output: {
        key: data.key,
        value: data.value,
        exists: data.exists ?? true,
        version: data.version,
        previousValue: data.previousValue,
        updated: data.updated,
      },
    }
  },

  transformError: (error) => {
    logger.error('Shared memory error:', error)
    return `Shared memory error: ${error instanceof Error ? error.message : String(error)}`
  },
}

export default sharedMemoryTool
