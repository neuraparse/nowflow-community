/**
 * Edge CRUD and styling actions slice for the workflow store.
 */
import { Edge } from '@xyflow/react'
import { createLogger } from '@/lib/logs/console-logger'
import { getBlock } from '@/blocks'
import { calculateLoops } from '../../common/optimizations'
import {
  checkDuplicateEdge,
  getCycleCheckEdges,
  isUtilitySlotEdge,
  validateEdge,
  wouldCreateCycle,
} from '../../common/validators'
import { pushHistory } from '../../middleware'
import { workflowSync } from '../../sync'
import { CustomEdge, EdgeAnimation, EdgeColor, EdgeStyle, EdgeThickness } from '../types'

const logger = createLogger('WorkflowStore')

export type EdgeActionsSliceDeps = {
  safeSet: any
  get: any
}

export function createEdgeActionsSlice({ safeSet, get }: EdgeActionsSliceDeps) {
  return {
    addEdge: (edge: Edge) => {
      const edgeValidation = validateEdge(edge)
      if (!edgeValidation.valid) {
        logger.debug(edgeValidation.error ?? 'Edge validation failed')
        return null
      }

      const duplicateCheck = checkDuplicateEdge(edge, get().edges)
      if (!duplicateCheck.valid) {
        console.debug(`[WorkflowStore] ${duplicateCheck.error}`)
        return null
      }

      const blocks = get().blocks
      const sourceBlock = blocks[edge.source]
      const targetBlock = blocks[edge.target]
      if (!sourceBlock || !targetBlock) {
        logger.debug('Cannot create connection — source or target block is missing')
        return null
      }

      const isUtilityAttachment = isUtilitySlotEdge(edge as any)

      // Prevent backward execution edges (cycles). Utility-slot edges are visual
      // attachments and should not participate in execution graph cycle checks.
      if (
        !isUtilityAttachment &&
        wouldCreateCycle(edge.source, edge.target, getCycleCheckEdges(get().edges))
      ) {
        logger.debug('Cannot create backward connection — would create a cycle')
        return null
      }

      // Utility block connection rules:
      // 1. Utility block OUTPUT → host block: ONLY via utility-source → utility-target
      // 2. Regular block → utility block INPUT: ALLOWED via regular source → target (data feeding)
      // 3. Utility block → regular block via regular source handle: BLOCKED (no regular output)
      if (sourceBlock && targetBlock) {
        const sourceConfig = getBlock(sourceBlock.type)
        const targetConfig = getBlock(targetBlock.type)
        const sourceIsUtility = sourceConfig?.isUtility === true
        const targetIsUtility = targetConfig?.isUtility === true

        // If SOURCE is utility: only allow utility-source → utility-target
        if (sourceIsUtility) {
          const isUtilityHandle =
            edge.sourceHandle === 'utility-source' && edge.targetHandle === 'utility-target'
          if (!isUtilityHandle) {
            logger.debug('Utility block output must use utility-source → utility-target')
            return null
          }
        }

        // If TARGET is utility and source is NOT utility:
        // Allow regular source → target (feeding data into utility block)
        // But block utility-source connections to utility target handle
        if (targetIsUtility && !sourceIsUtility) {
          if (edge.sourceHandle === 'utility-source') {
            logger.debug('Non-utility blocks cannot connect via utility-source')
            return null
          }
        }
      }

      const newEdge = {
        id: edge.id || crypto.randomUUID(),
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: (edge as any).type || 'heroEdge',
        animated: (edge as any).animated || false,
      }

      const newEdges = [...get().edges, newEdge]
      const newLoops = calculateLoops(newEdges, get().loops)

      const newState = {
        blocks: { ...get().blocks },
        edges: newEdges,
        loops: newLoops,
      }

      safeSet(newState)
      pushHistory(safeSet, get, newState, 'Add connection')
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncImmediate()

      return newEdge
    },

    removeEdge: (edgeId: string) => {
      if (!edgeId) {
        logger.debug('Invalid edgeId for removal')
        return
      }

      const newEdges = get().edges.filter((edge: any) => edge.id !== edgeId)
      const newLoops = calculateLoops(newEdges, get().loops)

      const newState = {
        blocks: { ...get().blocks },
        edges: newEdges,
        loops: newLoops,
      }

      safeSet(newState)
      pushHistory(safeSet, get, newState, 'Remove connection')
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncImmediate()
    },

    toggleEdgeStyle: (edgeId: string) => {
      safeSet((state: any) => {
        const updatedEdges = state.edges.map((edge: CustomEdge) => {
          if (edge.id === edgeId) {
            let newStyle: EdgeStyle = 'solid'
            if (edge.edgeStyle === 'solid') newStyle = 'dashed'
            else if (edge.edgeStyle === 'dashed') newStyle = 'dotted'
            else if (edge.edgeStyle === 'dotted') newStyle = 'double'
            else if (edge.edgeStyle === 'double') newStyle = 'wavy'
            else if (edge.edgeStyle === 'wavy') newStyle = 'solid'
            else if (!edge.edgeStyle) newStyle = 'dashed'

            return { ...edge, edgeStyle: newStyle }
          }
          return edge
        })

        return { ...state, edges: updatedEdges }
      })
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateEdgeStyle: (edgeId: string, style: EdgeStyle) => {
      safeSet((state: any) => {
        const updatedEdges = state.edges.map((edge: CustomEdge) => {
          if (edge.id === edgeId) {
            return { ...edge, edgeStyle: style }
          }
          return edge
        })
        return { ...state, edges: updatedEdges }
      })
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateEdgeThickness: (edgeId: string, thickness: EdgeThickness) => {
      safeSet((state: any) => {
        const updatedEdges = state.edges.map((edge: CustomEdge) => {
          if (edge.id === edgeId) {
            return { ...edge, thickness }
          }
          return edge
        })
        return { ...state, edges: updatedEdges }
      })
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateEdgeColor: (edgeId: string, color: EdgeColor) => {
      safeSet((state: any) => {
        const updatedEdges = state.edges.map((edge: CustomEdge) => {
          if (edge.id === edgeId) {
            return { ...edge, color }
          }
          return edge
        })
        return { ...state, edges: updatedEdges }
      })
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateEdgeAnimation: (edgeId: string, animation: EdgeAnimation) => {
      safeSet((state: any) => {
        const updatedEdges = state.edges.map((edge: CustomEdge) => {
          if (edge.id === edgeId) {
            return { ...edge, animation }
          }
          return edge
        })
        return { ...state, edges: updatedEdges }
      })
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateEdgeLabel: (edgeId: string, label: string) => {
      safeSet((state: any) => {
        const updatedEdges = state.edges.map((edge: CustomEdge) => {
          if (edge.id === edgeId) {
            return { ...edge, label }
          }
          return edge
        })
        return { ...state, edges: updatedEdges }
      })
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },
  }
}
