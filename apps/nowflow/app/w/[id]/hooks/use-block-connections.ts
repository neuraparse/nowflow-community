import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createLogger } from '@/lib/logs/console-logger'
import { useExecutionStore } from '@/stores/execution/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

const logger = createLogger('useBlockConnections')

interface Field {
  name: string
  type: string
  description?: string
}

export interface ConnectedBlock {
  id: string
  type: string
  outputType: string | string[]
  name: string
  responseFormat?: {
    // Support both formats
    fields?: Field[]
    name?: string
    schema?: {
      type: string
      properties: Record<string, any>
      required?: string[]
    }
  }
  // Execution results
  executionResult?: {
    output: any
    success: boolean
    error?: string
  }
  // Available output fields from actual execution
  availableFields?: Field[]
}

// Helper function to extract fields from JSON Schema
function extractFieldsFromSchema(schema: any): Field[] {
  logger.debug('extractFieldsFromSchema called with:', {
    schema,
    schemaType: typeof schema,
    schemaKeys: schema ? Object.keys(schema) : 'null',
  })

  if (!schema || typeof schema !== 'object') {
    logger.debug('extractFieldsFromSchema: Invalid schema, returning empty array')
    return []
  }

  // Skip invalid formats like {"e": {}}
  if (schema.e && Object.keys(schema).length === 1) {
    logger.debug(
      'extractFieldsFromSchema: Detected invalid format with "e" key, returning empty array'
    )
    return []
  }

  // Handle legacy format with fields array
  if (Array.isArray(schema.fields)) {
    logger.debug('extractFieldsFromSchema: Using legacy fields array:', schema.fields)
    return schema.fields
  }

  // Handle new JSON Schema format
  const schemaObj = schema.schema || schema
  logger.debug('extractFieldsFromSchema: Processing schema object:', {
    schemaObj,
    hasProperties: !!schemaObj?.properties,
    propertiesType: typeof schemaObj?.properties,
  })

  if (!schemaObj || !schemaObj.properties || typeof schemaObj.properties !== 'object') {
    logger.debug('extractFieldsFromSchema: No valid properties found, returning empty array')
    return []
  }

  // Extract fields from schema properties
  const fields = Object.entries(schemaObj.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type || 'string',
    description: prop.description,
  }))

  logger.debug('extractFieldsFromSchema: Extracted fields:', fields)
  return fields
}

/**
 * Finds all blocks along paths leading to the target block
 * This is a reverse traversal from the target node to find all ancestors
 * along connected paths
 * @param edges - List of all edges in the graph
 * @param targetNodeId - ID of the target block we're finding connections for
 * @returns Array of unique ancestor node IDs
 */
function findAllPathNodes(edges: any[], targetNodeId: string): string[] {
  // We'll use a reverse topological sort approach by tracking "distance" from target
  const nodeDistances = new Map<string, number>()
  const visited = new Set<string>()
  const queue: [string, number][] = [[targetNodeId, 0]] // [nodeId, distance]
  const pathNodes = new Set<string>()

  // Build a reverse adjacency list for faster traversal
  const reverseAdjList: Record<string, string[]> = {}
  for (const edge of edges) {
    if (!reverseAdjList[edge.target]) {
      reverseAdjList[edge.target] = []
    }
    reverseAdjList[edge.target].push(edge.source)
  }

  // BFS to find all ancestors and their shortest distance from target
  while (queue.length > 0) {
    const [currentNodeId, distance] = queue.shift()!

    if (visited.has(currentNodeId)) {
      // If we've seen this node before, update its distance if this path is shorter
      const currentDistance = nodeDistances.get(currentNodeId) || Infinity
      if (distance < currentDistance) {
        nodeDistances.set(currentNodeId, distance)
      }
      continue
    }

    visited.add(currentNodeId)
    nodeDistances.set(currentNodeId, distance)

    // Don't add the target node itself to the results
    if (currentNodeId !== targetNodeId) {
      pathNodes.add(currentNodeId)
    }

    // Get all incoming edges from the reverse adjacency list
    const incomingNodeIds = reverseAdjList[currentNodeId] || []

    // Add all source nodes to the queue with incremented distance
    for (const sourceId of incomingNodeIds) {
      queue.push([sourceId, distance + 1])
    }
  }

  return Array.from(pathNodes)
}

