import { createLogger } from '@/lib/logs/console-logger'
import { hasRecentLocalChange } from './subblock/store'
import { BlockState, CustomEdge, GroupState, Loop, SubBlockState } from './workflow/types'

const logger = createLogger('ConflictResolution')

export type MergeResult = {
  blocks: Record<string, BlockState>
  edges: CustomEdge[]
  groups: Record<string, GroupState>
  loops: Record<string, Loop>
  conflicts: ConflictInfo[]
}

export type ConflictInfo = {
  type: 'block' | 'edge' | 'group' | 'loop'
  id: string
  resolution: 'local' | 'remote' | 'merged'
  reason: string
}

/**
 * Smart merge strategy for workflow state
 * Uses block-level conflict detection instead of last-write-wins
 */
export function mergeWorkflowStates(
  localBlocks: Record<string, BlockState>,
  localEdges: CustomEdge[],
  localGroups: Record<string, GroupState>,
  localLoops: Record<string, Loop>,
  remoteBlocks: Record<string, BlockState>,
  remoteEdges: CustomEdge[],
  remoteGroups: Record<string, GroupState>,
  remoteLoops: Record<string, Loop>,
  lastUserActionTime: number,
  blockEditTimes?: Record<string, number>,
  localOnlyBlockIds?: Set<string>,
  activeWorkflowId?: string
): MergeResult {
  const conflicts: ConflictInfo[] = []
  const now = Date.now()
  const RECENT_EDIT_WINDOW = 3000 // 3 seconds - only very recent edits win (active editing)

  // 1. BLOCK MERGE: Block-level conflict detection
  const mergedBlocks: Record<string, BlockState> = {}

  // Get all unique block IDs
  const allBlockIds = new Set([...Object.keys(localBlocks), ...Object.keys(remoteBlocks)])

  for (const blockId of allBlockIds) {
    const localBlock = localBlocks[blockId]
    const remoteBlock = remoteBlocks[blockId]

    // Check if user recently edited this specific block
    const blockLastEdit = blockEditTimes?.[blockId] ?? lastUserActionTime
    const timeSinceLastEdit = now - blockLastEdit
    const wasRecentlyEdited = timeSinceLastEdit < RECENT_EDIT_WINDOW

    // Case 1: Block only exists locally (could be new OR remotely deleted)
    if (localBlock && !remoteBlock) {
      // Always keep locally-created blocks that haven't been confirmed by server
      // If user recently edited, keep local (new block)
      // Otherwise, assume it was deleted remotely
      if (localOnlyBlockIds?.has(blockId) || wasRecentlyEdited) {
        mergedBlocks[blockId] = localBlock
        conflicts.push({
          type: 'block',
          id: blockId,
          resolution: 'local',
          reason: `Block only exists locally (new, edited ${timeSinceLastEdit}ms ago)`,
        })
      } else {
        // Don't add to merged blocks - accept remote deletion
        conflicts.push({
          type: 'block',
          id: blockId,
          resolution: 'remote',
          reason: `Block deleted remotely (last local edit ${timeSinceLastEdit}ms ago)`,
        })
      }
      continue
    }

    // Case 2: Block only exists remotely (could be new OR locally deleted)
    if (!localBlock && remoteBlock) {
      // If user recently edited, assume local deletion
      // Otherwise, accept new remote block
      if (wasRecentlyEdited) {
        // Don't add to merged blocks - keep local deletion
        conflicts.push({
          type: 'block',
          id: blockId,
          resolution: 'local',
          reason: `Block deleted locally (edited ${timeSinceLastEdit}ms ago)`,
        })
      } else {
        mergedBlocks[blockId] = remoteBlock
        conflicts.push({
          type: 'block',
          id: blockId,
          resolution: 'remote',
          reason: `Block only exists remotely (new from other device)`,
        })
      }
      continue
    }

    // Case 3: Block exists in both - sub-block-level merge
    if (localBlock && remoteBlock) {
      // Per-block edit time already computed above

      // Compare block-level properties (position, name, enabled, minimized)
      const positionChanged =
        localBlock.position.x !== remoteBlock.position.x ||
        localBlock.position.y !== remoteBlock.position.y
      const nameChanged = localBlock.name !== remoteBlock.name
      const enabledChanged = localBlock.enabled !== remoteBlock.enabled
      const minimizedChanged = localBlock.isMinimized !== remoteBlock.isMinimized

      // Resolve block-level properties: use local if recently edited, else remote
      const blockLevelBase =
        positionChanged || nameChanged || enabledChanged || minimizedChanged
          ? wasRecentlyEdited
            ? localBlock
            : remoteBlock
          : localBlock

      // Sub-block-level merge: merge each sub-block individually
      const localSubBlocks = localBlock.subBlocks || {}
      const remoteSubBlocks = remoteBlock.subBlocks || {}
      const allSubBlockIds = new Set([
        ...Object.keys(localSubBlocks),
        ...Object.keys(remoteSubBlocks),
      ])
      const mergedSubBlocks: Record<string, SubBlockState> = {}
      let hasSubBlockConflict = false

      for (const subBlockId of allSubBlockIds) {
        const localSub = localSubBlocks[subBlockId]
        const remoteSub = remoteSubBlocks[subBlockId]

        if (localSub && !remoteSub) {
          // Sub-block only exists locally (new or remotely removed)
          mergedSubBlocks[subBlockId] = localSub
          continue
        }

        if (!localSub && remoteSub) {
          // Sub-block only exists remotely (new from remote)
          mergedSubBlocks[subBlockId] = remoteSub
          continue
        }

        if (localSub && remoteSub) {
          // Both have this sub-block - compare values
          const valuesMatch = JSON.stringify(localSub.value) === JSON.stringify(remoteSub.value)

          if (valuesMatch) {
            // No conflict - use local (identical)
            mergedSubBlocks[subBlockId] = localSub
          } else {
            hasSubBlockConflict = true
            // Check if this specific sub-block was recently edited locally
            const subBlockRecentlyEdited = activeWorkflowId
              ? hasRecentLocalChange(activeWorkflowId, blockId, subBlockId)
              : wasRecentlyEdited

            if (subBlockRecentlyEdited) {
              // User is actively editing this sub-block - keep local value
              mergedSubBlocks[subBlockId] = localSub
            } else {
              // No recent local edit - accept remote value
              mergedSubBlocks[subBlockId] = remoteSub
            }
          }
        }
      }

      // Build merged block: use block-level base for properties, merged sub-blocks for values
      mergedBlocks[blockId] = {
        ...blockLevelBase,
        subBlocks: mergedSubBlocks,
      }

      if (
        positionChanged ||
        nameChanged ||
        enabledChanged ||
        minimizedChanged ||
        hasSubBlockConflict
      ) {
        conflicts.push({
          type: 'block',
          id: blockId,
          resolution: hasSubBlockConflict ? 'merged' : wasRecentlyEdited ? 'local' : 'remote',
          reason: hasSubBlockConflict
            ? `Block sub-blocks merged individually (block props: ${wasRecentlyEdited ? 'local' : 'remote'})`
            : wasRecentlyEdited
              ? `Block modified locally within ${timeSinceLastEdit}ms`
              : `Block modified remotely, local edit was ${timeSinceLastEdit}ms ago`,
        })
      }
    }
  }

  // 2. EDGE MERGE: Simple set-based merge with timestamp-aware deletion handling
  const mergedEdges = mergeEdges(
    localEdges,
    remoteEdges,
    conflicts,
    lastUserActionTime,
    blockEditTimes
  )

  // 3. GROUP MERGE: Similar to blocks
  const mergedGroups = mergeGroups(localGroups, remoteGroups, conflicts, lastUserActionTime)

  // 4. LOOP MERGE: Similar to groups
  const mergedLoops = mergeLoops(localLoops, remoteLoops, conflicts, lastUserActionTime)

  logger.info(`🔀 Merge complete: ${conflicts.length} conflicts resolved`, {
    local: conflicts.filter((c) => c.resolution === 'local').length,
    remote: conflicts.filter((c) => c.resolution === 'remote').length,
    merged: conflicts.filter((c) => c.resolution === 'merged').length,
  })

  return {
    blocks: mergedBlocks,
    edges: mergedEdges,
    groups: mergedGroups,
    loops: mergedLoops,
    conflicts,
  }
}

