/**
 * @nowflow/automation-schema
 *
 * L2 canonical contracts for NowFlow workflows, blocks, execution state,
 * triggers, tools, agent profiles, and knowledge sources. All modules export
 * both a `FooSchema` (zod) and a `Foo` type (via `z.infer`).
 */

export * from './block'
export * from './execution'
export * from './workflow'
export * from './variable-reference'
export * from './agent-profile'
export * from './knowledge-source'
export * from './trigger'
export * from './tool'
