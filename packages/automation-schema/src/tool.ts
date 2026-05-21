import { z } from 'zod'

/**
 * L2 Tool contract.
 *
 * Describes a runtime-invocable tool that an agent (or a tool-capable block)
 * can dispatch to. Parameters and return shape are carried as zod-compatible
 * JSON Schema-like records so the contract is serializable across the
 * builder <-> executor boundary.
 */
export const ToolProviderSchema = z.enum(['internal', 'http', 'custom'])
export type ToolProvider = z.infer<typeof ToolProviderSchema>

export const ToolRateLimitSchema = z.object({
  perMinute: z.number(),
})
export type ToolRateLimit = z.infer<typeof ToolRateLimitSchema>

export const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  returns: z.record(z.string(), z.unknown()).optional(),
  provider: ToolProviderSchema,
  endpoint: z.string().optional(),
  requiresAuth: z.boolean(),
  rateLimit: ToolRateLimitSchema.optional(),
})
export type Tool = z.infer<typeof ToolSchema>
