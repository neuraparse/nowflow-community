import { createLogger } from '@/lib/logs/console-logger'
import { useSubBlockStore } from './subblock/store'
import { BlockState, SubBlockState } from './workflow/types'

const logger = createLogger('utils')

export function stripTransientBlockFields(
  blocks: Record<string, BlockState>
): Record<string, BlockState> {
  return Object.fromEntries(
    Object.entries(blocks).map(([id, block]) => {
      if (!block || typeof block !== 'object') return [id, block]
      // `isNew` is a UI-only flag; never persist/sync it.
      const rest = { ...block }
      delete rest.isNew
      return [id, rest]
    })
  ) as Record<string, BlockState>
}

/**
 * Merges workflow block states with subblock values while maintaining block structure
 * @param blocks - Block configurations from workflow store
 * @param workflowId - ID of the workflow to merge values for
 * @param blockId - Optional specific block ID to merge (merges all if not provided)
 * @returns Merged block states with updated values
 */
export function mergeSubblockState(
  blocks: Record<string, BlockState>,
  workflowId?: string,
  blockId?: string
): Record<string, BlockState> {
  const blocksToProcess = blockId ? { [blockId]: blocks[blockId] } : blocks
  const subBlockStore = useSubBlockStore.getState()

  // Validate blocks and try to recover missing fields from registry
  const validBlocks = Object.fromEntries(
    Object.entries(blocksToProcess).filter(([id, block]) => {
      if (!block) {
        logger.warn(`Skipping null block during merge: ${id}`)
        return false
      }

      // Try to recover missing name from block registry
      if (block.type && !block.name) {
        try {
          const { getBlock } = require('@/blocks')
          const config = getBlock(block.type)
          if (config) {
            block.name = config.name
            logger.warn(
              `Recovered missing name for block ${id} (type: ${block.type}) → "${block.name}"`
            )
          }
        } catch {
          /* registry not available */
        }
      }

      if (!block.type || !block.name) {
        logger.error(
          `DROPPING block ${id} from merge — missing type="${block.type}" name="${block.name}". This block will NOT execute.`
        )
        return false
      }
      return true
    })
  )

  // Get all the values stored in the subblock store for this workflow
  const workflowSubblockValues = workflowId ? subBlockStore.workflowValues[workflowId] || {} : {}

  return Object.entries(validBlocks).reduce(
    (acc, [id, block]) => {
      // Skip if block is undefined (should not happen after filtering, but safety check)
      if (!block) {
        return acc
      }

      // Initialize subBlocks if not present
      const blockSubBlocks = block.subBlocks || {}

      // Get stored values for this block
      const blockValues = workflowSubblockValues[id] || {}

      // Create a deep copy of the block's subBlocks to maintain structure
      const mergedSubBlocks = Object.entries(blockSubBlocks).reduce(
        (subAcc, [subBlockId, subBlock]) => {
          // Skip if subBlock is undefined
          if (!subBlock) {
            return subAcc
          }

          // Get the stored value for this subblock
          let storedValue: any = undefined

          // If workflowId is provided, use it to get the value
          if (workflowId) {
            // Try to get the value from the subblock store for this specific workflow
            if (blockValues[subBlockId] !== undefined) {
              storedValue = blockValues[subBlockId]
            }
          } else {
            // Fall back to the active workflow if no workflowId is provided
            const fallback = subBlockStore.getValue(id, subBlockId)
            if (fallback !== null) {
              storedValue = fallback
            }
          }

          // Create a new subblock object with the same structure but updated value
          // Use stored value if it exists (including empty strings), otherwise use default
          const finalValue = storedValue !== undefined ? storedValue : subBlock.value

          subAcc[subBlockId] = {
            ...subBlock,
            value: finalValue,
          }

          return subAcc
        },
        {} as Record<string, SubBlockState>
      )

      // Add any values that exist in the store but aren't in the block structure
      // This handles cases where block config has been updated but values still exist
      Object.entries(blockValues).forEach(([subBlockId, value]) => {
        if (!mergedSubBlocks[subBlockId] && value !== null && value !== undefined) {
          // Create a minimal subblock structure
          mergedSubBlocks[subBlockId] = {
            id: subBlockId,
            type: 'short-input', // Default type that's safe to use
            value: value,
          }
        }
      })

      // Return the full block state with updated subBlocks
      acc[id] = {
        ...block,
        subBlocks: mergedSubBlocks,
      }

      return acc
    },
    {} as Record<string, BlockState>
  )
}

/**
 * Asynchronously merges workflow block states with subblock values
 * Ensures all values are properly resolved before returning
 *
 * @param blocks - Block configurations from workflow store
 * @param workflowId - ID of the workflow to merge values for
 * @param blockId - Optional specific block ID to merge (merges all if not provided)
 * @returns Promise resolving to merged block states with updated values
 */
export async function mergeSubblockStateAsync(
  blocks: Record<string, BlockState>,
  workflowId?: string,
  blockId?: string
): Promise<Record<string, BlockState>> {
  const blocksToProcess = blockId ? { [blockId]: blocks[blockId] } : blocks
  const subBlockStore = useSubBlockStore.getState()

  // Process blocks in parallel for better performance
  const processedBlockEntries = await Promise.all(
    Object.entries(blocksToProcess).map(async ([id, block]) => {
      // Skip if block is undefined or doesn't have subBlocks
      if (!block || !block.subBlocks) {
        return [id, block] as const
      }

      // Process all subblocks in parallel
      const subBlockEntries = await Promise.all(
        Object.entries(block.subBlocks).map(async ([subBlockId, subBlock]) => {
          // Skip if subBlock is undefined
          if (!subBlock) {
            return [subBlockId, subBlock] as const
          }

          // Get the stored value for this subblock
          let storedValue: any = undefined

          // If workflowId is provided, use it to get the value
          if (workflowId) {
            // Try to get the value from the subblock store for this specific workflow
            const workflowValues = subBlockStore.workflowValues[workflowId]
            if (
              workflowValues &&
              workflowValues[id] &&
              workflowValues[id][subBlockId] !== undefined
            ) {
              storedValue = workflowValues[id][subBlockId]
            }
          } else {
            // Fall back to the active workflow if no workflowId is provided
            const fallback = subBlockStore.getValue(id, subBlockId)
            if (fallback !== null) {
              storedValue = fallback
            }
          }

          // Create a new subblock object with the same structure but updated value
          return [
            subBlockId,
            {
              ...subBlock,
              value:
                storedValue !== undefined && storedValue !== null ? storedValue : subBlock.value,
            },
          ] as const
        })
      )

      // Convert entries back to an object
      const mergedSubBlocks = Object.fromEntries(subBlockEntries) as Record<string, SubBlockState>

      // Return the full block state with updated subBlocks
      return [
        id,
        {
          ...block,
          subBlocks: mergedSubBlocks,
        },
      ] as const
    })
  )

  // Convert entries back to an object
  return Object.fromEntries(processedBlockEntries) as Record<string, BlockState>
}