function mergeEdges(
  localEdges: CustomEdge[],
  remoteEdges: CustomEdge[],
  conflicts: ConflictInfo[],
  lastUserActionTime: number = 0,
  blockEditTimes?: Record<string, number>
): CustomEdge[] {
  const edgeMap = new Map<string, CustomEdge>()
  const remoteEdgeIds = new Set(remoteEdges.map((e) => e.id))

  const now = Date.now()
  const RECENT_EDIT_WINDOW = 3000 // 3 seconds
  const timeSinceLastEdit = now - lastUserActionTime
  const wasRecentlyEdited = timeSinceLastEdit < RECENT_EDIT_WINDOW

  // Add all local edges (but check if remotely deleted)
  for (const edge of localEdges) {
    // If local edge doesn't exist in remote
    if (!remoteEdgeIds.has(edge.id)) {
      // If user recently edited, keep local (new edge)
      // Otherwise, assume it was deleted remotely
      if (wasRecentlyEdited) {
        edgeMap.set(edge.id, edge)
        conflicts.push({
          type: 'edge',
          id: edge.id,
          resolution: 'local',
          reason: `New edge from local (edited ${timeSinceLastEdit}ms ago)`,
        })
      } else {
        // Don't add to map - accept remote deletion
        conflicts.push({
          type: 'edge',
          id: edge.id,
          resolution: 'remote',
          reason: `Edge deleted remotely (last local edit ${timeSinceLastEdit}ms ago)`,
        })
      }
    } else {
      // Edge exists in both - add to map for now
      edgeMap.set(edge.id, edge)
    }
  }

  // Add/update remote edges
  for (const edge of remoteEdges) {
    if (edgeMap.has(edge.id)) {
      // Edge exists in both - check if different
      const localEdge = edgeMap.get(edge.id)!
      if (JSON.stringify(localEdge) !== JSON.stringify(edge)) {
        // Use remote version (edges are simple, no complex merge needed)
        if (wasRecentlyEdited) {
          // Keep local version
          conflicts.push({
            type: 'edge',
            id: edge.id,
            resolution: 'local',
            reason: `Edge modified locally (edited ${timeSinceLastEdit}ms ago)`,
          })
        } else {
          // Use remote version
          conflicts.push({
            type: 'edge',
            id: edge.id,
            resolution: 'remote',
            reason: `Edge modified remotely (last local edit ${timeSinceLastEdit}ms ago)`,
          })
          edgeMap.set(edge.id, edge)
        }
      }
      // If identical, keep local (already in map)
    } else {
      // Edge only exists remotely
      // Only treat as locally deleted if one of its connected nodes was recently edited
      const sourceLastEdit = blockEditTimes?.[edge.source] ?? lastUserActionTime
      const targetLastEdit = blockEditTimes?.[edge.target] ?? lastUserActionTime
      const connectedNodeRecentlyEdited =
        now - sourceLastEdit < RECENT_EDIT_WINDOW || now - targetLastEdit < RECENT_EDIT_WINDOW
      if (wasRecentlyEdited && connectedNodeRecentlyEdited) {
        // Connected node was recently edited - assume local deletion
        conflicts.push({
          type: 'edge',
          id: edge.id,
          resolution: 'local',
          reason: `Edge deleted locally (connected node edited recently)`,
        })
        // Don't add to map - keep local deletion
      } else {
        // Accept new remote edge
        conflicts.push({
          type: 'edge',
          id: edge.id,
          resolution: 'remote',
          reason: 'New edge from remote',
        })
        edgeMap.set(edge.id, edge)
      }
    }
  }

  return Array.from(edgeMap.values())
}

