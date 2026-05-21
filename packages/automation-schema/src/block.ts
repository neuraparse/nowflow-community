import { z } from 'zod'

/**
 * L2 BlockSchema — the EXECUTION subset of BlockConfig.
 *
 * This contract intentionally omits UI-only fields (React icon, bgColor, subBlock
 * render hints like placeholders, validation UI, etc). It captures only what the
 * executor and workflow builders need: shape of inputs, outputs, tool bindings, and
 * declared capabilities.
 */

export const PrimitiveValueTypeSchema = z.enum(['string', 'number', 'boolean', 'json', 'any'])
export type PrimitiveValueType = z.infer<typeof PrimitiveValueTypeSchema>

export const ParamTypeSchema = z.enum(['string', 'number', 'boolean', 'json'])
export type ParamType = z.infer<typeof ParamTypeSchema>

export const BlockCategorySchema = z.enum(['blocks', 'tools', 'data', 'integrations', 'agents'])
export type BlockCategory = z.infer<typeof BlockCategorySchema>

/**
 * Sub-block types (UI control kinds). Kept in the L2 schema so builders
 * can reason about what user-facing configuration surfaces exist, even though
 * the rendering is UI-only.
 */
export const SubBlockTypeSchema = z.enum([
  // Basic
  'short-input',
  'long-input',
  'dropdown',
  'slider',
  'switch',
  'checkbox',
  'date-input',
  'time-input',
  // Advanced
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
  // Integrations
  'oauth-input',
  'file-selector',
  'file-upload',
  'project-selector',
  'folder-selector',
  'teams-selector',
  'channels-selector',
  'chats-selector',
])
export type SubBlockType = z.infer<typeof SubBlockTypeSchema>

/**
 * Parameter (input) schema for a block. Describes one entry on `inputs`.
 */
export const ParamSchema = z.object({
  type: ParamTypeSchema,
  required: z.boolean(),
  requiredForToolCall: z.boolean().optional(),
  description: z.string().optional(),
  schema: z
    .object({
      type: z.string(),
      properties: z.record(z.string(), z.any()),
      required: z.array(z.string()).optional(),
      additionalProperties: z.boolean().optional(),
      items: z
        .object({
          type: z.string(),
          properties: z.record(z.string(), z.any()).optional(),
          required: z.array(z.string()).optional(),
          additionalProperties: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
})
export type ParamSchema_ = z.infer<typeof ParamSchema>
export type Param = ParamSchema_

/**
 * BlockOutput — either a primitive kind or a nested record of kinds.
 */
export const BlockOutputSchema: z.ZodType<
  PrimitiveValueType | { [key: string]: PrimitiveValueType | Record<string, any> }
> = z.union([
  PrimitiveValueTypeSchema,
  z.record(z.string(), z.union([PrimitiveValueTypeSchema, z.record(z.string(), z.any())])),
])
export type BlockOutput = z.infer<typeof BlockOutputSchema>

/**
 * Single output contract (usually `response`).
 */
export const OutputSchema = z.object({
  type: z.union([BlockOutputSchema, z.literal('json')]),
  dependsOn: z
    .object({
      subBlockId: z.string(),
      condition: z.object({
        whenEmpty: z.union([BlockOutputSchema, z.literal('json')]),
        whenFilled: z.literal('json'),
      }),
    })
    .optional(),
  visualization: z
    .object({
      type: z.literal('image'),
      url: z.string(),
    })
    .optional(),
})
export type OutputContract = z.infer<typeof OutputSchema>

/**
 * Minimal execution-level shape for a SubBlock. Drops rendering concerns like
 * placeholder, rows, icons, etc. Retains fields that affect resolved values
 * (type, options, numeric constraints, condition, validation).
 */
export const SubBlockSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  label: z.string().optional(),
  type: SubBlockTypeSchema,
  layout: z.enum(['full', 'half']).optional(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
  required: z.boolean().optional(),

  // Value-domain constraints
  options: z
    .union([
      z.array(z.union([z.string(), z.number(), z.boolean()])),
      z.array(
        z.object({
          label: z.string(),
          id: z.string(),
          value: z.union([z.string(), z.number(), z.boolean()]).optional(),
          disabled: z.boolean().optional(),
          group: z.string().optional(),
          description: z.string().optional(),
        })
      ),
    ])
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  integer: z.boolean().optional(),

  // Conditional visibility (affects which subBlocks apply to the resolved input set)
  condition: z
    .object({
      field: z.string(),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean()])),
      ]),
      not: z.boolean().optional(),
      and: z
        .object({
          field: z.string(),
          value: z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.array(z.union([z.string(), z.number(), z.boolean()])),
          ]),
          not: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),

  // Code editors — relevant for execution because it shapes how values are parsed
  language: z.enum(['javascript', 'json', 'text', 'graphql', 'python', 'sql']).optional(),

  // Integration selector metadata that affects resolved params
  provider: z.string().optional(),
  serviceId: z.string().optional(),
  requiredScopes: z.array(z.string()).optional(),
  mimeType: z.string().optional(),
  allowedExtensions: z.array(z.string()).optional(),
  dependsOn: z.string().optional(),
  credentialSubBlockId: z.string().optional(),
})
export type SubBlock = z.infer<typeof SubBlockSchema>

