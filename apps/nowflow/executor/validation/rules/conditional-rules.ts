/**
 * Conditional validation rules that depend on other input values.
 * Primary use case: apiKey required only for non-Ollama (cloud) models.
 *
 * @module executor/validation/rules/conditional-rules
 */
import { getDefaultModel } from '@/lib/ai/provider-config'
import type { ValidationIssue } from '../validation-result'

export interface ConditionalRule {
  /** The field to validate */
  field: string
  /** Returns true if this rule should be applied given the current inputs */
  condition: (inputs: Record<string, any>) => boolean
  /** 'required' = must be non-empty, 'optional' = skip, function = custom check */
  rule: 'required' | 'optional' | ((value: any) => boolean | string)
  /** Error/warning message when rule fails */
  message: string
  /** Severity: error stops execution, warning just logs */
  severity: 'error' | 'warning'
  /** Optional suggestion for fixing */
  suggestion?: string
}

// Ollama local models don't need API keys. This list is a whitelist of
// known-free model IDs used for quick lookup. The primary identification
// path is the `ollama://` protocol + cloud-prefix exclusion below, so this
// list is best-effort only and does not need to enumerate every model.
const OLLAMA_MODELS = ['llama3.2:1b', 'llama3.2:3b', 'phi3.5:3.8b']

function isOllamaModel(model: string): boolean {
  // Type safety: handle undefined/null/non-string models
  if (!model || typeof model !== 'string') {
    return false // Assume cloud model (requires API key) for safety
  }

  // Check known Ollama models list
  if (OLLAMA_MODELS.includes(model)) return true

  // Check for ollama:// protocol
  if (model.startsWith('ollama://')) return true

  // Cloud provider prefixes indicate NOT Ollama (requires API key)
  const cloudProviderPrefixes = [
    'claude', // Anthropic models
    'anthropic:', // Anthropic namespaced
    'openai:', // OpenAI namespaced
    'gpt-', // OpenAI GPT models
    'o1-', // OpenAI O1 models
    'deepseek:', // DeepSeek namespaced
    'gemini', // Google Gemini
    'google:', // Google namespaced
  ]

  for (const prefix of cloudProviderPrefixes) {
    // Only use startsWith to avoid substring false matches
    if (model.startsWith(prefix)) {
      return false // Cloud model, NOT Ollama
    }
  }

  // Ollama models typically use "model:size" format (e.g., "llama3.2:3b")
  // If model contains colon and isn't a cloud provider, likely Ollama
  if (model.includes(':')) {
    return true
  }

  // Default: assume cloud model (requires API key for safety)
  return false
}

/**
 * Rules shared across all agent block types.
 */
export const agentConditionalRules: ConditionalRule[] = [
  // API Key required for cloud models
  {
    field: 'apiKey',
    condition: (inputs) => {
      const model = inputs.model || getDefaultModel('openai')
      return !isOllamaModel(model)
    },
    rule: 'required',
    message: 'API key is required for cloud-hosted models.',
    severity: 'error',
    suggestion: 'Set your API key directly or use an environment variable (e.g., $OPENAI_API_KEY).',
  },
  // API Key NOT required for Ollama models (override required flag from inputs definition)
  {
    field: 'apiKey',
    condition: (inputs) => {
      const model = inputs.model || getDefaultModel('openai')
      return isOllamaModel(model)
    },
    rule: 'optional',
    message: '',
    severity: 'warning',
  },
]

/**
 * Rules for condition blocks.
 */
