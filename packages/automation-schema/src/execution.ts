import { z } from 'zod'
import { SerializedEdgeSchema, SerializedWorkflowSchema } from './workflow'

/**
 * L2 execution-time contracts. These mirror the runtime types in
 * `apps/nowflow/executor/types.ts` with zod validation.
 */

/**
 * NormalizedBlockOutput — the standardized shape every block returns.
 */
export const NormalizedBlockOutputSchema = z
  .object({
    response: z
      .object({
        content: z.string().optional(),
        model: z.string().optional(),
        tokens: z
          .object({
            prompt: z.number().optional(),
            completion: z.number().optional(),
            total: z.number().optional(),
          })
          .optional(),
        toolCalls: z
          .object({
            list: z.array(z.any()),
            count: z.number(),
          })
          .optional(),
        selectedPath: z
          .object({
            blockId: z.string(),
            blockType: z.string().optional(),
            blockTitle: z.string().optional(),
          })
          .optional(),
        selectedConditionId: z.string().optional(),
        conditionResult: z.boolean().optional(),
        result: z.any().optional(),
        stdout: z.string().optional(),
        executionTime: z.number().optional(),
        data: z.any().optional(),
        status: z.number().optional(),
        headers: z.record(z.string(), z.string()).optional(),
        error: z.string().optional(),
      })
      .catchall(z.any()),
    error: z.string().optional(),
  })
  .catchall(z.any())
export type NormalizedBlockOutput = z.infer<typeof NormalizedBlockOutputSchema>

/**
 * BlockLog — a record of a single block's execution.
 */
export const BlockLogSchema = z.object({
  blockId: z.string(),
  blockName: z.string().optional(),
  blockType: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMs: z.number(),
  success: z.boolean(),
  output: z.any().optional(),
  error: z.string().optional(),
})
export type BlockLog = z.infer<typeof BlockLogSchema>

/**
 * BlockState — runtime state of a block captured in the execution context.
 */
export const BlockStateSchema = z.object({
  output: NormalizedBlockOutputSchema,
  executed: z.boolean(),
  executionTime: z.number().optional(),
})
export type BlockState = z.infer<typeof BlockStateSchema>

/**
 * WorkflowEdgeConnection — a light-weight edge projection used in metadata.
 */
export const WorkflowEdgeConnectionSchema = SerializedEdgeSchema.pick({
  source: true,
  target: true,
  sourceHandle: true,
  targetHandle: true,
})
export type WorkflowEdgeConnection = z.infer<typeof WorkflowEdgeConnectionSchema>

/**
 * ExecutionMetadata — timing and auxiliary metadata for a workflow run.
 *
 * NOTE: The zod schema intentionally omits `context` (which is recursive)
 * because zod recursive types would require `z.lazy` and this metadata is
 * typically serialized without the full context.
 */
export const ExecutionMetadataSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  duration: z.number(),
  pendingBlocks: z.array(z.string()).optional(),
  isDebugSession: z.boolean().optional(),
  workflowConnections: z.array(WorkflowEdgeConnectionSchema).optional(),
  hitlPaused: z.boolean().optional(),
  hitlRequestId: z.string().optional(),
  hitlBlockId: z.string().optional(),
  experimentId: z.string().optional(),
  variantId: z.string().optional(),
  variantName: z.string().optional(),
})
export type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>

/**
 * ExecutionContext — the full runtime context for a workflow execution.
 *
 * Map/Set fields from the runtime are modeled as plain records/arrays in the
 * zod schema to keep the contract serializable. Conversion happens at the
 * runtime boundary.
 */
export const ExecutionContextSchema = z.object({
  workflowId: z.string(),
  executionId: z.string().optional(),

  userId: z.string().optional(),
  sessionId: z.string().optional(),
  sessionToken: z.string().optional(),

  memoryEnabled: z.boolean().optional(),
  sessionMetadata: z.record(z.string(), z.any()).optional(),

  apiBaseUrl: z.string().optional(),

  ownerId: z.string().optional(),
  notifyOnCompletion: z.boolean().optional(),
  notifyOnFailure: z.boolean().optional(),

  blockStates: z.record(z.string(), BlockStateSchema),
  blockLogs: z.array(BlockLogSchema),
  metadata: ExecutionMetadataSchema,
  environmentVariables: z.record(z.string(), z.string()),

  decisions: z.object({
    router: z.record(z.string(), z.string()),
    condition: z.record(z.string(), z.string()),
  }),

  loopIterations: z.record(z.string(), z.number()),
  loopItems: z.record(z.string(), z.any()),
  completedLoops: z.array(z.string()),

  executedBlocks: z.array(z.string()),
  activeExecutionPath: z.array(z.string()),

  workflow: SerializedWorkflowSchema.optional(),

  stream: z.boolean().optional(),
  selectedOutputIds: z.array(z.string()).optional(),
  edges: z.array(WorkflowEdgeConnectionSchema).optional(),
})
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>

/**
 * ExecutionResult — the outcome of a completed workflow run.
 */
export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  output: NormalizedBlockOutputSchema,
  error: z.string().optional(),
  logs: z.array(BlockLogSchema).optional(),
  metadata: ExecutionMetadataSchema.optional(),
  blockId: z.string().optional(),
  blockName: z.string().optional(),
  blockType: z.string().optional(),
})
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>
