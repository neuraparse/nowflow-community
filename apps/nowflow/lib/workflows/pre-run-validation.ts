/**
 * Pre-run validation bridge.
 *
 * Bridges UI state (subblock values from Zustand stores) to the
 * existing 5-phase ValidationEngine (which expects SerializedBlock + inputs).
 *
 * Called from the execution hook before workflow execution starts.
 *
 * Three-phase resolution ensures cross-block API key sharing works:
 *   Phase 1 – Resolve dropdown defaults (so model values are available)
 *   Phase 2 – Collect provider→apiKey map from blocks that already have keys
 *   Phase 3 – Fill missing API keys (toolParams → env vars → cross-block) + validate
 *
 * @module lib/workflows/pre-run-validation
 */
import { createLogger } from '@/lib/logs/console-logger'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import type { BlockState } from '@/stores/workflows/workflow/types'
import { getBlock } from '@/blocks'
import type { BlockValidationResult } from '@/executor/validation'
import { ValidationEngine } from '@/executor/validation/validation-engine'
import { getProviderFromModel } from '@/providers/utils'
import type { SerializedBlock } from '@/serializer/types'

const logger = createLogger('pre-run-validation')

/** Block types whose API key is keyed by the LLM provider, not block type. */
const PROVIDER_BASED_TYPES = new Set(['agent', 'router', 'evaluator'])

/**
 * Resolves a dropdown's effective value — returns the first option
 * when the stored value is empty (matching the UI dropdown behaviour
 * which visually shows the first option as default).
 */
function resolveDropdownDefault(blockType: string, subBlockId: string, rawValue: any): any {
  if (rawValue !== null && rawValue !== undefined && rawValue !== '') return rawValue

  const blockConfig = getBlock(blockType)
  if (!blockConfig) return rawValue

  const subBlockConfig = blockConfig.subBlocks.find((s) => s.id === subBlockId)
  if (!subBlockConfig || subBlockConfig.type !== 'dropdown' || !subBlockConfig.options)
    return rawValue

  const options =
    typeof subBlockConfig.options === 'function' ? subBlockConfig.options() : subBlockConfig.options

  if (options.length === 0) return rawValue

  const first = options[0]
  return typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean'
    ? first
    : first.id
}

/**
 * Determines the provider ID for a block given its type and model value.
 * Returns `undefined` when no cloud provider applies (e.g. Ollama).
 */
function getProviderForBlock(blockType: string, modelValue: any): string | undefined {
  try {
    const isProviderBased = PROVIDER_BASED_TYPES.has(blockType)
    const provider = isProviderBased && modelValue ? getProviderFromModel(modelValue) : blockType

    if (!provider || provider === 'ollama') return undefined
    return provider
  } catch {
    return undefined
  }
}

/**
 * Resolves an API key's effective value from:
 *  1. toolParams / env-var store (matching the auto-fill UI behaviour)
 *  2. Cross-block sharing (another block with the same provider already has a key)
 */
function resolveApiKey(
  blockId: string,
  provider: string,
  sharedProviderKeys: Record<string, string>
): string | undefined {
  // Try 1: toolParams + env var auto-discovery
  try {
    const resolved = useSubBlockStore.getState().resolveToolParamValue(provider, 'apiKey', blockId)
    if (resolved) return resolved
  } catch {
    /* ignore */
  }

  // Try 2: Cross-block sharing — use a key from another block with same provider
  if (sharedProviderKeys[provider]) return sharedProviderKeys[provider]

  return undefined
}

/**
 * Validates all blocks using the existing ValidationEngine.
 *
 * @param mergedStates - Block states with merged subblock values
 *                       (from mergeSubblockState utility)
 * @returns Record of blockId → validation result (only blocks with issues)
 */
export function validateAllBlocks(
  mergedStates: Record<string, BlockState>
): Record<string, BlockValidationResult> {
  const engine = new ValidationEngine()
  const results: Record<string, BlockValidationResult> = {}

  const blockEntries = Object.entries(mergedStates).filter(([, block]) => block && block.type)

  // ── Phase 1: Extract inputs & resolve dropdown defaults ──────────────
  const allInputs: Record<string, Record<string, any>> = {}

  for (const [blockId, block] of blockEntries) {
    const inputs: Record<string, any> = {}
    for (const [key, sb] of Object.entries(block.subBlocks)) {
      inputs[key] = resolveDropdownDefault(block.type, key, (sb as any).value)
    }
    allInputs[blockId] = inputs
  }

  // ── Phase 2: Collect provider→apiKey from blocks that already have one ─
  const sharedProviderKeys: Record<string, string> = {}

  for (const [blockId, block] of blockEntries) {
    const inputs = allInputs[blockId]
    const apiKey = inputs?.apiKey
    if (!apiKey || apiKey === '') continue

    const provider = getProviderForBlock(block.type, inputs.model)
    if (provider && !sharedProviderKeys[provider]) {
      sharedProviderKeys[provider] = apiKey
    }
  }

  // ── Phase 3: Fill missing API keys + validate ────────────────────────
  for (const [blockId, block] of blockEntries) {
    const inputs = allInputs[blockId]

    // Resolve missing API key from toolParams / env vars / cross-block
    if (!inputs.apiKey || inputs.apiKey === '') {
      const provider = getProviderForBlock(block.type, inputs.model)
      if (provider) {
        const resolved = resolveApiKey(blockId, provider, sharedProviderKeys)
        if (resolved) {
          inputs.apiKey = resolved
        }
      }
    }

    // Minimal SerializedBlock adapter for ValidationEngine
    const serializedBlock = {
      id: blockId,
      metadata: { id: block.type, name: block.name },
    } as SerializedBlock

    try {
      const result = engine.validateInputs(serializedBlock, inputs)

      // Template-referenced fields (e.g., {{env.KEY}}, {{block.output}}) resolve at runtime.
      // Remove validation errors/warnings for these fields — they may be valid at execution time.
      const templateFields = new Set(
        Object.entries(inputs)
          .filter(([, val]) => typeof val === 'string' && val.includes('{{') && val.includes('}}'))
          .map(([key]) => key)
      )
      if (templateFields.size > 0) {
        result.errors = result.errors.filter((e) => !templateFields.has(e.field))
        result.warnings = result.warnings.filter((w) => !templateFields.has(w.field))
        result.valid = result.errors.length === 0
      }

      if (!result.valid || result.warnings.length > 0) {
        results[blockId] = result
      }
    } catch (error) {
      logger.error(`Pre-run validation error for block "${block.name}" (${block.type})`, { error })
    }
  }

  const errorCount = Object.values(results).filter((r) => !r.valid).length
  const warningCount = Object.values(results).filter((r) => r.valid && r.warnings.length > 0).length

  if (errorCount > 0 || warningCount > 0) {
    logger.info(`Pre-run validation: ${errorCount} error(s), ${warningCount} warning(s)`)
  }

  return results
}
