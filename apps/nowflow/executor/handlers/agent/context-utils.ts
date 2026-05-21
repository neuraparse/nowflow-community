import { ExecutionContext } from '../../types'

export const CONTEXT_FALLBACK_KEYS = [
  'customerMessage',
  'customerContext',
  'userInput',
  'message',
  'task',
  'objective',
  'initialContext',
  'problem',
  'query',
  'researchQuery',
  'prospectMessage',
  'prospectProfile',
  'contentBrief',
  'analysisGoal',
  'dataset',
  'prompt',
  'question',
  'instruction',
  'instructions',
  'goal',
  'input',
]

export const isEmptyContextValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length === 0
  }

  return false
}

export const normalizeContextValue = (value: unknown): string | undefined => {
  if (isEmptyContextValue(value)) {
    return undefined
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return String(value)
  }
}

export const resolveAgentContextValue = (
  inputs: Record<string, any>,
  context: ExecutionContext
): unknown => {
  if (!isEmptyContextValue(inputs.context)) {
    return inputs.context
  }

  for (const key of CONTEXT_FALLBACK_KEYS) {
    if (!isEmptyContextValue(inputs[key])) {
      return inputs[key]
    }
  }

  const starterBlock = context.workflow?.blocks.find((block) => block.metadata?.id === 'starter')
  if (!starterBlock) {
    return undefined
  }

  const starterState = context.blockStates.get(starterBlock.id)
  const response = starterState?.output?.response
  if (!response || typeof response !== 'object') {
    return response
  }

  if (Object.prototype.hasOwnProperty.call(response, 'input')) {
    return (response as { input?: unknown }).input
  }

  return response
}