// Helper function to get execution results for a block
function getBlockExecutionResult(blockId: string) {
  const executionStore = useExecutionStore.getState()
  const debugContext = executionStore.debugContext

  logger.debug('getBlockExecutionResult called for:', {
    blockId,
    hasDebugContext: !!debugContext,
    completedBlocks: Array.from(executionStore.completedBlockIds),
    isCompleted: executionStore.completedBlockIds.has(blockId),
    debugContextKeys: debugContext ? Object.keys(debugContext) : [],
    blockStatesSize: debugContext?.blockStates?.size || 0,
    blockLogsCount: debugContext?.blockLogs?.length || 0,
  })

  // Check if block has been executed
  if (!executionStore.completedBlockIds.has(blockId)) {
    logger.debug('getBlockExecutionResult: Block not completed yet')
    return null
  }

  // Try to get from debug context first
  if (debugContext?.blockStates) {
    logger.debug('Checking blockStates:', {
      blockId,
      allBlockIds: Array.from(debugContext.blockStates.keys()),
      hasTargetBlock: debugContext.blockStates.has(blockId),
    })

    const blockState = debugContext.blockStates.get(blockId)
    if (blockState?.output) {
      logger.debug('Found in debug context blockStates:', {
        blockId,
        outputKeys: Object.keys(blockState.output),
        outputSample: JSON.stringify(blockState.output).substring(0, 200) + '...',
      })
      return {
        output: blockState.output,
        success: true,
      }
    }
  }

  // Try to get from execution logs if available
  if (debugContext?.blockLogs) {
    logger.debug('Checking blockLogs:', {
      blockId,
      totalLogs: debugContext.blockLogs.length,
      logBlockIds: debugContext.blockLogs.map((log) => log.blockId),
    })

    const blockLog = debugContext.blockLogs.find((log) => log.blockId === blockId)
    if (blockLog?.output) {
      logger.debug('Found in execution logs:', {
        blockId,
        outputKeys: Object.keys(blockLog.output),
        outputSample: JSON.stringify(blockLog.output).substring(0, 200) + '...',
        success: blockLog.success !== false,
      })
      return {
        output: blockLog.output,
        success: blockLog.success !== false,
        error: blockLog.error,
      }
    }
  }

  // Try to get from executor if available
  const executor = executionStore.executor
  if (executor) {
    logger.debug('Checking executor context:', {
      blockId,
      hasExecutor: !!executor,
    })

    // Try to access executor's context if available
    try {
      // This is a fallback - executor might have the data
      const executorContext = (executor as any).context
      if (executorContext?.blockStates) {
        const blockState = executorContext.blockStates.get(blockId)
        if (blockState?.output) {
          logger.debug('Found in executor context:', {
            blockId,
            outputKeys: Object.keys(blockState.output),
          })
          return {
            output: blockState.output,
            success: true,
          }
        }
      }
    } catch (e) {
      logger.debug('⚠️ Could not access executor context:', e)
    }
  }

  logger.debug('getBlockExecutionResult: No execution result found anywhere')
  return null
}

// Helper function to extract fields from actual execution output
function extractFieldsFromExecutionOutput(output: any): Field[] {
  logger.debug('extractFieldsFromExecutionOutput called with:', output)

  if (!output || typeof output !== 'object') {
    return []
  }

  // All block outputs are wrapped in a 'response' object (NormalizedBlockOutput format)
  // Extract fields from the response wrapper
  const responseData = output.response || output

  if (!responseData || typeof responseData !== 'object') {
    return []
  }

  // Extract all available fields from the actual output
  const fields: Field[] = []

  // Extract all fields directly from the response object
  Object.keys(responseData).forEach((key) => {
    const value = responseData[key]
    let type: string = typeof value
    let description = `${key} from execution result`

    // Determine more specific types
    if (Array.isArray(value)) {
      type = 'array'
      description = `Array with ${value.length} items`
    } else if (typeof value === 'object' && value !== null) {
      type = 'object'
      description = `Object with ${Object.keys(value).length} properties`
    } else if (typeof value === 'string') {
      type = 'string'
      if (key === 'content') description = 'Generated content'
      else if (key === 'model') description = 'Model used'
    } else if (typeof value === 'number') {
      type = 'number'
    } else if (typeof value === 'boolean') {
      type = 'boolean'
    }

    fields.push({
      name: key,
      type: type,
      description: description,
    })
  })

  // Note: Nested field extraction removed for simplicity
  // Fields are now extracted directly from root level only

  logger.debug('extractFieldsFromExecutionOutput: Extracted fields:', fields)
  return fields
}

