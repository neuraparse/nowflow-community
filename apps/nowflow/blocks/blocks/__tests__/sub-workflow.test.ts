import { describe, expect, it, vi } from 'vitest'
import { SubWorkflowBlock } from '../sub-workflow'

vi.mock('@/components/icons', () => ({ PlayButtonIcon: () => null }))

describe('SubWorkflowBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SubWorkflowBlock).toBeDefined()
    expect(typeof SubWorkflowBlock.type).toBe('string')
    expect(SubWorkflowBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(SubWorkflowBlock.subBlocks)).toBe(true)
  })

  it('has type sub-workflow', () => {
    expect(SubWorkflowBlock.type).toBe('sub-workflow')
  })

  it('has empty tools.access (composition block, no tool)', () => {
    expect(SubWorkflowBlock.tools.access).toEqual([])
  })

  it('exposes workflowId and inputData subBlocks', () => {
    const ids = SubWorkflowBlock.subBlocks.map((s) => s.id)
    expect(ids).toContain('workflowId')
    expect(ids).toContain('inputData')
  })

  it('declares workflowId as required input', () => {
    expect(SubWorkflowBlock.inputs!.workflowId.required).toBe(true)
    expect(SubWorkflowBlock.inputs!.inputData.required).toBe(false)
  })

  it('declares output keys (content, executionId, status)', () => {
    const out = SubWorkflowBlock.outputs!.response.type as Record<string, string>
    expect(out.content).toBe('any')
    expect(out.executionId).toBe('string')
    expect(out.status).toBe('string')
  })
})
