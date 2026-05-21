/**
 * Agent-specific validation overrides.
 * These provide cross-field and domain-specific validations
 * that go beyond what the auto-generated schema can do.
 *
 * @module executor/validation/schemas/agent-schemas
 */
import { z } from 'zod'
import type { BlockValidationResult, ValidationIssue } from '../validation-result'

/**
 * An agent schema override takes resolved inputs and returns
 * additional validation errors/warnings beyond the base schema.
 */
export type AgentSchemaOverride = (inputs: Record<string, any>) => {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

/**
 * Registry of agent-specific validation overrides keyed by block type.
 */
export const agentSchemaOverrides: Record<string, AgentSchemaOverride> = {
  // ─── Generic Agent ──────────────────────────────────────────────
  agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    // Warn when systemPrompt is empty — independently of whether context is filled.
    // context (User Prompt) is optional input; systemPrompt defines the agent's role/behavior.
    // Filling context should NOT suppress this warning — the user must explicitly add a system prompt.
    const hasSystemPrompt = inputs.systemPrompt && String(inputs.systemPrompt).trim().length > 0

    if (!hasSystemPrompt) {
      warnings.push({
        field: 'systemPrompt',
        message: 'No system prompt configured. The model will receive no behavioral instructions.',
        suggestion: "Add a system prompt to define the AI's role and expected behavior.",
      })
    }

    // Validate responseFormat if provided
    if (inputs.responseFormat) {
      const rfErrors = validateJsonField(inputs.responseFormat, 'responseFormat', 'Response Format')
      errors.push(...rfErrors)
    }

    // Knowledge sources validation
    const ksValidation = validateKnowledgeSources(inputs)
    errors.push(...ksValidation.errors)
    warnings.push(...ksValidation.warnings)

    return { errors, warnings }
  },

  // ─── Reasoning Agent ────────────────────────────────────────────
  reasoning_agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    if (!inputs.problem || String(inputs.problem).trim().length === 0) {
      errors.push({
        field: 'problem',
        message: 'Problem statement is required for reasoning agent.',
        suggestion: 'Describe the problem or question for the agent to solve.',
      })
    }

    if (!inputs.reasoningFramework) {
      errors.push({
        field: 'reasoningFramework',
        message: 'Reasoning framework must be selected.',
        suggestion:
          'Choose from: chain_of_thought, react, tree_of_thoughts, socratic, first_principles.',
      })
    }

    // maxSteps validation
    if (inputs.maxSteps) {
      const maxSteps = Number(inputs.maxSteps)
      if (isNaN(maxSteps) || maxSteps < 1 || maxSteps > 50) {
        errors.push({
          field: 'maxSteps',
          message: 'Max steps must be a number between 1 and 50.',
        })
      }
    }

    // ReAct framework should have tools
    if (
      inputs.reasoningFramework === 'react' &&
      (!inputs.tools || !Array.isArray(inputs.tools) || inputs.tools.length === 0)
    ) {
      warnings.push({
        field: 'tools',
        message:
          'ReAct framework works best with tools configured. Without tools, the agent cannot take actions.',
        suggestion: 'Add at least one tool for the ReAct agent to use.',
      })
    }

    // Knowledge sources validation
    const ksValidation = validateKnowledgeSources(inputs)
    errors.push(...ksValidation.errors)
    warnings.push(...ksValidation.warnings)

    return { errors, warnings }
  },

  // ─── Function Calling Agent ─────────────────────────────────────
  function_calling_agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    if (!inputs.userInput || String(inputs.userInput).trim().length === 0) {
      errors.push({
        field: 'userInput',
        message: 'User input is required for function calling agent.',
      })
    }

    // Functions must be valid JSON array
    if (inputs.functions) {
      try {
        const parsed =
          typeof inputs.functions === 'string' ? JSON.parse(inputs.functions) : inputs.functions
        if (!Array.isArray(parsed)) {
          errors.push({
            field: 'functions',
            message: 'Functions must be a JSON array.',
            suggestion: 'Provide an array of function definitions.',
          })
        } else if (parsed.length === 0) {
          errors.push({
            field: 'functions',
            message: 'Functions array must contain at least one function definition.',
          })
        } else {
          // Validate each function has required fields
          for (let i = 0; i < parsed.length; i++) {
            const fn = parsed[i]
            if (!fn.name) {
              errors.push({
                field: 'functions',
                message: `Function at index ${i} is missing "name" field.`,
              })
            }
            if (!fn.parameters || typeof fn.parameters !== 'object') {
              errors.push({
                field: 'functions',
                message: `Function "${fn.name || `index ${i}`}" is missing "parameters" field.`,
                suggestion:
                  'Each function needs a parameters object with type, properties, and required fields.',
              })
            }
          }
        }
      } catch {
        errors.push({
          field: 'functions',
          message: 'Functions field contains invalid JSON.',
          suggestion: 'Ensure the functions field is a valid JSON array.',
        })
      }
    } else {
      errors.push({
        field: 'functions',
        message: 'Functions are required for function calling agent.',
      })
    }

    // Function implementations should exist
    if (
      !inputs.functionImplementations ||
      String(inputs.functionImplementations).trim().length === 0
    ) {
      errors.push({
        field: 'functionImplementations',
        message: 'Function implementations code is required.',
        suggestion: 'Provide JavaScript code implementing the declared functions.',
      })
    }

    // maxFunctionCalls validation
    if (inputs.maxFunctionCalls) {
      const maxCalls = Number(inputs.maxFunctionCalls)
      if (isNaN(maxCalls) || maxCalls < 1 || maxCalls > 50) {
        errors.push({
          field: 'maxFunctionCalls',
          message: 'Max function calls must be between 1 and 50.',
        })
      }
    }

    return { errors, warnings }
  },

  // ─── RAG Agent ──────────────────────────────────────────────────
  rag_agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    // query is required
    if (!inputs.query || String(inputs.query).trim().length === 0) {
      errors.push({
        field: 'query',
        message: 'Query is required for RAG agent.',
        suggestion: 'Provide a search query for the agent to retrieve relevant data.',
      })
    }

    // dataSource is required and must be a valid enum value
    const validDataSources = ['pinecone', 'supabase', 'mongodb', 'airtable', 'custom']
    if (!inputs.dataSource || String(inputs.dataSource).trim().length === 0) {
      errors.push({
        field: 'dataSource',
        message: 'Data source is required for RAG agent.',
        suggestion: 'Select a data source: pinecone, supabase, mongodb, airtable, or custom.',
      })
    } else if (!validDataSources.includes(String(inputs.dataSource))) {
      errors.push({
        field: 'dataSource',
        message: `Invalid data source "${inputs.dataSource}". Must be one of: ${validDataSources.join(', ')}.`,
      })
    }

    // dataSourceConfig is required and must be valid JSON
    if (!inputs.dataSourceConfig) {
      errors.push({
        field: 'dataSourceConfig',
        message: 'Data source configuration is required for RAG agent.',
        suggestion: 'Provide the connection configuration for your selected data source.',
      })
    } else {
      const jsonErrors = validateJsonField(
        inputs.dataSourceConfig,
        'dataSourceConfig',
        'Data Source Config'
      )
      errors.push(...jsonErrors)
    }

    // retrievalOptions is optional but must be valid JSON if provided
    if (inputs.retrievalOptions) {
      const jsonErrors = validateJsonField(
        inputs.retrievalOptions,
        'retrievalOptions',
        'Retrieval Options'
      )
      errors.push(...jsonErrors)
    }

    return { errors, warnings }
  },

  // ─── Content Creation Agent ─────────────────────────────────────
  content_creation_agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    if (!inputs.contentBrief || String(inputs.contentBrief).trim().length === 0) {
      if (!inputs.context || String(inputs.context).trim().length === 0) {
        warnings.push({
          field: 'contentBrief',
          message: 'No content brief or context provided.',
          suggestion: 'Provide a content brief describing what to create.',
        })
      }
    }

    // Knowledge sources validation
    const ksValidation = validateKnowledgeSources(inputs)
    errors.push(...ksValidation.errors)
    warnings.push(...ksValidation.warnings)

    return { errors, warnings }
  },

  // ─── Data Analysis Agent ────────────────────────────────────────
  data_analysis_agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    // dataset is required (handled by Phase 1 schema), but analysisGoal adds guidance
    if (!inputs.analysisGoal && !inputs.context) {
      warnings.push({
        field: 'analysisGoal',
        message: 'No analysis goal or context provided. The agent will only have the raw dataset.',
        suggestion: 'Provide an analysis goal to guide the data analysis.',
      })
    }

    // analysisParameters is optional but must be valid JSON if provided
    if (inputs.analysisParameters) {
      const jsonErrors = validateJsonField(
        inputs.analysisParameters,
        'analysisParameters',
        'Analysis Parameters'
      )
      errors.push(...jsonErrors)
    }

    // Knowledge sources validation
    const ksValidation = validateKnowledgeSources(inputs)
    errors.push(...ksValidation.errors)
    warnings.push(...ksValidation.warnings)

    return { errors, warnings }
  },

  // ─── Sales Agent ────────────────────────────────────────────────
  sales_agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    if (!inputs.prospectMessage && !inputs.prospectProfile && !inputs.context) {
      warnings.push({
        field: 'prospectMessage',
        message: 'No prospect message, profile, or context provided.',
        suggestion: 'Provide prospect information for the sales agent to work with.',
      })
    }

    // productCatalog is optional but must be valid JSON if provided
    if (inputs.productCatalog) {
      const jsonErrors = validateJsonField(
        inputs.productCatalog,
        'productCatalog',
        'Product Catalog'
      )
      errors.push(...jsonErrors)
    }

    // Knowledge sources validation
    const ksValidation = validateKnowledgeSources(inputs)
    errors.push(...ksValidation.errors)
    warnings.push(...ksValidation.warnings)

    return { errors, warnings }
  },

  // ─── Customer Service Agent ─────────────────────────────────────
  customer_service_agent: (inputs) => {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    // customerMessage is required, but downgrade to warning if customerContext exists
    const hasCustomerMessage =
      inputs.customerMessage && String(inputs.customerMessage).trim().length > 0
    const hasCustomerContext =
      inputs.customerContext && String(inputs.customerContext).trim().length > 0

    if (!hasCustomerMessage) {
      if (hasCustomerContext) {
        warnings.push({
          field: 'customerMessage',
          message: 'No customer message provided, using customer context as fallback.',
          suggestion: 'Provide a specific customer message for more accurate responses.',
        })
      } else {
        errors.push({
          field: 'customerMessage',
          message: 'Customer message is required for customer service agent.',
          suggestion: 'Provide the customer query or message to respond to.',
        })
      }
    }

    // escalationRules is optional but must be valid JSON if provided
    if (inputs.escalationRules) {
      const jsonErrors = validateJsonField(
        inputs.escalationRules,
        'escalationRules',
        'Escalation Rules'
      )
      errors.push(...jsonErrors)
    }

    // Knowledge sources validation
    const ksValidation = validateKnowledgeSources(inputs)
    errors.push(...ksValidation.errors)
    warnings.push(...ksValidation.warnings)

    return { errors, warnings }
  },
}