/**
 * Compliance warning metadata propagated into the L2 contract so downstream
 * tooling (policy engine, workflow builders) can gate generation.
 */
export const ComplianceTagSchema = z.enum([
  'financial_trading',
  'crypto_trading',
  'high_risk',
  'regulated',
  'kyc_required',
  'region_restricted',
])
export type ComplianceTag = z.infer<typeof ComplianceTagSchema>

export const ComplianceWarningSchema = z.object({
  enabled: z.boolean(),
  tags: z.array(ComplianceTagSchema),
  disclaimer: z.string(),
  restrictedRegions: z.array(z.string()).optional(),
  requiresLicense: z.boolean().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'extreme']).optional(),
})
export type ComplianceWarning = z.infer<typeof ComplianceWarningSchema>

/**
 * Declared runtime capabilities of a block. Builders use these to
 * decide which blocks can be wired together and how to construct prompts /
 * permission checks.
 */
export const BlockCapabilitySchema = z.enum([
  'streaming',
  'tool_use',
  'memory',
  'code_execution',
  'file_io',
  'network',
  'oauth',
  'hitl', // human-in-the-loop
  'schedule',
  'webhook',
  'loop_body',
  'parallel_body',
])
export type BlockCapability = z.infer<typeof BlockCapabilitySchema>

/**
 * Tools binding at the block level (how the block dispatches to runtime tools).
 */
export const BlockToolsBindingSchema = z.object({
  access: z.array(z.string()),
  config: z
    .object({
      // Present as a name; actual function lives in runtime layer.
      toolResolver: z.string().optional(),
      paramsResolver: z.string().optional(),
    })
    .optional(),
})
export type BlockToolsBinding = z.infer<typeof BlockToolsBindingSchema>

/**
 * BlockSchema — the core L2 contract for a block definition.
 */
export const BlockSchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  longDescription: z.string().optional(),
  category: BlockCategorySchema,
  version: z.string().optional(),

  // Execution contract
  inputs: z.record(z.string(), ParamSchema),
  outputs: z.object({
    response: OutputSchema,
  }),
  tools: BlockToolsBindingSchema,

  // Declared capabilities
  capabilities: z.array(BlockCapabilitySchema).default([]),

  // Sub-block list (execution subset)
  subBlocks: z.array(SubBlockSchema).default([]),

  // Flags that affect runtime semantics, not rendering
  supportsCode: z.boolean().optional(),
  supportsPerformance: z.boolean().optional(),
  hideFromToolbar: z.boolean().optional(),
  isUtility: z.boolean().optional(),

  compliance: ComplianceWarningSchema.optional(),
})
export type Block = z.infer<typeof BlockSchema>
