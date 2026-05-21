/**
 * Standard Knowledge Source Configuration SubBlocks
 *
 * Reusable knowledge source configuration for agent blocks.
 * Use this by spreading into your subBlocks array.
 *
 * @example
 * ```typescript
 * import { getKnowledgeSourceSubBlocks, knowledgeSourceInputs } from './knowledge-config'
 *
 * export const MyAgentBlock: BlockConfig = {
 *   // ... other config
 *   subBlocks: [
 *     // ... existing subBlocks
 *     ...getKnowledgeSourceSubBlocks(),
 *     ...getMemoryConfigSubBlocks(),
 *   ],
 *   inputs: {
 *     // ... existing inputs
 *     ...knowledgeSourceInputs,
 *     ...memoryConfigInputs,
 *   }
 * }
 * ```
 */
import type { SubBlockConfig } from '../types'

export function getKnowledgeSourceSubBlocks(): SubBlockConfig[] {
  return [
    // Knowledge Sources Picker (RAG/Semantic Search)
    {
      id: 'knowledgeSources',
      title: 'Knowledge Sources',
      type: 'knowledge-source-input',
      layout: 'full',
    },

    // Max Search Results (visible when knowledge sources selected)
    {
      id: 'searchMaxResults',
      title: 'Max Search Results',
      type: 'slider',
      layout: 'half',
      min: 1,
      max: 20,
      condition: {
        field: 'knowledgeSources',
        value: '',
        not: true,
      },
    },

    // Similarity Threshold (visible when knowledge sources selected)
    {
      id: 'similarityThreshold',
      title: 'Similarity Threshold',
      type: 'slider',
      layout: 'half',
      min: 0,
      max: 1,
      step: 0.1,
      condition: {
        field: 'knowledgeSources',
        value: '',
        not: true,
      },
    },
  ]
}

/**
 * Knowledge Source Configuration Input Schema
 *
 * Add these to your block's inputs object
 */
export const knowledgeSourceInputs = {
  knowledgeSources: { type: 'string', required: false },
  searchMaxResults: { type: 'number', required: false },
  similarityThreshold: { type: 'number', required: false },
} as const
