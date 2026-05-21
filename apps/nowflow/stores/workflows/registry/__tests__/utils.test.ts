/**
 * Tests for pure utility functions in the workflow registry.
 * Covers WORKFLOW_COLORS, generateUniqueName, and getNextWorkflowColor.
 */
import { describe, expect, it } from 'vitest'
import type { WorkflowMetadata } from '@/stores/workflows/registry/types'
import {
  generateUniqueName,
  getNextWorkflowColor,
  WORKFLOW_COLORS,
} from '@/stores/workflows/registry/utils'

function buildWorkflow(overrides: Partial<WorkflowMetadata> = {}): WorkflowMetadata {
  return {
    id: overrides.id ?? 'id-1',
    name: overrides.name ?? 'Workflow 1',
    lastModified: overrides.lastModified ?? new Date('2024-01-01T00:00:00Z'),
    color: overrides.color ?? WORKFLOW_COLORS[0],
    ...overrides,
  }
}

describe('WORKFLOW_COLORS', () => {
  it('exposes a non-empty list of hex colors', () => {
    expect(WORKFLOW_COLORS).toBeInstanceOf(Array)
    expect(WORKFLOW_COLORS.length).toBeGreaterThan(0)
    for (const color of WORKFLOW_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

describe('generateUniqueName', () => {
  it('returns "Workflow 1" when there are no existing workflows', () => {
    expect(generateUniqueName({})).toBe('Workflow 1')
  })

  it('returns "Workflow 1" when existing workflows do not match "Workflow N"', () => {
    const workflows = {
      a: buildWorkflow({ id: 'a', name: 'My cool workflow' }),
      b: buildWorkflow({ id: 'b', name: 'Something else' }),
    }
    expect(generateUniqueName(workflows)).toBe('Workflow 1')
  })

  it('returns the next integer after the max existing Workflow N name', () => {
    const workflows = {
      a: buildWorkflow({ id: 'a', name: 'Workflow 1' }),
      b: buildWorkflow({ id: 'b', name: 'Workflow 3' }),
      c: buildWorkflow({ id: 'c', name: 'Workflow 2' }),
    }
    expect(generateUniqueName(workflows)).toBe('Workflow 4')
  })

  it('ignores non-matching names when computing the next number', () => {
    const workflows = {
      a: buildWorkflow({ id: 'a', name: 'Workflow 10' }),
      b: buildWorkflow({ id: 'b', name: 'Random' }),
      c: buildWorkflow({ id: 'c', name: 'Workflow 5' }),
    }
    expect(generateUniqueName(workflows)).toBe('Workflow 11')
  })
})

describe('getNextWorkflowColor', () => {
  it('returns the first color for an empty registry', () => {
    expect(getNextWorkflowColor({})).toBe(WORKFLOW_COLORS[0])
  })

  it('returns the color after the newest workflow color', () => {
    const workflows = {
      a: buildWorkflow({
        id: 'a',
        color: WORKFLOW_COLORS[0],
        lastModified: new Date('2024-01-01'),
      }),
      b: buildWorkflow({
        id: 'b',
        color: WORKFLOW_COLORS[2],
        lastModified: new Date('2024-06-01'),
      }),
    }
    expect(getNextWorkflowColor(workflows)).toBe(WORKFLOW_COLORS[3])
  })

  it('wraps around to the first color when the newest color is the last one', () => {
    const lastColor = WORKFLOW_COLORS[WORKFLOW_COLORS.length - 1]
    const workflows = {
      a: buildWorkflow({
        id: 'a',
        color: lastColor,
        lastModified: new Date('2024-06-01'),
      }),
    }
    expect(getNextWorkflowColor(workflows)).toBe(WORKFLOW_COLORS[0])
  })

  it('handles lastModified stored as ISO strings', () => {
    const workflows: Record<string, WorkflowMetadata> = {
      a: {
        id: 'a',
        name: 'A',
        color: WORKFLOW_COLORS[1],
        // Simulate raw serialized metadata from localStorage
        lastModified: '2024-03-03T00:00:00Z' as unknown as Date,
      },
      b: {
        id: 'b',
        name: 'B',
        color: WORKFLOW_COLORS[0],
        lastModified: '2023-01-01T00:00:00Z' as unknown as Date,
      },
    }
    expect(getNextWorkflowColor(workflows)).toBe(WORKFLOW_COLORS[2])
  })

  it('falls back to color index 0 when newest workflow color is not in the palette', () => {
    const workflows = {
      a: buildWorkflow({
        id: 'a',
        color: '#deadbeef',
        lastModified: new Date('2024-06-01'),
      }),
    }
    // indexOf returns -1 → (-1 + 1) % N === 0 → WORKFLOW_COLORS[0]
    expect(getNextWorkflowColor(workflows)).toBe(WORKFLOW_COLORS[0])
  })
})
