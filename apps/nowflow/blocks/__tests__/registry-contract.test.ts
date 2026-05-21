import { describe, expect, it } from 'vitest'
import { registry } from '@/blocks/registry'

/**
 * Registry contract tests.
 *
 * These tests pin the structural invariants every block in the registry must
 * uphold. They run against the live `registry` object from `blocks/registry.ts`,
 * so adding a malformed block immediately fails CI rather than waiting for a
 * runtime crash inside the executor.
 *
 * Invariants checked here (one assertion per invariant, looped over all blocks):
 *  1. `type` matches the registry key (no silent typos)
 *  2. `name` is non-empty
 *  3. `description` is non-empty
 *  4. `bgColor` is a 6-digit hex (#RRGGBB)
 *  5. `icon` is defined
 *  6. `subBlocks` is an array (may be empty)
 *  7. `tools.access` is an array
 *  8. `tools.config.tool`, when present, is callable
 *  9. `outputs` is an object (may be empty)
 *
 * Every entry in `registry` is a single test case, so failures point directly
 * at the offending block.
 */

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

const blockEntries = Object.entries(registry)

describe('registry contract', () => {
  it('has at least 100 blocks (sanity check)', () => {
    expect(blockEntries.length).toBeGreaterThanOrEqual(100)
  })

  it('has no duplicate block types across keys', () => {
    const types = blockEntries.map(([, block]) => block.type)
    const uniqueTypes = new Set(types)
    expect(uniqueTypes.size).toBe(types.length)
  })

  describe('per-block invariants', () => {
    it.each(blockEntries)('%s: type matches registry key', (key, block) => {
      expect(block.type).toBe(key)
    })

    it.each(blockEntries)('%s: name is a non-empty string', (_key, block) => {
      expect(typeof block.name).toBe('string')
      expect(block.name.length).toBeGreaterThan(0)
    })

    it.each(blockEntries)('%s: description is a non-empty string', (_key, block) => {
      expect(typeof block.description).toBe('string')
      expect(block.description.length).toBeGreaterThan(0)
    })

    it.each(blockEntries)('%s: bgColor is a 6-digit hex color', (_key, block) => {
      expect(block.bgColor).toMatch(HEX_COLOR_RE)
    })

    it.each(blockEntries)('%s: icon is defined', (_key, block) => {
      expect(block.icon).toBeDefined()
    })

    it.each(blockEntries)('%s: subBlocks is an array', (_key, block) => {
      expect(Array.isArray(block.subBlocks)).toBe(true)
    })

    it.each(blockEntries)('%s: tools.access is an array', (_key, block) => {
      expect(Array.isArray(block.tools?.access)).toBe(true)
    })

    it.each(blockEntries)('%s: tools.config.tool is callable when present', (_key, block) => {
      const toolFn = block.tools?.config?.tool
      if (toolFn !== undefined) {
        expect(typeof toolFn).toBe('function')
      }
    })

    it.each(blockEntries)('%s: outputs is an object', (_key, block) => {
      expect(typeof block.outputs).toBe('object')
      expect(block.outputs).not.toBeNull()
    })
  })
})

describe('registry shape stability', () => {
  it('all subBlocks have an id and a type', () => {
    for (const [key, block] of blockEntries) {
      for (const sb of block.subBlocks) {
        expect(sb.id, `${key}: subBlock missing id`).toBeTruthy()
        expect(sb.type, `${key}: subBlock ${sb.id} missing type`).toBeTruthy()
      }
    }
  })

  it('subBlocks with the same id appear at least once with a condition guard', () => {
    // Reusing a subBlock id across operations is a deliberate pattern (e.g.
    // both `find` and `update` operations expose a `query` field). One
    // shared baseline copy + N conditional copies is also legitimate, so
    // the invariant we enforce is: when an id appears more than once,
    // **at least one** copy must carry a `condition` guard.
    for (const [key, block] of blockEntries) {
      const counts = new Map<string, number>()
      const conditioned = new Map<string, number>()
      for (const sb of block.subBlocks) {
        counts.set(sb.id, (counts.get(sb.id) ?? 0) + 1)
        if ((sb as any).condition) {
          conditioned.set(sb.id, (conditioned.get(sb.id) ?? 0) + 1)
        }
      }
      for (const [id, n] of counts) {
        if (n > 1) {
          expect(
            conditioned.get(id) ?? 0,
            `${key}: subBlock id "${id}" appears ${n} times with no condition guard on any copy`
          ).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('every block has at least one tool.access entry OR is in a free-form category', () => {
    // Trigger / control-flow / UI-only blocks may legitimately have empty
    // `tools.access`. Everything else is expected to declare at least one
    // downstream tool id.
    const FREE_FORM_TYPES = new Set([
      'starter',
      'condition',
      'router',
      'loop',
      'parallel',
      'function',
      'evaluator',
      'response',
      'memory',
      'workflow',
      'subflow',
      'comment',
      'sticky-note',
      'sticky_note',
      'sub-workflow',
      'sub_workflow',
    ])

    for (const [key, block] of blockEntries) {
      if (FREE_FORM_TYPES.has(block.type)) continue
      const access = block.tools?.access ?? []
      expect(
        access.length,
        `${key}: block has empty tools.access — add a tool id or list it under FREE_FORM_TYPES`
      ).toBeGreaterThanOrEqual(1)
    }
  })
})