// Debug function to inspect execution store state
function debugExecutionStore() {
  const executionStore = useExecutionStore.getState()
  logger.debug('Full Execution Store Debug:', {
    completedBlockIds: Array.from(executionStore.completedBlockIds),
    hasDebugContext: !!executionStore.debugContext,
    debugContextKeys: executionStore.debugContext ? Object.keys(executionStore.debugContext) : [],
    blockStatesSize: executionStore.debugContext?.blockStates?.size || 0,
    blockStatesKeys: executionStore.debugContext?.blockStates
      ? Array.from(executionStore.debugContext.blockStates.keys())
      : [],
    blockLogsCount: executionStore.debugContext?.blockLogs?.length || 0,
    hasExecutor: !!executionStore.executor,
    executorType: executionStore.executor ? executionStore.executor.constructor.name : 'none',
  })

  // Log all block states if available
  if (executionStore.debugContext?.blockStates) {
    executionStore.debugContext.blockStates.forEach((state, blockId) => {
      logger.debug(`📦 Block State [${blockId}]:`, {
        hasOutput: !!state.output,
        outputKeys: state.output ? Object.keys(state.output) : [],
        outputSample: state.output
          ? JSON.stringify(state.output).substring(0, 100) + '...'
          : 'none',
      })
    })
  }
}

