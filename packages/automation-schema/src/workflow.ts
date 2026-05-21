import { z } from 'zod'
import { BlockOutputSchema, ParamTypeSchema } from './block'

/**
 * L2 serialized workflow contracts.
 *
 * These mirror `apps/nowflow/serializer/types.ts` but reshaped for workflow builders:
 * - Edges are first-class (separated from blocks).
 * - Loops and groups are modeled as container primitives.
 * - Position becomes optional (generation is pre-layout).
 */

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})
export type Position = z.infer<typeof PositionSchema>

/**
 * A serialized block in the workflow graph (runtime form).
 */
export const SerializedNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: PositionSchema.optional(),
  config: z.object({
    tool: z.string(),
    params: z.record(z.string(), z.any()),
  }),
  inputs: z.record(z.string(), ParamTypeSchema),
  outputs: z.record(z.string(), BlockOutputSchema),
  metadata: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),
  enabled: z.boolean().default(true),
  /** Optional parent container (loop/group) id. */
  parentId: z.string().optional(),
})
export type SerializedNode = z.infer<typeof SerializedNodeSchema>

/**
 * A connection between two serialized nodes.
 */
export const SerializedEdgeSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  condition: z
    .object({
      type: z.enum(['if', 'else', 'else if']),
      expression: z.string().optional(),
    })
    .optional(),
})
export type SerializedEdge = z.infer<typeof SerializedEdgeSchema>

/**
 * Loop container describing iteration over a subgraph of nodes.
 */
export const SerializedLoopSchema = z.object({
  id: z.string(),
  nodes: z.array(z.string()),
  iterations: z.number().int().nonnegative(),
  loopType: z.enum(['for', 'forEach', 'while']).optional(),
  forEachItems: z.union([z.array(z.any()), z.record(z.string(), z.any()), z.string()]).optional(),
})
export type SerializedLoop = z.infer<typeof SerializedLoopSchema>

/**
 * Group container — a purely visual/logical grouping of nodes that share a
 * configuration scope (e.g. parallel branch, subflow).
 */
export const SerializedGroupSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  nodes: z.array(z.string()),
  kind: z.enum(['group', 'parallel', 'subflow']).default('group'),
})
export type SerializedGroup = z.infer<typeof SerializedGroupSchema>

/**
 * A complete serialized workflow. This is the L2 canonical form emitted by
 * workflow authoring surfaces and consumed by the executor after import.
 */
export const SerializedWorkflowSchema = z.object({
  version: z.string(),
  blocks: z.array(SerializedNodeSchema),
  edges: z.array(SerializedEdgeSchema),
  loops: z.record(z.string(), SerializedLoopSchema).default({}),
  groups: z.record(z.string(), SerializedGroupSchema).default({}),
  /** Workflow-scoped variables referenced as `<variable.name>`. */
  variables: z
    .record(
      z.string(),
      z.object({
        type: ParamTypeSchema,
        value: z.any().optional(),
        description: z.string().optional(),
      })
    )
    .default({}),
  metadata: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
})
export type SerializedWorkflow = z.infer<typeof SerializedWorkflowSchema>
