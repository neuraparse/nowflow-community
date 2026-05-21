/**
 * React Flow node and edge type definitions
 *
 * IMPORTANT: This file uses a singleton pattern to ensure stable references
 * across HMR (Hot Module Replacement) updates in development.
 *
 * The singleton pattern prevents React Flow from detecting "new" objects
 * on every HMR update, which would trigger performance warnings.
 */
import type { EdgeTypes, NodeTypes } from '@xyflow/react'
import { HeroStyleBlock } from '@/app/w/[id]/components/workflow-block/components/hero-style-block/hero-style-block'
import { ExecutionEdge } from '@/app/w/[id]/components/workflow-edge/execution-edge'
import { HeroEdge } from '@/app/w/[id]/components/workflow-edge/hero-edge'
import { WorkflowEdge } from '@/app/w/[id]/components/workflow-edge/workflow-edge'
import { GroupZone } from '@/app/w/[id]/components/workflow-group/group-zone'
import { LoopInput } from '@/app/w/[id]/components/workflow-loop/components/loop-input/loop-input'
import { LoopLabel } from '@/app/w/[id]/components/workflow-loop/components/loop-label/loop-label'

// Global cache key for storing types across HMR updates
const GLOBAL_CACHE_KEY = '__REACT_FLOW_TYPES_CACHE__'

// Extend window interface for TypeScript
declare global {
  interface Window {
    [GLOBAL_CACHE_KEY]?: {
      nodeTypes: NodeTypes
      edgeTypes: EdgeTypes
    }
  }
}

/**
 * Get node types with global singleton pattern
 * Uses window object to maintain stable references across HMR updates
 *
 * IMPORTANT: We also cache component references to prevent HMR from
 * updating them, which would trigger React Flow warnings
 */
export function getNodeTypes(): NodeTypes {
  // Initialize global cache if needed OR if components have changed (HMR)
  if (typeof window !== 'undefined') {
    const currentCache = window[GLOBAL_CACHE_KEY]

    // Check if we need to update component references (HMR scenario)
    const needsUpdate =
      !currentCache ||
      currentCache.nodeTypes.heroStyleBlock !== HeroStyleBlock ||
      currentCache.nodeTypes.groupZone !== GroupZone ||
      currentCache.nodeTypes.loopLabel !== LoopLabel ||
      currentCache.nodeTypes.loopInput !== LoopInput

    if (needsUpdate) {
      // Update the cache with new component references
      window[GLOBAL_CACHE_KEY] = {
        nodeTypes: Object.freeze<NodeTypes>({
          heroStyleBlock: HeroStyleBlock,
          groupZone: GroupZone,
          loopLabel: LoopLabel,
          loopInput: LoopInput,
        }),
        edgeTypes: Object.freeze<EdgeTypes>({
          workflowEdge: WorkflowEdge,
          heroEdge: HeroEdge,
          executionEdge: ExecutionEdge,
        }),
      }
    }
  }

  return typeof window !== 'undefined'
    ? window[GLOBAL_CACHE_KEY]!.nodeTypes
    : Object.freeze<NodeTypes>({
        heroStyleBlock: HeroStyleBlock,
        groupZone: GroupZone,
        loopLabel: LoopLabel,
        loopInput: LoopInput,
      })
}

/**
 * Get edge types with global singleton pattern
 * Uses window object to maintain stable references across HMR updates
 */
export function getEdgeTypes(): EdgeTypes {
  // Ensure cache is initialized
  if (typeof window !== 'undefined' && !window[GLOBAL_CACHE_KEY]) {
    getNodeTypes() // This will initialize the cache
  }

  return typeof window !== 'undefined'
    ? window[GLOBAL_CACHE_KEY]!.edgeTypes
    : Object.freeze<EdgeTypes>({
        workflowEdge: WorkflowEdge,
        heroEdge: HeroEdge,
        executionEdge: ExecutionEdge,
      })
}

/**
 * Legacy exports for backward compatibility
 * @deprecated Use getNodeTypes() and getEdgeTypes() instead
 */
export const NODE_TYPES = getNodeTypes()
export const EDGE_TYPES = getEdgeTypes()
