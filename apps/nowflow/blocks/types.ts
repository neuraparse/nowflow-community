import type { SVGProps } from 'react'
import type { JSX } from 'react'
import { ToolResponse } from '@/tools/types'

// Basic types
export type BlockIcon = (props: SVGProps<SVGSVGElement>) => JSX.Element
export type ParamType = 'string' | 'number' | 'boolean' | 'json'
export type PrimitiveValueType = 'string' | 'number' | 'boolean' | 'json' | 'any'

// Block classification
export type BlockCategory = 'blocks' | 'tools' | 'data' | 'integrations' | 'agents'

// Compliance and risk tags for financial/trading blocks
export type ComplianceTag =
  | 'financial_trading' // Stock, forex, derivatives trading
  | 'crypto_trading' // Cryptocurrency trading
  | 'high_risk' // High financial risk operations
  | 'regulated' // Requires regulatory compliance
  | 'kyc_required' // KYC/AML compliance required
  | 'region_restricted' // Geographic restrictions apply

export interface ComplianceWarning {
  enabled: boolean
  tags: ComplianceTag[]
  disclaimer: string
  restrictedRegions?: string[]
  requiresLicense?: boolean
  riskLevel?: 'low' | 'medium' | 'high' | 'extreme'
}

// Enhanced SubBlock types with better categorization
export type BasicInputType =
  | 'short-input' // Single line input
  | 'long-input' // Multi-line input
  | 'dropdown' // Select menu
  | 'slider' // Range input
  | 'switch' // Toggle button
  | 'checkbox' // Single checkbox
  | 'date-input' // Date input
  | 'time-input' // Time input

export type AdvancedInputType =
  | 'table' // Grid layout
  | 'code' // Code editor
  | 'checkbox-list' // Multiple selection
  | 'agent-profile-selector' // Agent profile selector
  | 'condition-input' // Conditional logic
  | 'eval-input' // Evaluation input
  | 'tool-input' // Tool configuration
  | 'webhook-config' // Webhook configuration
  | 'schedule-config' // Schedule status and information
  | 'input-format' // Input structure format
  | 'knowledge-source-input' // Knowledge source selector for RAG

export type IntegrationInputType =
  | 'oauth-input' // OAuth credential selector
  | 'file-selector' // File selector for Google Drive, etc.
  | 'file-upload' // File uploader
  | 'project-selector' // Project selector for Jira
  | 'folder-selector' // Folder selector for Gmail, etc.
  | 'teams-selector' // Microsoft Teams selector
  | 'channels-selector' // Microsoft Teams channels selector
  | 'chats-selector' // Microsoft Teams chats selector

export type SubBlockType = BasicInputType | AdvancedInputType | IntegrationInputType

// Type guards for sub-block types
export const isBasicInputType = (type: SubBlockType): type is BasicInputType => {
  return [
    'short-input',
    'long-input',
    'dropdown',
    'slider',
    'switch',
    'checkbox',
    'date-input',
    'time-input',
  ].includes(type)
}

export const isAdvancedInputType = (type: SubBlockType): type is AdvancedInputType => {
  return [
    'table',
    'code',
    'checkbox-list',
    'agent-profile-selector',
    'condition-input',
    'eval-input',
    'tool-input',
    'webhook-config',
    'schedule-config',
    'input-format',
    'knowledge-source-input',
  ].includes(type)
}

export const isIntegrationInputType = (type: SubBlockType): type is IntegrationInputType => {
  return [
    'oauth-input',
    'file-selector',
    'file-upload',
    'project-selector',
    'folder-selector',
    'teams-selector',
    'channels-selector',
    'chats-selector',
  ].includes(type)
}

// Component width setting
export type SubBlockLayout = 'full' | 'half'

// Tool result extraction
export type ExtractToolOutput<T> = T extends ToolResponse ? T['output'] : never

// Convert tool output to types
export type ToolOutputToValueType<T> =
  T extends Record<string, any>
    ? {
        // Use NonNullable<T[K]> so optional response fields (e.g. `tokens?: {...}`)
        // map to a concrete primitive instead of falling through to `'any'`.
        // Without this, the union with `undefined` makes every branch fail and
        // the mapped type silently degrades — produces 100+ cascade errors
        // across blocks/blocks/*.ts under strict TS.
        [K in keyof T]: NonNullable<T[K]> extends string
          ? 'string'
          : NonNullable<T[K]> extends number
            ? 'number'
            : NonNullable<T[K]> extends boolean
              ? 'boolean'
              : NonNullable<T[K]> extends object
                ? 'json'
                : 'any'
      }
    : never

// Block output definition
export type BlockOutput =
  | PrimitiveValueType
  | { [key: string]: PrimitiveValueType | Record<string, any> }