export function useBlockConnections(blockId: string) {
  const { edges, blocks } = useWorkflowStore(
    useShallow((state) => ({
      edges: state.edges,
      blocks: state.blocks,
    }))
  )

  // Get execution state to check for completed blocks and their results
  const { completedBlockIds, debugContext } = useExecutionStore(
    useShallow((state) => ({
      completedBlockIds: state.completedBlockIds,
      debugContext: state.debugContext,
    }))
  )

  // Debug execution store state when there are completed blocks
  React.useEffect(() => {
    if (completedBlockIds.size > 0) {
      debugExecutionStore()
    }
  }, [completedBlockIds.size])

  // Find all blocks along paths leading to this block
  const allPathNodeIds = findAllPathNodes(edges, blockId)

  // Map each path node to a ConnectedBlock structure
  const allPathConnections = allPathNodeIds
    .map((sourceId) => {
      const sourceBlock = blocks[sourceId]
      if (!sourceBlock) return null

      // Get the response format from the subblock store
      const responseFormatValue = useSubBlockStore.getState().getValue(sourceId, 'responseFormat')

      // Debug logging for responseFormat retrieval
      if (process.env.NODE_ENV === 'development') {
        logger.debug('useBlockConnections - Getting responseFormat:', {
          sourceId,
          blockName: sourceBlock.name,
          responseFormatValue:
            typeof responseFormatValue === 'string'
              ? responseFormatValue.substring(0, 100) + '...'
              : responseFormatValue,
          valueType: typeof responseFormatValue,
        })
      }

      let responseFormat

      try {
        if (typeof responseFormatValue === 'string' && responseFormatValue) {
          // Check if it's a simple format type (json, text, markdown, etc.)
          const simpleFormats = ['json', 'text', 'markdown', 'html', 'xml', 'csv', 'detailed']
          const trimmed = responseFormatValue.trim()
          if (simpleFormats.includes(trimmed.toLowerCase())) {
            // Don't parse simple format types - they're just format indicators
            logger.debug('useBlockConnections - Simple format type detected:', {
              sourceId,
              format: responseFormatValue,
            })
            responseFormat = undefined // Don't use simple format strings as schema
          } else if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            // In-progress user input that is not valid JSON (e.g. still typing).
            // Skip silently — logging an error on every keystroke floods the
            // console and the field is expected to be invalid while editing.
            responseFormat = undefined
          } else {
            // Try to parse as JSON schema
            const parsed = JSON.parse(responseFormatValue)
            // Validate that the parsed object is a valid response format
            if (parsed && typeof parsed === 'object' && !parsed.e) {
              responseFormat = parsed
              logger.debug('useBlockConnections - Successfully parsed responseFormat:', {
                sourceId,
                parsed,
              })
            } else {
              logger.warn('Invalid response format detected, ignoring:', responseFormatValue)
              responseFormat = undefined
            }
          }
        } else {
          responseFormat = responseFormatValue // Handle case where it's already an object
          logger.debug('useBlockConnections - Using responseFormat as object:', {
            sourceId,
            responseFormat,
          })
        }
      } catch {
        // Malformed JSON from user input — normal during editing. Debug-level only.
        logger.debug('useBlockConnections - Skipping malformed responseFormat:', {
          sourceId,
        })
        responseFormat = undefined
      }

      // Get the default output type from the block's outputs
      const defaultOutputs: Field[] = Object.entries(sourceBlock.outputs || {}).map(([key]) => ({
        name: key,
        type: 'string',
      }))

      // Get execution results for this block
      const executionResult = getBlockExecutionResult(sourceId)

      // Extract fields from execution output if available, otherwise use response format
      let availableFields: Field[] = []
      if (executionResult?.output) {
        logger.debug('useBlockConnections - Extracting fields from execution output:', {
          sourceId,
          blockName: sourceBlock.name,
          executionOutput: executionResult.output,
          outputKeys: Object.keys(executionResult.output),
          outputType: typeof executionResult.output,
        })
        availableFields = extractFieldsFromExecutionOutput(executionResult.output)
        logger.debug('useBlockConnections - Extracted available fields:', {
          sourceId,
          availableFields: availableFields,
          fieldCount: availableFields.length,
        })
      } else {
        logger.debug('useBlockConnections - No execution result found for:', {
          sourceId,
          blockName: sourceBlock.name,
          hasExecutionResult: !!executionResult,
          executionResultKeys: executionResult ? Object.keys(executionResult) : [],
        })
      }

      // Use execution fields if available, otherwise fall back to response format fields
      const outputFields =
        availableFields.length > 0
          ? availableFields
          : responseFormat
            ? extractFieldsFromSchema(responseFormat)
            : defaultOutputs

      return {
        id: sourceBlock.id,
        type: sourceBlock.type,
        outputType: outputFields.map((field: Field) => field.name),
        name: sourceBlock.name,
        responseFormat,
        executionResult,
        availableFields: availableFields.length > 0 ? availableFields : undefined,
      }
    })
    .filter(Boolean) as ConnectedBlock[]

  // Keep the original incoming connections for compatibility
  const directIncomingConnections = edges
    .filter((edge) => edge.target === blockId)
    .map((edge) => {
      const sourceBlock = blocks[edge.source]

      // Safety check: if sourceBlock is undefined, skip this connection
      if (!sourceBlock) {
        logger.warn(`Source block ${edge.source} not found for edge to ${blockId}`)
        return null
      }

      // Get the response format from the subblock store instead
      const responseFormatValue = useSubBlockStore
        .getState()
        .getValue(edge.source, 'responseFormat')

      let responseFormat

      try {
        if (typeof responseFormatValue === 'string' && responseFormatValue) {
          // Check if it's a simple format type (json, text, markdown, etc.)
          const simpleFormats = ['json', 'text', 'markdown', 'html', 'xml', 'csv', 'detailed']
          const trimmed = responseFormatValue.trim()
          if (simpleFormats.includes(trimmed.toLowerCase())) {
            // Don't parse simple format types - they're just format indicators
            responseFormat = undefined // Don't use simple format strings as schema
          } else if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            // In-progress user input that is not valid JSON. Skip silently.
            responseFormat = undefined
          } else {
            // Try to parse as JSON schema
            const parsed = JSON.parse(responseFormatValue)
            // Validate that the parsed object is a valid response format
            if (parsed && typeof parsed === 'object' && !parsed.e) {
              responseFormat = parsed
            } else {
              logger.warn('Invalid response format detected, ignoring:', responseFormatValue)
              responseFormat = undefined
            }
          }
        } else {
          responseFormat = responseFormatValue // Handle case where it's already an object
        }
      } catch {
        // Malformed JSON from user input — normal during editing. Debug-level only.
        logger.debug('useBlockConnections - Skipping malformed responseFormat:', {
          sourceId: edge.source,
        })
        responseFormat = undefined
      }

      // Get the default output type from the block's outputs
      const defaultOutputs: Field[] = Object.entries(sourceBlock.outputs || {}).map(([key]) => ({
        name: key,
        type: 'string',
      }))

      // Extract fields from the response format using our helper function
      const outputFields = responseFormat ? extractFieldsFromSchema(responseFormat) : defaultOutputs

      return {
        id: sourceBlock.id,
        type: sourceBlock.type,
        outputType: outputFields.map((field: Field) => field.name),
        name: sourceBlock.name,
        responseFormat,
      }
    })
    .filter(Boolean) as ConnectedBlock[] // Filter out null values

  return {
    incomingConnections: allPathConnections,
    directIncomingConnections,
    hasIncomingConnections: allPathConnections.length > 0,
  }
}
