/**
 * Standard Memory Configuration SubBlocks
 *
 * Reusable memory configuration for all agent blocks.
 * Use this by spreading into your subBlocks array.
 *
 * @example
 * ```typescript
 * import { getMemoryConfigSubBlocks } from './memory-config'
 *
 * export const MyAgentBlock: BlockConfig = {
 *   // ... other config
 *   subBlocks: [
 *     // ... existing subBlocks
 *     ...getMemoryConfigSubBlocks(),
 *   ]
 * }
 * ```
 */
import type { SubBlockConfig } from '../types'

export function getMemoryConfigSubBlocks(): SubBlockConfig[] {
  return [
    // Enable Memory Toggle
    {
      id: 'memoryEnabled',
      title: 'Enable Memory',
      type: 'switch',
      layout: 'half',
      tooltip:
        'Enable conversation memory to maintain context across interactions. Useful for customer service, research, and sales agents.',
    },

    // Memory Limit
    {
      id: 'memoryLimit',
      title: 'Memory Limit',
      type: 'slider',
      layout: 'half',
      min: 5,
      max: 50,
      step: 5,
      integer: true,
      tooltip: 'Maximum number of previous interactions to retrieve (default: 10)',
      condition: {
        field: 'memoryEnabled',
        value: true,
      },
    },

    // Importance Threshold
    {
      id: 'memoryImportance',
      title: 'Importance Threshold',
      type: 'slider',
      layout: 'half',
      min: 0,
      max: 1,
      step: 0.1,
      tooltip:
        'Minimum importance score (0-1) for retrieved memories. Higher = only important interactions (default: 0.3)',
      condition: {
        field: 'memoryEnabled',
        value: true,
      },
    },

    // Memory Tags
    {
      id: 'memoryTags',
      title: 'Memory Tags',
      type: 'short-input',
      layout: 'half',
      placeholder: 'customer-support, billing, technical',
      tooltip: 'Comma-separated tags for categorizing memories (optional)',
      condition: {
        field: 'memoryEnabled',
        value: true,
      },
    },
  ]
}

/**
 * Memory Configuration Input Schema
 *
 * Add these to your block's inputs object
 */
export const memoryConfigInputs = {
  memoryEnabled: { type: 'boolean', required: false },
  memoryLimit: { type: 'number', required: false },
  memoryImportance: { type: 'number', required: false },
  memoryTags: { type: 'string', required: false },
} as const