// ─── Helper Functions ──────────────────────────────────────────────

/**
 * Validates knowledge source fields if present.
 * Returns warnings/errors for invalid configuration.
 */
function validateKnowledgeSources(inputs: Record<string, any>): {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
} {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  if (inputs.knowledgeSources) {
    // Validate format: should be comma-separated non-empty strings
    const sourceIds = String(inputs.knowledgeSources)
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0)

    if (sourceIds.length === 0) {
      warnings.push({
        field: 'knowledgeSources',
        message: 'Knowledge sources field is set but contains no valid source IDs.',
        suggestion: 'Select knowledge sources using the picker or remove the field.',
      })
    }

    // Validate searchMaxResults range if provided
    if (inputs.searchMaxResults !== undefined && inputs.searchMaxResults !== null) {
      const maxResults = Number(inputs.searchMaxResults)
      if (!isNaN(maxResults) && (maxResults < 1 || maxResults > 20)) {
        errors.push({
          field: 'searchMaxResults',
          message: 'Search max results must be between 1 and 20.',
        })
      }
    }

    // Validate similarityThreshold range if provided
    if (inputs.similarityThreshold !== undefined && inputs.similarityThreshold !== null) {
      const threshold = Number(inputs.similarityThreshold)
      if (!isNaN(threshold) && (threshold < 0 || threshold > 1)) {
        errors.push({
          field: 'similarityThreshold',
          message: 'Similarity threshold must be between 0 and 1.',
        })
      }
    }
  }

  return { errors, warnings }
}

/**
 * Validates a field that should contain valid JSON.
 */
function validateJsonField(value: any, field: string, label: string): ValidationIssue[] {
  const errors: ValidationIssue[] = []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      try {
        JSON.parse(trimmed)
      } catch {
        errors.push({
          field,
          message: `${label} contains invalid JSON.`,
          suggestion: 'Check the JSON syntax and fix any errors.',
        })
      }
    }
  }
  return errors
}
