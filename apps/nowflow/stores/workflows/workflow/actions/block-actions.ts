/**
 * Block CRUD actions slice for the workflow store.
 * Handles addBlock, removeBlock, updateBlock, duplicateBlock, and related block mutations.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { getBlock } from '@/blocks'
import { resolveOutputType } from '@/blocks/utils'
import { useValidationStore } from '../../../validation/store'
import { pushHistory } from '../../middleware'
import { useWorkflowRegistry } from '../../registry/store'
import { useSubBlockStore } from '../../subblock/store'
import { workflowSync } from '../../sync'
import { mergeSubblockState } from '../../utils'
import { useWorkflowStyleStore } from '../../workflow-style/store'
import { GroupState, Loop, Position, SubBlockState } from '../types'

const logger = createLogger('WorkflowStore')

export type BlockActionsSliceDeps = {
  safeSet: any
  get: any
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

function resolveInitialSubBlockValue(subBlock: any) {
  if (!Object.prototype.hasOwnProperty.call(subBlock, 'value')) return null

  const value = typeof subBlock.value === 'function' ? subBlock.value({}) : subBlock.value
  return value === undefined ? null : cloneValue(value)
}

function createSubBlocksFromConfig(blockConfig: any): Record<string, SubBlockState> {
  const subBlocks: Record<string, SubBlockState> = {}

  ;(blockConfig.subBlocks || []).forEach((subBlock: any) => {
    const subBlockId = subBlock.id
    subBlocks[subBlockId] = {
      id: subBlockId,
      type: subBlock.type,
      value: resolveInitialSubBlockValue(subBlock) as any,
    }
  })

  return subBlocks
}

function toWorkflowValue(value: any) {
  return value === null || value === undefined ? '' : cloneValue(value)
}

function buildSubBlockValueMap(subBlocks: Record<string, SubBlockState>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(subBlocks).map(([subBlockId, subBlock]) => [
      subBlockId,
      toWorkflowValue(subBlock.value),
    ])
  )
}

function seedSubBlockStore(
  blockId: string,
  subBlocks: Record<string, SubBlockState>,
  values?: Record<string, any>,
  options: { preserveExisting?: boolean } = {}
) {
  const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
  if (!activeWorkflowId) return

  const defaults = buildSubBlockValueMap(subBlocks)
  const providedValues = values ? cloneValue(values) : {}

  useSubBlockStore.setState((state: any) => {
    const workflowValues = state.workflowValues[activeWorkflowId] || {}
    const existingBlockValues = workflowValues[blockId] || {}
    const nextBlockValues =
      options.preserveExisting === false
        ? {
            ...defaults,
            ...providedValues,
          }
        : {
            ...defaults,
            ...providedValues,
            ...existingBlockValues,
          }

    return {
      workflowValues: {
        ...state.workflowValues,
        [activeWorkflowId]: {
          ...workflowValues,
          [blockId]: nextBlockValues,
        },
      },
    }
  })
}

export function createBlockActionsSlice({ safeSet, get }: BlockActionsSliceDeps) {
  return {
    addBlock: (id: string, type: string, name: string, position: Position) => {
      // Convert 'output' type blocks to 'function' type
      if (type === 'output') {
        type = 'function'
      }

      // Prevent adding multiple starter blocks
      if (type === 'starter') {
        const existingStarter = Object.values(get().blocks).find((b: any) => b.type === 'starter')
        if (existingStarter) {
          logger.warn('Cannot add multiple starter blocks to a workflow')
          return
        }
      }

      const blockConfig = getBlock(type)
      if (!blockConfig) return

      const subBlocks = createSubBlocksFromConfig(blockConfig)

      const outputs = resolveOutputType(blockConfig.outputs, subBlocks)

      // Get global node style
      const globalNodeStyle = useWorkflowStyleStore.getState().globalNodeStyle

      const newState = {
        blocks: {
          ...get().blocks,
          [id]: {
            id,
            type,
            name,
            position,
            subBlocks,
            outputs,
            enabled: true,
            horizontalHandles: true,
            isWide: false,
            height: 0,
            nodeStyle: globalNodeStyle,
            isNew: true,
            createdAt: Date.now(),
          },
        },
        edges: [...get().edges],
        loops: { ...get().loops },
      }

      // Remove isNew flag after 3 seconds
      setTimeout(() => {
        const currentBlock = get().blocks[id]
        if (currentBlock?.isNew) {
          safeSet({
            blocks: {
              ...get().blocks,
              [id]: {
                ...currentBlock,
                isNew: false,
              },
            },
            edges: [...get().edges],
            loops: { ...get().loops },
          })
        }
      }, 3000)

      safeSet(newState)
      seedSubBlockStore(id, subBlocks)
      pushHistory(safeSet, get, newState, `Add ${type} block`)
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncImmediate()
    },

    removeBlock: (id: string) => {
      // Prevent deleting the starter block
      const block = get().blocks[id]
      if (block?.type === 'starter') {
        logger.warn('Cannot delete the starter block')
        return
      }

      const subBlockStore = useSubBlockStore.getState()
      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId

      const newState = {
        blocks: { ...get().blocks },
        edges: [...get().edges].filter((edge: any) => edge.source !== id && edge.target !== id),
        loops: { ...get().loops },
        groups: { ...get().groups },
      }

      // Clean up subblock values before removing the block
      if (activeWorkflowId) {
        const updatedWorkflowValues = {
          ...(subBlockStore.workflowValues[activeWorkflowId] || {}),
        }
        delete updatedWorkflowValues[id]

        useSubBlockStore.setState((state: any) => ({
          workflowValues: {
            ...state.workflowValues,
            [activeWorkflowId]: updatedWorkflowValues,
          },
        }))
      }

      // Clean up validation errors for this block
      useValidationStore.getState().clearBlock(id)

      // Clean up loops
      Object.entries(newState.loops).forEach(([loopId, loop]) => {
        const typedLoop = loop as Loop
        if (typedLoop.nodes.includes(id)) {
          if (typedLoop.nodes.length <= 1) {
            delete newState.loops[loopId]
          } else {
            newState.loops[loopId] = {
              ...typedLoop,
              nodes: typedLoop.nodes.filter((nodeId) => nodeId !== id),
            }
          }
        }
      })

      // Clean up groups
      Object.entries(newState.groups).forEach(([groupId, group]) => {
        const typedGroup = group as GroupState
        if (typedGroup.nodeIds.includes(id)) {
          const newNodeIds = typedGroup.nodeIds.filter((nodeId) => nodeId !== id)

          if (newNodeIds.length <= 1) {
            delete newState.groups[groupId]
            logger.debug(
              `🗑️ Auto-deleted group ${groupId} - insufficient nodes after block removal`
            )
          } else {
            newState.groups[groupId] = {
              ...typedGroup,
              nodeIds: newNodeIds,
            }
            logger.debug(`🔧 Updated group ${groupId} - removed block ${id}`)
          }
        }
      })

      delete newState.blocks[id]

      safeSet(newState)
      pushHistory(safeSet, get, newState, 'Remove block')
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncImmediate()
    },

    updateBlockPosition: (id: string, position: Position) => {
      safeSet((state: any) => ({
        blocks: {
          ...state.blocks,
          [id]: {
            ...state.blocks[id],
            position,
          },
        },
        edges: [...state.edges],
      }))
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    toggleBlockEnabled: (id: string) => {
      const newState = {
        blocks: {
          ...get().blocks,
          [id]: {
            ...get().blocks[id],
            enabled: !get().blocks[id].enabled,
          },
        },
        edges: [...get().edges],
      }

      safeSet(newState)
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    duplicateBlock: (id: string) => {
      const block = get().blocks[id]
      if (!block) return

      // Prevent duplicating the starter block
      if (block.type === 'starter') {
        logger.warn('Cannot duplicate the starter block')
        return
      }

      const newId = crypto.randomUUID()
      const offsetPosition = {
        x: block.position.x + 250,
        y: block.position.y + 20,
      }

      const match = block.name.match(/(.*?)(\d+)?$/)
      const newName = match && match[2] ? `${match[1]}${parseInt(match[2]) + 1}` : `${block.name} 1`

      const mergedBlock = mergeSubblockState(get().blocks, id)[id]

      const newSubBlocks = Object.entries(mergedBlock.subBlocks).reduce(
        (acc: any, [subId, subBlock]: [string, any]) => ({
          ...acc,
          [subId]: {
            ...subBlock,
            value: JSON.parse(JSON.stringify(subBlock.value)),
          },
        }),
        {}
      )

      const newState = {
        blocks: {
          ...get().blocks,
          [newId]: {
            ...block,
            id: newId,
            name: newName,
            position: offsetPosition,
            subBlocks: newSubBlocks,
          },
        },
        edges: [...get().edges],
        loops: { ...get().loops },
      }

      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
      if (activeWorkflowId) {
        const subBlockValues =
          useSubBlockStore.getState().workflowValues[activeWorkflowId]?.[id] || {}
        seedSubBlockStore(newId, newSubBlocks, subBlockValues)
      }

      safeSet(newState)
      pushHistory(safeSet, get, newState, `Duplicate ${block.type} block`)
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    toggleBlockHandles: (id: string) => {
      const newState = {
        blocks: {
          ...get().blocks,
          [id]: {
            ...get().blocks[id],
            horizontalHandles: !get().blocks[id].horizontalHandles,
          },
        },
        edges: [...get().edges],
      }

      safeSet(newState)
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateBlockName: (id: string, name: string) => {
      const oldBlock = get().blocks[id]
      if (!oldBlock) return

      const newState = {
        blocks: {
          ...get().blocks,
          [id]: {
            ...oldBlock,
            name,
          },
        },
        edges: [...get().edges],
        loops: { ...get().loops },
      }

      // Update references in subblock store
      const subBlockStore = useSubBlockStore.getState()
      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
      if (activeWorkflowId) {
        const workflowValues = subBlockStore.workflowValues[activeWorkflowId] || {}
        const updatedWorkflowValues = { ...workflowValues }

        Object.entries(workflowValues).forEach(([blockId, blockValues]) => {
          if (blockId === id) return

          Object.entries(blockValues).forEach(([subBlockId, value]) => {
            const oldBlockName = oldBlock.name.replace(/\s+/g, '').toLowerCase()
            const newBlockName = name.replace(/\s+/g, '').toLowerCase()
            const regex = new RegExp(`<${oldBlockName}\\.`, 'g')

            updatedWorkflowValues[blockId][subBlockId] = updateReferences(
              value,
              regex,
              `<${newBlockName}.`
            )

            function updateReferences(value: any, regex: RegExp, replacement: string): any {
              if (typeof value === 'string') {
                return regex.test(value) ? value.replace(regex, replacement) : value
              }
              if (Array.isArray(value)) {
                return value.map((item) => updateReferences(item, regex, replacement))
              }
              if (value !== null && typeof value === 'object') {
                const result = { ...value }
                for (const key in result) {
                  result[key] = updateReferences(result[key], regex, replacement)
                }
                return result
              }
              return value
            }
          })
        })

        useSubBlockStore.setState({
          workflowValues: {
            ...subBlockStore.workflowValues,
            [activeWorkflowId]: updatedWorkflowValues,
          },
        })
      }

      safeSet(newState)
      pushHistory(safeSet, get, newState, `${name} block name updated`)
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    updateBlock: (id: string, updates: Partial<any>) => {
      const oldBlock = get().blocks[id]
      if (!oldBlock) return

      const newState = {
        blocks: {
          ...get().blocks,
          [id]: {
            ...oldBlock,
            ...updates,
          },
        },
        edges: [...get().edges],
        loops: { ...get().loops },
      }

      safeSet(newState)
      if (updates.subBlocks) {
        seedSubBlockStore(id, newState.blocks[id].subBlocks)
      }
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    toggleBlockWide: (id: string) => {
      safeSet((state: any) => ({
        blocks: {
          ...state.blocks,
          [id]: {
            ...state.blocks[id],
            isWide: !state.blocks[id].isWide,
          },
        },
        edges: [...state.edges],
        loops: { ...get().loops },
      }))
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    updateBlockHeight: (id: string, height: number) => {
      safeSet((state: any) => ({
        blocks: {
          ...state.blocks,
          [id]: {
            ...state.blocks[id],
            height,
          },
        },
        edges: [...state.edges],
      }))
      get().updateLastSaved()
    },

    toggleBlockMinimized: (id: string) => {
      safeSet((state: any) => ({
        blocks: {
          ...state.blocks,
          [id]: {
            ...state.blocks[id],
            isMinimized: !state.blocks[id].isMinimized,
          },
        },
        edges: [...state.edges],
        loops: { ...get().loops },
      }))
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    toggleBlockNodeStyle: (id: string) => {
      safeSet((state: any) => {
        const currentStyle = state.blocks[id]?.nodeStyle || 'default'
        const newStyle = currentStyle === 'default' ? 'hero' : 'default'
        return {
          blocks: {
            ...state.blocks,
            [id]: {
              ...state.blocks[id],
              nodeStyle: newStyle,
            },
          },
          edges: [...state.edges],
          loops: { ...get().loops },
        }
      })
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    toggleBlockBookmark: (blockId: string) => {
      safeSet((state: any) => ({
        blocks: {
          ...state.blocks,
          [blockId]: {
            ...state.blocks[blockId],
            bookmarked: !state.blocks[blockId]?.bookmarked,
          },
        },
      }))
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    resetBlock: (blockId: string) => {
      let resetSubBlocks: Record<string, SubBlockState> | null = null
      safeSet((state: any) => {
        const block = state.blocks[blockId]
        if (!block) return state
        const blockConfig = getBlock(block.type)
        resetSubBlocks = blockConfig ? createSubBlocksFromConfig(blockConfig) : {}
        const resetOutputs = blockConfig
          ? resolveOutputType(blockConfig.outputs, resetSubBlocks)
          : {}

        const resetBlock = {
          ...block,
          subBlocks: resetSubBlocks,
          outputs: resetOutputs,
          enabled: true,
          isWide: false,
          height: undefined,
          isMinimized: false,
          bookmarked: false,
        }

        return {
          blocks: {
            ...state.blocks,
            [blockId]: resetBlock,
          },
        }
      })
      if (resetSubBlocks) {
        seedSubBlockStore(blockId, resetSubBlocks, {}, { preserveExisting: false })
      }
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },
  }
}
