import { getAllBlocks } from '@/blocks'
import { getTool } from '@/tools/utils'

export interface StoredTool {
  type: string
  title: string
  params: Record<string, string>
  isExpanded?: boolean
  schema?: any // For custom tools
  code?: string // For custom tools implementation
  operation?: string // For tools with multiple operations
  usageControl?: 'auto' | 'force' | 'none' // Control how the tool is used
}

export interface ToolParam {
  id: string
  type: string
  description?: string
  requiredForToolCall: boolean
  optionalToolInput?: boolean
}

// Assumes the first tool in the access array is the tool to be used
// TODO: Switch to getting tools instead of tool blocks once we switch to providers
export const getToolIdFromBlock = (blockType: string): string | undefined => {
  const block = getAllBlocks().find((block) => block.type === blockType)
  return block?.tools.access[0]
}

// Get parameters that need to be displayed in the tool input UI
export const getToolDisplayParams = (toolId: string): ToolParam[] => {
  const tool = getTool(toolId)
  if (!tool) return []

  return Object.entries(tool.params)
    .filter(([_, param]) => param.requiredForToolCall || param.optionalToolInput)
    .map(([paramId, param]) => ({
      id: paramId,
      type: param.type,
      description: param.description,
      requiredForToolCall: param.requiredForToolCall ?? false,
      optionalToolInput: param.optionalToolInput ?? false,
    }))
}

// Keep this for backward compatibility - only get strictly required parameters
export const getRequiredToolParams = (toolId: string): ToolParam[] => {
  const tool = getTool(toolId)
  if (!tool) return []

  return Object.entries(tool.params)
    .filter(([_, param]) => param.requiredForToolCall || param.optionalToolInput)
    .map(([paramId, param]) => ({
      id: paramId,
      type: param.type,
      description: param.description,
      requiredForToolCall: param.requiredForToolCall ?? false,
      optionalToolInput: param.optionalToolInput ?? false,
    }))
}

// Check if a tool requires OAuth
export const getOAuthConfig = (toolId: string) => {
  const tool = getTool(toolId)
  return tool?.oauth
}

// For custom tools, extract parameters from the schema
export const getCustomToolParams = (schema: any): ToolParam[] => {
  if (!schema?.function?.parameters?.properties) return []

  const properties = schema.function.parameters.properties
  const required = schema.function.parameters.required || []
  const optionalInputs = schema.function.parameters.optionalToolInputs || []

  return Object.entries(properties).map(([paramId, param]: [string, any]) => ({
    id: paramId,
    type: param.type || 'string',
    description: param.description || '',
    requiredForToolCall: required.includes(paramId),
    optionalToolInput: optionalInputs.includes(paramId),
  }))
}

// Check if a block has multiple operations
export const hasMultipleOperations = (blockType: string): boolean => {
  const block = getAllBlocks().find((block) => block.type === blockType)
  return (block?.tools?.access?.length || 0) > 1
}

// Get operation options for a block
export const getOperationOptions = (blockType: string): { label: string; id: string }[] => {
  const block = getAllBlocks().find((block) => block.type === blockType)
  if (!block || !block.tools?.access) return []

  // Look for an operation dropdown in the block's subBlocks
  const operationSubBlock = block.subBlocks.find((sb) => sb.id === 'operation')
  if (
    operationSubBlock &&
    operationSubBlock.type === 'dropdown' &&
    Array.isArray(operationSubBlock.options)
  ) {
    return operationSubBlock.options as { label: string; id: string }[]
  }

  // Fallback: create options from tools.access
  return block.tools.access.map((toolId) => {
    const tool = getTool(toolId)
    return {
      id: toolId,
      label: tool?.name || toolId,
    }
  })
}

// Helper function to initialize tool parameters
export const initializeToolParams = (
  toolId: string,
  params: ToolParam[],
  subBlockStore: {
    resolveToolParamValue: (
      toolId: string,
      paramId: string,
      instanceId?: string
    ) => string | undefined
  },
  isAutoFillEnabled: boolean,
  instanceId?: string
): Record<string, string> => {
  const initialParams: Record<string, string> = {}

  // Only auto-fill parameters if the setting is enabled
  if (isAutoFillEnabled) {
    // For each parameter, check if we have a stored/resolved value
    params.forEach((param) => {
      const resolvedValue = subBlockStore.resolveToolParamValue(toolId, param.id, instanceId)
      if (resolvedValue) {
        initialParams[param.id] = resolvedValue
      }
    })
  }

  return initialParams
}

// Helper function to check if a tool has expandable content
export const hasExpandableContent = (
  isCustomTool: boolean,
  hasOperations: boolean,
  operationOptions: { label: string; id: string }[],
  toolId: string | null | undefined,
  requiredParams: ToolParam[]
): boolean => {
  // Custom tools are always expandable and handle their own content
  if (isCustomTool) return true

  // Check if it has operations
  if (hasOperations && operationOptions.length > 0) return true

  // Check if it has OAuth requirements
  if (toolId) {
    const oauthConfig = getOAuthConfig(toolId)
    if (oauthConfig?.required) return true
  }

  // Check if it has required parameters
  if (requiredParams.length > 0) return true

  // No expandable content
  return false
}

// Helper to format parameter IDs into human-readable labels
export const formatParamId = (paramId: string): string => {
  // Special case for common parameter names
  if (paramId === 'apiKey') return 'API Key'
  if (paramId === 'apiVersion') return 'API Version'

  // Handle underscore and hyphen separated words
  if (paramId.includes('_') || paramId.includes('-')) {
    return paramId
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Handle single character parameters
  if (paramId.length === 1) return paramId.toUpperCase()

  // Handle camelCase
  if (/[A-Z]/.test(paramId)) {
    const result = paramId.replace(/([A-Z])/g, ' $1')
    return (
      result.charAt(0).toUpperCase() +
      result
        .slice(1)
        .replace(/ Api/g, ' API')
        .replace(/ Id/g, ' ID')
        .replace(/ Url/g, ' URL')
        .replace(/ Uri/g, ' URI')
        .replace(/ Ui/g, ' UI')
    )
  }

  // Simple case - just capitalize first letter
  return paramId.charAt(0).toUpperCase() + paramId.slice(1)
}