// Parameter validation rules
export interface ParamConfig {
  type: ParamType
  required: boolean
  requiredForToolCall?: boolean
  description?: string
  schema?: {
    type: string
    properties: Record<string, any>
    required?: string[]
    additionalProperties?: boolean
    items?: {
      type: string
      properties?: Record<string, any>
      required?: string[]
      additionalProperties?: boolean
    }
  }
}

// Enhanced validation rules
export interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'json' | 'array'
  pattern?: RegExp
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  custom?: (value: any) => boolean | string
  dependsOn?: string
}

// Option types for dropdowns and selectors
export type OptionValue = string | number | boolean
export type SimpleOption = OptionValue
export type ComplexOption = {
  label: string
  id: string
  value?: OptionValue
  disabled?: boolean
  group?: string
  icon?: string
  description?: string
}
export type DynamicOptions = () => SimpleOption[] | ComplexOption[]
export type OptionConfig = SimpleOption[] | ComplexOption[] | DynamicOptions

// Enhanced SubBlock configuration with better type safety
export interface SubBlockConfig {
  id: string
  title?: string
  label?: string // Alias for title, used in some components
  type: SubBlockType
  layout?: SubBlockLayout

  // Validation
  validation?: ValidationRule

  // Options for dropdowns, checkbox-lists, etc.
  options?: OptionConfig

  // Numeric constraints
  min?: number
  max?: number
  step?: number
  integer?: boolean

  // Table configuration
  columns?: string[]

  // Input properties
  placeholder?: string
  password?: boolean
  rows?: number

  // Connection properties
  connectionDroppable?: boolean
  hidden?: boolean
  description?: string

  // Dynamic value computation
  value?: (params: Record<string, any>) => string

  // Conditional visibility
  condition?: {
    field: string
    value: string | number | boolean | Array<string | number | boolean>
    not?: boolean
    and?: {
      field: string
      value: string | number | boolean | Array<string | number | boolean>
      not?: boolean
    }
  }

  // Code editor specific properties
  language?: 'javascript' | 'json' | 'text' | 'graphql' | 'python' | 'sql'
  generationType?: 'javascript-function-body' | 'json-schema' | 'python-function' | 'sql-query'

  // OAuth specific properties
  provider?: string
  serviceId?: string
  requiredScopes?: string[]

  // File selector specific properties
  mimeType?: string
  allowedExtensions?: string[]

  // File upload specific properties
  acceptedTypes?: string
  multiple?: boolean
  maxSize?: number
  maxFiles?: number

  // Teams/Integration selector specific properties
  dependsOn?: string
  credentialSubBlockId?: string
  allowEmailInput?: boolean

  // Webhook configuration properties
  webhookEvents?: string[]
  webhookHeaders?: Record<string, string>

  // Schedule configuration properties
  timezone?: string
  allowedFrequencies?: ('once' | 'daily' | 'weekly' | 'monthly')[]

  // Advanced properties
  tooltip?: string
  helpText?: string
  disabled?: boolean
  readonly?: boolean

  // Accessibility
  ariaLabel?: string
  ariaDescribedBy?: string
}

// Main block definition
export interface BlockConfig<T extends ToolResponse = ToolResponse> {
  type: string
  name: string
  description: string
  category: BlockCategory
  longDescription?: string
  bgColor: string
  icon: BlockIcon
  subBlocks: SubBlockConfig[]
  tools: {
    access: string[]
    config?: {
      tool: (params: Record<string, any>) => string
      params?: (params: Record<string, any>) => Record<string, any>
    }
  }
  inputs: Record<string, ParamConfig>
  outputs: {
    response: {
      // Allow either detailed mapping or a simple 'json' shorthand for generic outputs
      type: ToolOutputToValueType<ExtractToolOutput<T>> | 'json'
      dependsOn?: {
        subBlockId: string
        condition: {
          whenEmpty: ToolOutputToValueType<ExtractToolOutput<T>> | 'json'
          whenFilled: 'json'
        }
      }
      visualization?: {
        type: 'image'
        url: string
      }
    }
  }
  hideFromToolbar?: boolean
  /**
   * When true, renders as a compact helper chip on the canvas instead of a full block card.
   * Helper blocks are visually distinct — smaller, dashed border, muted background.
   * In the toolbar they appear in a separate "Helpers" section at the bottom.
   * Use this for utility/data blocks (e.g. Data Table, Memory Store) that augment other blocks.
   */
  isUtility?: boolean
  version?: string
  examples?: Array<{
    title: string
    description: string
    params: Record<string, any>
  }>
  supportsCode?: boolean
  supportsPerformance?: boolean
  compliance?: ComplianceWarning // Compliance and regulatory warnings
}

// Output configuration rules
export interface OutputConfig {
  type: BlockOutput
  dependsOn?: {
    subBlockId: string
    condition: {
      whenEmpty: BlockOutput
      whenFilled: BlockOutput
    }
  }
}
