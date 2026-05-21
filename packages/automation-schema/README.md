# @nowflow/automation-schema

L2 canonical zod contracts for the NowFlow automation platform. This package
is the single source of truth shared between workflow authoring surfaces and
the executor (which runs them). Every module exports a
`FooSchema` zod object plus an inferred `Foo` type.

## Modules

- `block` — `BlockSchema`, `SubBlockSchema`, `ParamSchema`, `OutputSchema`,
  `BlockToolsBindingSchema`, `BlockCapabilitySchema`, `BlockCategorySchema`,
  `SubBlockTypeSchema`, `ParamTypeSchema`, `PrimitiveValueTypeSchema`,
  `BlockOutputSchema`, `ComplianceWarningSchema`, `ComplianceTagSchema`.
- `execution` — `ExecutionContextSchema`, `ExecutionResultSchema`,
  `ExecutionMetadataSchema`, `BlockStateSchema`, `BlockLogSchema`,
  `NormalizedBlockOutputSchema`, `WorkflowEdgeConnectionSchema`.
- `workflow` — `SerializedWorkflowSchema`, `SerializedNodeSchema`,
  `SerializedEdgeSchema`, `SerializedLoopSchema`, `SerializedGroupSchema`,
  `PositionSchema`.
- `variable-reference` — `ParsedReferenceSchema`,
  `VariableReferenceStringSchema`, `ReferenceKindSchema`, `parseReference`,
  `extractReferences`, plus the reference regex constants.
- `agent-profile` — `AgentProfileSchema`.
- `knowledge-source` — `KnowledgeSourceSchema`, `KnowledgeSourceKindSchema`,
  `ChunkingStrategySchema`.
- `trigger` — `TriggerConfigSchema`, `WebhookTriggerSchema`,
  `ScheduleTriggerSchema`, `PollTriggerSchema`, `WebhookRateLimitSchema`.
- `tool` — `ToolSchema`, `ToolProviderSchema`, `ToolRateLimitSchema`.

All symbols are re-exported from the package root via `src/index.ts`.
