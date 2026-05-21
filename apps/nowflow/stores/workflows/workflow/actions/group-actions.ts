/**
 * Group management actions slice for the workflow store.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { pushHistory } from '../../middleware'
import { workflowSync } from '../../sync'
import { GroupState } from '../types'

const logger = createLogger('WorkflowStore')

// Modern group color palette
const GROUP_COLORS = [
  '#8B5CF6', // Purple (default)
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#F97316', // Orange
]

export type GroupActionsSliceDeps = {
  safeSet: any
  get: any
}

export function createGroupActionsSlice({ safeSet, get }: GroupActionsSliceDeps) {
  return {
    createGroup: (nodeIds: string[], name?: string, color?: string) => {
      try {
        if (nodeIds.length < 2) {
          logger.debug('Cannot create group with less than 2 nodes')
          return ''
        }

        const blocks = get().blocks
        const groups = get().groups

        const validNodeIds = nodeIds.filter((id: string) => blocks[id])
        if (validNodeIds.length !== nodeIds.length) {
          logger.debug('Some nodes do not exist, filtering invalid nodes')
        }

        if (validNodeIds.length < 2) {
          logger.debug('Not enough valid nodes to create group')
          return ''
        }

        const nodesInGroups = validNodeIds.filter((nodeId: string) =>
          Object.values(groups).some((group: any) => (group as GroupState).nodeIds.includes(nodeId))
        )

        if (nodesInGroups.length > 0) {
          logger.debug('Some nodes are already in groups:', nodesInGroups)
          return ''
        }

        const groupId = crypto.randomUUID()

        const existingColors = Object.values(groups)
          .map((g: any) => (g as GroupState).color)
          .filter(Boolean)
        const nextColorIndex = existingColors.length % GROUP_COLORS.length
        const assignedColor = color || GROUP_COLORS[nextColorIndex]

        const newGroup: GroupState = {
          id: groupId,
          name: name || `Group ${Object.keys(groups).length + 1}`,
          nodeIds: [...validNodeIds],
          color: assignedColor,
          createdAt: Date.now(),
        }

        const newState = {
          blocks: { ...get().blocks },
          edges: [...get().edges],
          loops: { ...get().loops },
          groups: {
            ...get().groups,
            [groupId]: newGroup,
          },
          selectedNodeIds: [],
        }

        safeSet(newState)
        pushHistory(safeSet, get, newState, 'Create group')
        get().updateLastSaved()
        get().markDurableChange()

        logger.info(
          `✅ Group created: ${groupId} with ${validNodeIds.length} nodes - triggering sync`
        )
        workflowSync.syncImmediate()

        return groupId
      } catch (error) {
        console.error('Error creating group:', error)
        return ''
      }
    },

    deleteGroup: (groupId: string) => {
      const group = get().groups[groupId]
      if (!group) return

      const newGroups = { ...get().groups }
      delete newGroups[groupId]

      safeSet({ groups: newGroups })
      pushHistory(safeSet, get, { ...get(), groups: newGroups }, 'Delete group')
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncImmediate()
    },

    updateGroupName: (groupId: string, name: string) => {
      const group = get().groups[groupId]
      if (!group) return

      safeSet({
        groups: {
          ...get().groups,
          [groupId]: { ...group, name },
        },
      })
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    updateGroupColor: (groupId: string, color: string) => {
      const group = get().groups[groupId]
      if (!group) return

      safeSet({
        groups: {
          ...get().groups,
          [groupId]: { ...group, color },
        },
      })
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncUserAction()
    },

    addNodeToGroup: (groupId: string, nodeId: string) => {
      const group = get().groups[groupId]
      if (!group || group.nodeIds.includes(nodeId)) return

      const newGroups = {
        ...get().groups,
        [groupId]: { ...group, nodeIds: [...group.nodeIds, nodeId] },
      }

      safeSet({ groups: newGroups })
      pushHistory(safeSet, get, { ...get(), groups: newGroups }, 'Add node to group')
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    removeNodeFromGroup: (groupId: string, nodeId: string) => {
      const group = get().groups[groupId]
      if (!group) return

      const newNodeIds = group.nodeIds.filter((id: string) => id !== nodeId)

      if (newNodeIds.length <= 1) {
        get().deleteGroup(groupId)
        return
      }

      const newGroups = {
        ...get().groups,
        [groupId]: { ...group, nodeIds: newNodeIds },
      }

      safeSet({ groups: newGroups })
      pushHistory(safeSet, get, { ...get(), groups: newGroups }, 'Remove node from group')
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },
  }
}
