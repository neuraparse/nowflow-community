/**
 * NowFlow Skills System
 * Skills are modular, community-contributed workflow capabilities
 */

export interface SkillManifest {
  name: string
  version: string
  description: string
  author: string
  authorUrl?: string
  license: string
  tags: string[]
  category: SkillCategory
  icon?: string
  requirements?: SkillRequirement[]
  inputs: SkillInput[]
  outputs: SkillOutput[]
  configuration?: SkillConfigField[]
  triggers?: SkillTrigger[]
  actions: SkillAction[]
}

export type SkillCategory =
  | 'ai'
  | 'automation'
  | 'communication'
  | 'crm'
  | 'data'
  | 'developer'
  | 'finance'
  | 'marketing'
  | 'productivity'
  | 'security'
  | 'social'
  | 'storage'
  | 'analytics'
  | 'custom'

export interface SkillRequirement {
  type: 'api_key' | 'oauth' | 'npm_package' | 'environment_variable'
  name: string
  description: string
  optional?: boolean
}

export interface SkillInput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'json' | 'file' | 'array'
  description: string
  required: boolean
  default?: any
  enum?: string[]
  example?: any
}

export interface SkillOutput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'json' | 'file' | 'array'
  description: string
}

export interface SkillConfigField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret'
  description: string
  required: boolean
  default?: any
  options?: { label: string; value: string }[]
}

export interface SkillTrigger {
  type: 'webhook' | 'schedule' | 'event' | 'manual'
  name: string
  description: string
  config?: Record<string, any>
}

export interface SkillAction {
  name: string
  description: string
  handler: string // Path to handler function or inline code
  inputs?: string[] // References to skill inputs
  outputs?: string[] // References to skill outputs
}

export interface InstalledSkill {
  id: string
  manifest: SkillManifest
  installedAt: Date
  updatedAt: Date
  enabled: boolean
  userId: string
  workspaceId?: string
  configuration: Record<string, any>
  source: SkillSource
}

export interface SkillSource {
  type: 'marketplace' | 'github' | 'local' | 'url'
  url?: string
  repository?: string
  branch?: string
  path?: string
}

export interface SkillSearchResult {
  manifest: SkillManifest
  source: SkillSource
  downloads: number
  rating: number
  lastUpdated: Date
}

export interface SkillExecutionContext {
  skillId: string
  action: string
  inputs: Record<string, any>
  configuration: Record<string, any>
  userId: string
  workflowId?: string
  executionId?: string
}

export interface SkillExecutionResult {
  success: boolean
  outputs: Record<string, any>
  error?: string
  duration: number
  logs?: string[]
}