export const conditionConditionalRules: ConditionalRule[] = [
  {
    field: 'conditions',
    condition: () => true,
    rule: (value) => {
      if (!value || String(value).trim().length === 0) return 'Conditions are required'
      // The field stores a JSON array of ConditionalBlock objects.
      // Check the 'if' block's value — the user may have typed then cleared,
      // leaving a non-empty JSON string but with an empty condition expression.
      try {
        const blocks = JSON.parse(String(value))
        if (!Array.isArray(blocks)) return 'Conditions are required'
        const ifBlock = blocks.find((b: any) => b.title === 'if')
        if (!ifBlock || !String(ifBlock.value ?? '').trim()) {
          return 'Condition expression is required'
        }
      } catch {
        return 'Conditions are required'
      }
      return true
    },
    message: 'Condition expression is required.',
    severity: 'error',
    suggestion: 'Add a boolean condition expression.',
  },
]

/**
 * Rules for function blocks.
 */
export const functionConditionalRules: ConditionalRule[] = [
  {
    field: 'code',
    condition: () => true,
    rule: (value) => {
      if (!value || String(value).trim().length === 0) return 'Function code is required'
      return true
    },
    message: 'Function block requires code to execute.',
    severity: 'error',
    suggestion: 'Add JavaScript code to the code editor.',
  },
]

/**
 * Rules for API blocks.
 */
export const apiConditionalRules: ConditionalRule[] = [
  {
    field: 'url',
    condition: () => true,
    rule: (value) => {
      if (!value || String(value).trim().length === 0) return 'URL is required'
      const str = String(value)
      // Allow env vars and block references
      if (str.includes('{{') || str.includes('<')) return true
      if (!str.startsWith('http://') && !str.startsWith('https://')) {
        return 'URL must start with http:// or https://'
      }
      return true
    },
    message: 'API URL is required and must be valid.',
    severity: 'error',
    suggestion: 'Provide a valid URL (e.g., https://api.example.com/endpoint).',
  },
]

/**
 * Rules for Notion blocks.
 * Handles operation-dependent field requirements (parentType/parentId only for create,
 * pageId required for read/write).
 */
export const notionConditionalRules: ConditionalRule[] = [
  // parentType is only needed for create_notion — mark optional for read/write
  {
    field: 'parentType',
    condition: (inputs) => inputs.operation !== 'create_notion',
    rule: 'optional',
    message: '',
    severity: 'warning',
  },
  // parentId is only needed for create_notion — mark optional for read/write
  {
    field: 'parentId',
    condition: (inputs) => inputs.operation !== 'create_notion',
    rule: 'optional',
    message: '',
    severity: 'warning',
  },
  // pageId is required for read and write operations
  {
    field: 'pageId',
    condition: (inputs) =>
      inputs.operation === 'read_notion' || inputs.operation === 'write_notion',
    rule: 'required',
    message: 'Page ID is required to read from or write to a Notion page.',
    severity: 'error',
    suggestion: 'Enter the Notion page ID (found in the page URL after the last hyphen).',
  },
]

/**
 * Rules for Airtable blocks.
 * recordId is only required for get/update; records required for create/updateMultiple.
 */
export const airtableConditionalRules: ConditionalRule[] = [
  // recordId required only for get/update operations
  {
    field: 'recordId',
    condition: (inputs) => inputs.operation === 'get' || inputs.operation === 'update',
    rule: 'required',
    message: 'Record ID is required for get and update operations.',
    severity: 'error',
    suggestion: 'Enter the Airtable record ID (starts with "rec").',
  },
  // recordId NOT required for list/create/updateMultiple
  {
    field: 'recordId',
    condition: (inputs) =>
      inputs.operation === 'list' ||
      inputs.operation === 'create' ||
      inputs.operation === 'updateMultiple',
    rule: 'optional',
    message: '',
    severity: 'warning',
  },
  // records required for create and updateMultiple
  {
    field: 'records',
    condition: (inputs) => inputs.operation === 'create' || inputs.operation === 'updateMultiple',
    rule: 'required',
    message: 'Records data is required for create and updateMultiple operations.',
    severity: 'error',
    suggestion: 'Provide a JSON array of record objects to create or update.',
  },
  // fields required for single record update
  {
    field: 'fields',
    condition: (inputs) => inputs.operation === 'update',
    rule: 'required',
    message: 'Fields data is required for update operation.',
    severity: 'error',
    suggestion: 'Provide a JSON object with the fields to update.',
  },
]

