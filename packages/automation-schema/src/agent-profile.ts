import { z } from 'zod'

/**
 * L2 AgentProfile contract.
 *
 * Describes a reusable AI agent configuration that can be referenced by blocks
 * (typically the `agent` block) without repeating prompt, model, and tool
 * selections. Workflow builders treat agent profiles as first-class references
 * resolved at workflow build time.
 */
export const AgentProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  systemPrompt: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  tools: z.array(z.string()),
  knowledgeSourceIds: z.array(z.string()),
  memoryEnabled: z.boolean(),
  maxIterations: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type AgentProfile = z.infer<typeof AgentProfileSchema>