function mergeGroups(
  localGroups: Record<string, GroupState>,
  remoteGroups: Record<string, GroupState>,
  conflicts: ConflictInfo[],
  lastUserActionTime: number = 0
): Record<string, GroupState> {
  const now = Date.now()
  const RECENT_EDIT_WINDOW = 3000 // 3 seconds
  const timeSinceLastEdit = now - lastUserActionTime
  const wasRecentlyEdited = timeSinceLastEdit < RECENT_EDIT_WINDOW

  const mergedGroups: Record<string, GroupState> = {}
  const allGroupIds = new Set([...Object.keys(localGroups), ...Object.keys(remoteGroups)])

  for (const groupId of allGroupIds) {
    const localGroup = localGroups[groupId]
    const remoteGroup = remoteGroups[groupId]

    // Case 1: Group only exists locally (could be new OR remotely deleted)
    if (localGroup && !remoteGroup) {
      if (wasRecentlyEdited) {
        mergedGroups[groupId] = localGroup
        conflicts.push({
          type: 'group',
          id: groupId,
          resolution: 'local',
          reason: `New group from local (edited ${timeSinceLastEdit}ms ago)`,
        })
      } else {
        // Don't add - accept remote deletion
        conflicts.push({
          type: 'group',
          id: groupId,
          resolution: 'remote',
          reason: `Group deleted remotely (last local edit ${timeSinceLastEdit}ms ago)`,
        })
      }
      continue
    }

    // Case 2: Group only exists remotely (could be new OR locally deleted)
    if (!localGroup && remoteGroup) {
      if (wasRecentlyEdited) {
        // Don't add - keep local deletion
        conflicts.push({
          type: 'group',
          id: groupId,
          resolution: 'local',
          reason: `Group deleted locally (edited ${timeSinceLastEdit}ms ago)`,
        })
      } else {
        mergedGroups[groupId] = remoteGroup
        conflicts.push({
          type: 'group',
          id: groupId,
          resolution: 'remote',
          reason: 'New group from remote',
        })
      }
      continue
    }

    // Case 3: Group exists in both
    if (localGroup && remoteGroup) {
      // Check for differences
      const nameChanged = localGroup.name !== remoteGroup.name
      const colorChanged = localGroup.color !== remoteGroup.color
      const nodesChanged =
        JSON.stringify(localGroup.nodeIds) !== JSON.stringify(remoteGroup.nodeIds)

      if (nameChanged || colorChanged || nodesChanged) {
        if (wasRecentlyEdited) {
          mergedGroups[groupId] = localGroup
          conflicts.push({
            type: 'group',
            id: groupId,
            resolution: 'local',
            reason: `Group modified locally (edited ${timeSinceLastEdit}ms ago)`,
          })
        } else {
          mergedGroups[groupId] = remoteGroup
          conflicts.push({
            type: 'group',
            id: groupId,
            resolution: 'remote',
            reason: `Group modified remotely (last local edit ${timeSinceLastEdit}ms ago)`,
          })
        }
      } else {
        // No conflict - groups are identical
        mergedGroups[groupId] = localGroup
      }
    }
  }

  return mergedGroups
}