/**
 * Rules for Gmail blocks.
 * Handles operation-dependent field requirements.
 */
export const gmailConditionalRules: ConditionalRule[] = [
  // Send: to, subject, body required (also for legacy blocks without operation field)
  {
    field: 'to',
    condition: (inputs) => !inputs.operation || inputs.operation === 'send_gmail',
    rule: 'required',
    message: 'Recipient email address is required.',
    severity: 'error',
    suggestion: 'Enter a valid email address or use a variable like {{input.email}}.',
  },
  {
    field: 'subject',
    condition: (inputs) => !inputs.operation || inputs.operation === 'send_gmail',
    rule: 'required',
    message: 'Email subject is required.',
    severity: 'error',
    suggestion: 'Enter a subject line for the email.',
  },
  {
    field: 'body',
    condition: (inputs) => !inputs.operation || inputs.operation === 'send_gmail',
    rule: 'required',
    message: 'Email body/content is required.',
    severity: 'error',
    suggestion: 'Enter the content to send in the email body.',
  },
  // Send fields optional for non-send operations
  {
    field: 'to',
    condition: (inputs) => !!inputs.operation && inputs.operation !== 'send_gmail',
    rule: 'optional',
    message: '',
    severity: 'warning',
  },
  {
    field: 'subject',
    condition: (inputs) => !!inputs.operation && inputs.operation !== 'send_gmail',
    rule: 'optional',
    message: '',
    severity: 'warning',
  },
  {
    field: 'body',
    condition: (inputs) => !!inputs.operation && inputs.operation !== 'send_gmail',
    rule: 'optional',
    message: '',
    severity: 'warning',
  },
  // Search: query required
  {
    field: 'query',
    condition: (inputs) => inputs.operation === 'search_gmail',
    rule: 'required',
    message: 'Search query is required.',
    severity: 'error',
    suggestion: 'Enter a search query (e.g., from:user@example.com is:unread).',
  },
  // Reply: messageId and body required
  {
    field: 'replyMessageId',
    condition: (inputs) => inputs.operation === 'reply_gmail',
    rule: 'required',
    message: 'Message ID is required to reply.',
    severity: 'error',
    suggestion: 'Enter the ID of the message you want to reply to.',
  },
  {
    field: 'replyBody',
    condition: (inputs) => inputs.operation === 'reply_gmail',
    rule: 'required',
    message: 'Reply body is required.',
    severity: 'error',
    suggestion: 'Enter the reply content.',
  },
  // Forward: messageId and to required
  {
    field: 'forwardMessageId',
    condition: (inputs) => inputs.operation === 'forward_gmail',
    rule: 'required',
    message: 'Message ID is required to forward.',
    severity: 'error',
    suggestion: 'Enter the ID of the message you want to forward.',
  },
  {
    field: 'forwardTo',
    condition: (inputs) => inputs.operation === 'forward_gmail',
    rule: 'required',
    message: 'Recipient email address is required for forwarding.',
    severity: 'error',
    suggestion: 'Enter the email address to forward to.',
  },
  // Trash: messageId required
  {
    field: 'trashMessageId',
    condition: (inputs) => inputs.operation === 'trash_gmail',
    rule: 'required',
    message: 'Message ID is required to trash/untrash.',
    severity: 'error',
    suggestion: 'Enter the ID of the message to trash or restore.',
  },
  // Modify Labels: messageId required
  {
    field: 'modifyMessageId',
    condition: (inputs) => inputs.operation === 'modify_labels_gmail',
    rule: 'required',
    message: 'Message ID is required to modify labels.',
    severity: 'error',
    suggestion: 'Enter the ID of the message to modify.',
  },
]

/**
 * Rules for Data Table blocks.
 * rawData is required for smart_insert and auto_save; tableId/tableName required per operation.
 */
