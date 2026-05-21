import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { safeStorage } from '@/stores/safe-storage'
import { useChatStore } from '../chat/store'
import { ConsoleEntry, ConsoleStore, ErrorCategory, ErrorMetadata } from './types'

// MAX across all workflows
const MAX_ENTRIES = 50
// MAX per workflow
const MAX_ENTRIES_PER_WORKFLOW = 30

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
  'apikey',
  'api_key',
  'access_token',
  'accesstoken',
  'password',
  'passwd',
  'secret',
  'bearer',
  'authorization',
  'auth_token',
  'authtoken',
  'private_key',
  'privatekey',
  'client_secret',
  'clientsecret',
]

/**
 * Checks if a key name matches sensitive patterns
 */
const isSensitiveKey = (key: string): boolean => {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_PATTERNS.some((pattern) => lowerKey.includes(pattern))
}

/**
 * Recursively redacts sensitive data in an object
 * @param obj The object to redact sensitive data from
 * @param visited Set to track visited objects (prevents circular references)
 * @returns A new object with sensitive data redacted
 */
const redactSensitiveData = (obj: any, visited = new WeakSet()): any => {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  // Prevent circular references
  if (visited.has(obj)) {
    return '[Circular Reference]'
  }

  visited.add(obj)

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, visited))
  }

  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Check if the key matches sensitive patterns
    if (isSensitiveKey(key)) {
      result[key] = '***REDACTED***'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value, visited)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Determines the error category based on error code and type
 * @param errorCode The error code (e.g., 'TIMEOUT', 'VALIDATION_ERROR')
 * @param errorType The error type (e.g., 'runtime', 'network')
 * @param errorMessage The error message string
 * @returns The determined error category
 */
const determineErrorCategory = (
  errorCode?: string,
  errorType?: string,
  errorMessage?: string
): ErrorCategory => {
  const code = errorCode?.toUpperCase() || ''
  const type = errorType?.toLowerCase() || ''
  const message = errorMessage?.toLowerCase() || ''

  // Validation errors
  if (
    code.includes('VALIDATION') ||
    code.includes('MISSING_INPUT') ||
    code.includes('INVALID_FORMAT') ||
    code.includes('INVALID') ||
    type === 'validation' ||
    message.includes('validation') ||
    message.includes('required') ||
    message.includes('invalid')
  ) {
    return 'validation'
  }

  // Network errors
  if (
    code.includes('NETWORK') ||
    code.includes('TIMEOUT') ||
    code.includes('CONNECTION') ||
    code.includes('ECONNREFUSED') ||
    code.includes('ENOTFOUND') ||
    type === 'network' ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection')
  ) {
    return 'network'
  }

  // Authentication errors
  if (
    code.includes('UNAUTHORIZED') ||
    code.includes('FORBIDDEN') ||
    code.includes('TOKEN_EXPIRED') ||
    code.includes('AUTH') ||
    code === '401' ||
    code === '403' ||
    type === 'authentication' ||
    type === 'auth' ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication') ||
    message.includes('token expired')
  ) {
    return 'auth'
  }

  // API errors
  if (
    code.includes('API_ERROR') ||
    code.includes('RATE_LIMITED') ||
    code.includes('BAD_REQUEST') ||
    code.includes('RATE_LIMIT') ||
    code === '400' ||
    code === '429' ||
    code === '500' ||
    code === '502' ||
    code === '503' ||
    type === 'api' ||
    message.includes('rate limit') ||
    message.includes('api error')
  ) {
    return 'api'
  }

  // Runtime errors
  if (
    code.includes('RUNTIME') ||
    code.includes('NULL_POINTER') ||
    code.includes('TYPE_ERROR') ||
    code.includes('REFERENCE_ERROR') ||
    type === 'runtime' ||
    message.includes('undefined') ||
    message.includes('null') ||
    message.includes('typeerror') ||
    message.includes('referenceerror')
  ) {
    return 'runtime'
  }

  return 'unknown'
}

/**
 * Extracts error metadata from various error sources
 * @param error The error string or object
 * @param blockMetrics Optional block metrics containing detailed error info
 * @returns ErrorMetadata object
 */
const extractErrorMetadata = (
  error?: string,
  blockMetrics?: { error?: { code?: string; type?: string; stack?: string; message?: string } }
): ErrorMetadata | undefined => {
  if (!error) return undefined

  const errorInfo = blockMetrics?.error
  const code = errorInfo?.code
  const type = errorInfo?.type
  const stack = errorInfo?.stack
  const category = determineErrorCategory(code, type, error)

  return {
    code,
    type,
    category,
    stack,
  }
}