function mergeLoops(
  localLoops: Record<string, Loop>,
  remoteLoops: Record<string, Loop>,
  conflicts: ConflictInfo[],
  lastUserActionTime: number = 0
): Record<string, Loop> {
  const now = Date.now()
  const RECENT_EDIT_WINDOW = 3000 // 3 seconds
  const timeSinceLastEdit = now - lastUserActionTime
  const wasRecentlyEdited = timeSinceLastEdit < RECENT_EDIT_WINDOW

  const mergedLoops: Record<string, Loop> = {}
  const allLoopIds = new Set([...Object.keys(localLoops), ...Object.keys(remoteLoops)])

  for (const loopId of allLoopIds) {
    const localLoop = localLoops[loopId]
    const remoteLoop = remoteLoops[loopId]

    // Case 1: Loop only exists locally (could be new OR remotely deleted)
    if (localLoop && !remoteLoop) {
      if (wasRecentlyEdited) {
        mergedLoops[loopId] = localLoop
        conflicts.push({
          type: 'loop',
          id: loopId,
          resolution: 'local',
          reason: `New loop from local (edited ${timeSinceLastEdit}ms ago)`,
        })
      } else {
        // Don't add - accept remote deletion
        conflicts.push({
          type: 'loop',
          id: loopId,
          resolution: 'remote',
          reason: `Loop deleted remotely (last local edit ${timeSinceLastEdit}ms ago)`,
        })
      }
      continue
    }

    // Case 2: Loop only exists remotely (could be new OR locally deleted)
    if (!localLoop && remoteLoop) {
      if (wasRecentlyEdited) {
        // Don't add - keep local deletion
        conflicts.push({
          type: 'loop',
          id: loopId,
          resolution: 'local',
          reason: `Loop deleted locally (edited ${timeSinceLastEdit}ms ago)`,
        })
      } else {
        mergedLoops[loopId] = remoteLoop
        conflicts.push({
          type: 'loop',
          id: loopId,
          resolution: 'remote',
          reason: 'New loop from remote',
        })
      }
      continue
    }

    // Case 3: Loop exists in both
    if (localLoop && remoteLoop) {
      // Check for differences
      const nodesChanged = JSON.stringify(localLoop.nodes) !== JSON.stringify(remoteLoop.nodes)

      if (nodesChanged) {
        if (wasRecentlyEdited) {
          mergedLoops[loopId] = localLoop
          conflicts.push({
            type: 'loop',
            id: loopId,
            resolution: 'local',
            reason: `Loop modified locally (edited ${timeSinceLastEdit}ms ago)`,
          })
        } else {
          mergedLoops[loopId] = remoteLoop
          conflicts.push({
            type: 'loop',
            id: loopId,
            resolution: 'remote',
            reason: `Loop modified remotely (last local edit ${timeSinceLastEdit}ms ago)`,
          })
        }
      } else {
        // No conflict - loops are identical
        mergedLoops[loopId] = localLoop
      }
    }
  }

  return mergedLoops
}