export const dataTableConditionalRules: ConditionalRule[] = [
  // rawData required for smart_insert and auto_save
  {
    field: 'rawData',
    condition: (inputs) => inputs.operation === 'smart_insert' || inputs.operation === 'auto_save',
    rule: (value) => {
      if (value === undefined || value === null) return 'Raw data is required'
      if (typeof value === 'string' && value.trim().length === 0) return 'Raw data is required'
      return true
    },
    message: 'Raw data is required for smart_insert and auto_save operations.',
    severity: 'error',
    suggestion:
      "Connect a previous block's output to the Raw Data field, or enter data directly (JSON, CSV, or markdown table).",
  },
  // tableId required for smart_insert
  {
    field: 'tableId',
    condition: (inputs) => inputs.operation === 'smart_insert',
    rule: 'required',
    message: 'Table ID is required for smart_insert operation.',
    severity: 'error',
    suggestion: 'Enter the ID of the target data table.',
  },
  // tableName required for auto_save
  {
    field: 'tableName',
    condition: (inputs) => inputs.operation === 'auto_save',
    rule: 'required',
    message: 'Table name is required for auto_save operation.',
    severity: 'error',
    suggestion:
      'Enter a table name — the table will be created automatically if it does not exist.',
  },
]

/**
 * Rules for loop blocks.
 */
export const loopConditionalRules: ConditionalRule[] = [
  {
    field: 'loopType',
    condition: () => true,
    rule: (value) => {
      if (!value) return 'Loop type is required'
      const valid = ['for', 'forEach', 'while', 'range']
      if (!valid.includes(String(value))) {
        return `Loop type must be one of: ${valid.join(', ')}`
      }
      return true
    },
    message: 'Loop type must be specified.',
    severity: 'error',
  },
]

/**
 * Returns conditional rules for a given block type.
 */
export function getConditionalRules(blockType: string): ConditionalRule[] {
  // All agent types share the same conditional rules
  const agentTypes = [
    'agent',
    'content_creation_agent',
    'customer_service_agent',
    'data_analysis_agent',
    'function_calling_agent',
    'rag_agent',
    'reasoning_agent',
    'sales_agent',
  ]

  if (agentTypes.includes(blockType)) {
    return agentConditionalRules
  }

  switch (blockType) {
    case 'condition':
      return conditionConditionalRules
    case 'function':
      return functionConditionalRules
    case 'api':
      return apiConditionalRules
    case 'loop':
      return loopConditionalRules
    case 'notion':
      return notionConditionalRules
    case 'airtable':
      return airtableConditionalRules
    case 'gmail':
      return gmailConditionalRules
    case 'data_table':
      return dataTableConditionalRules
    default:
      return []
  }
}

/**
 * Evaluates conditional rules against inputs and returns validation issues.
 */
export function evaluateConditionalRules(
  blockType: string,
  inputs: Record<string, any>
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const rules = getConditionalRules(blockType)
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  for (const rule of rules) {
    // Check if the rule's condition is met
    if (!rule.condition(inputs)) continue

    const value = inputs[rule.field]

    if (rule.rule === 'required') {
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim().length === 0)
      if (isEmpty) {
        const issue: ValidationIssue = {
          field: rule.field,
          message: rule.message,
          suggestion: rule.suggestion,
        }
        if (rule.severity === 'error') {
          errors.push(issue)
        } else {
          warnings.push(issue)
        }
      }
    } else if (rule.rule === 'optional') {
      // Skip - this field is optional in this context
      continue
    } else if (typeof rule.rule === 'function') {
      const result = rule.rule(value)
      if (result !== true) {
        const issue: ValidationIssue = {
          field: rule.field,
          message: typeof result === 'string' ? result : rule.message,
          suggestion: rule.suggestion,
        }
        if (rule.severity === 'error') {
          errors.push(issue)
        } else {
          warnings.push(issue)
        }
      }
    }
  }

  return { errors, warnings }
}