/**
 * Gets a nested property value from an object using a path string
 * @param obj The object to get the value from
 * @param path The path to the value (e.g. 'response.content')
 * @returns The value at the path, or undefined if not found
 */
const getValueByPath = (obj: any, path: string): any => {
  if (!obj || !path) return undefined

  const pathParts = path.split('.')
  let current = obj

  for (const part of pathParts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = current[part]
  }

  return current
}

export const useConsoleStore = create<ConsoleStore>()(
  devtools(
    persist(
      (set, get) => ({
        entries: [],
        isOpen: false,

        addConsole: (entry: Omit<ConsoleEntry, 'id' | 'timestamp'>) => {
          set((state) => {
            // Determine early if this entry represents a streaming output
            const isStreamingOutput =
              (typeof ReadableStream !== 'undefined' && entry.output instanceof ReadableStream) ||
              (typeof entry.output === 'object' &&
                entry.output &&
                entry.output.isStreaming === true) ||
              (typeof entry.output === 'object' &&
                entry.output &&
                'executionData' in entry.output &&
                typeof entry.output.executionData === 'object' &&
                entry.output.executionData?.isStreaming === true) ||
              (typeof entry.output === 'object' && entry.output && 'stream' in entry.output) ||
              (typeof entry.output === 'object' &&
                entry.output &&
                'stream' in entry.output &&
                'execution' in entry.output)

            // Skip adding raw streaming objects that have both stream and executionData
            if (
              typeof entry.output === 'object' &&
              entry.output &&
              'stream' in entry.output &&
              'executionData' in entry.output
            ) {
              // Don't add this entry - it will be processed by our explicit formatting code in executor/index.ts
              return { entries: state.entries }
            }

            // Also skip raw StreamingExecution objects (with stream and execution properties)
            if (
              typeof entry.output === 'object' &&
              entry.output &&
              'stream' in entry.output &&
              'execution' in entry.output
            ) {
              // Don't add this entry to prevent duplicate console entries for streaming responses
              return { entries: state.entries }
            }

            // Create a new entry with redacted API keys (if not a stream)
            const redactedEntry = { ...entry }

            // If output is a stream, we skip redaction (it's not an object we want to recurse into)
            if (
              !isStreamingOutput &&
              redactedEntry.output &&
              typeof redactedEntry.output === 'object'
            ) {
              redactedEntry.output = redactSensitiveData(redactedEntry.output)
            }

            // Extract error metadata if there's an error
            const errorMetadata = entry.error ? extractErrorMetadata(entry.error) : undefined

            // Create the new entry with ID and timestamp
            const newEntry = {
              ...redactedEntry,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              errorMetadata,
            }

            // Keep only the last MAX_ENTRIES globally
            let newEntries = [newEntry, ...state.entries].slice(0, MAX_ENTRIES)

            // Also enforce per-workflow limit
            if (entry.workflowId) {
              const workflowEntries = newEntries.filter((e) => e.workflowId === entry.workflowId)
              if (workflowEntries.length > MAX_ENTRIES_PER_WORKFLOW) {
                // Remove oldest entries for this workflow
                const entriesToRemove = workflowEntries
                  .slice(MAX_ENTRIES_PER_WORKFLOW)
                  .map((e) => e.id)
                newEntries = newEntries.filter((e) => !entriesToRemove.includes(e.id))
              }
            }

            // If the block produced a streaming output, skip automatic chat message creation
            if (isStreamingOutput) {
              return { entries: newEntries }
            }

            // Check if this block matches a selected workflow output
            if (entry.workflowId && entry.blockName) {
              const chatStore = useChatStore.getState()
              const selectedOutputIds = chatStore.getSelectedWorkflowOutput(entry.workflowId)

              if (selectedOutputIds && selectedOutputIds.length > 0) {
                // Process each selected output that matches this block
                for (const selectedOutputId of selectedOutputIds) {
                  // The selectedOutputId format is "{blockId}_{path}"
                  // We need to extract both components
                  const idParts = selectedOutputId.split('_')
                  const selectedBlockId = idParts[0]
                  // Reconstruct the path by removing the blockId part
                  const selectedPath = idParts.slice(1).join('.')

                  // If this block matches the selected output for this workflow
                  if (selectedBlockId && entry.blockId === selectedBlockId) {
                    // Extract the specific value from the output using the path
                    let specificValue: any = undefined

                    if (selectedPath) {
                      specificValue = getValueByPath(entry.output, selectedPath)
                    } else {
                      specificValue = entry.output
                    }

                    // Format the value appropriately for display
                    let formattedValue: string
                    // For streaming responses, use empty string and set isStreaming flag
                    if (isStreamingOutput) {
                      // Skip adding a message since we'll handle streaming in workflow execution
                      // This prevents the "Output value not found" message for streams
                      continue
                    } else if (specificValue === undefined) {
                      formattedValue = 'Output value not found'
                    } else if (typeof specificValue === 'object') {
                      formattedValue = JSON.stringify(specificValue, null, 2)
                    } else {
                      formattedValue = String(specificValue)
                    }

                    // Skip empty content messages (important for preventing empty entries)
                    if (!formattedValue || formattedValue.trim() === '') {
                      continue
                    }

                    // Add the specific value to chat, not the whole output
                    chatStore.addMessage({
                      content: formattedValue,
                      workflowId: entry.workflowId,
                      type: 'workflow',
                      blockId: entry.blockId,
                      isStreaming: isStreamingOutput,
                    })
                  }
                }
              }
            }

            return { entries: newEntries }
          })

          // Return the created entry by finding it in the updated store
          return get().entries[0]
        },

        clearConsole: (workflowId: string | null) => {
          set((state) => ({
            entries: state.entries.filter(
              (entry) => !workflowId || entry.workflowId !== workflowId
            ),
          }))
        },

        getWorkflowEntries: (workflowId) => {
          return get().entries.filter((entry) => entry.workflowId === workflowId)
        },

        toggleConsole: () => {
          set((state) => ({ isOpen: !state.isOpen }))
        },

        updateConsole: (
          entryId: string,
          updatedData: Partial<Omit<ConsoleEntry, 'id' | 'timestamp'>>
        ) => {
          set((state) => {
            const updatedEntries = state.entries.map((entry) => {
              if (entry.id === entryId) {
                return {
                  ...entry,
                  ...updatedData,
                  output: updatedData.output
                    ? redactSensitiveData(updatedData.output)
                    : entry.output,
                }
              }
              return entry
            })
            return { entries: updatedEntries }
          })
        },

        // Search entries by text
        searchEntries: (query: string, workflowId?: string) => {
          const entries = workflowId
            ? get().entries.filter((e) => e.workflowId === workflowId)
            : get().entries

          if (!query.trim()) return entries

          const lowerQuery = query.toLowerCase()
          return entries.filter((entry) => {
            const searchableText = [
              entry.blockName,
              entry.blockType,
              entry.error,
              entry.warning,
              JSON.stringify(entry.output),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

            return searchableText.includes(lowerQuery)
          })
        },

        // Filter entries by criteria
        filterEntries: (criteria: {
          workflowId?: string
          blockType?: string
          hasError?: boolean
          hasWarning?: boolean
          minDuration?: number
          maxDuration?: number
        }) => {
          return get().entries.filter((entry) => {
            if (criteria.workflowId && entry.workflowId !== criteria.workflowId) return false
            if (criteria.blockType && entry.blockType !== criteria.blockType) return false
            if (criteria.hasError !== undefined && !!entry.error !== criteria.hasError) return false
            if (criteria.hasWarning !== undefined && !!entry.warning !== criteria.hasWarning)
              return false
            if (criteria.minDuration && entry.durationMs < criteria.minDuration) return false
            if (criteria.maxDuration && entry.durationMs > criteria.maxDuration) return false
            return true
          })
        },

        // Export entries as JSON
        exportEntries: (workflowId?: string) => {
          const entries = workflowId
            ? get().entries.filter((e) => e.workflowId === workflowId)
            : get().entries

          return JSON.stringify(entries, null, 2)
        },

        // Get statistics
        getStatistics: (workflowId?: string) => {
          const entries = workflowId
            ? get().entries.filter((e) => e.workflowId === workflowId)
            : get().entries

          return {
            total: entries.length,
            errors: entries.filter((e) => e.error).length,
            warnings: entries.filter((e) => e.warning).length,
            success: entries.filter((e) => !e.error && !e.warning).length,
            avgDuration:
              entries.length > 0
                ? entries.reduce((sum, e) => sum + e.durationMs, 0) / entries.length
                : 0,
            totalDuration: entries.reduce((sum, e) => sum + e.durationMs, 0),
          }
        },
      }),
      {
        name: 'console-store',
        storage: safeStorage,
      }
    )
  )
)
