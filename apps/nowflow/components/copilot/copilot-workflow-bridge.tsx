'use client'

import { useEffect } from 'react'
import { useValidationStore } from '@/stores/validation/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { useCopilot } from './copilot-provider'

/**
 * Bridge component that syncs workflow state to the copilot context.
 * Mount this inside the workflow editor layout to enable workflow-aware copilot.
 *
 * Sends blocks, edges, sub-block values, and validation errors so the AI copilot
 * has full knowledge of the current workflow configuration and any issues.
 */
export function CopilotWorkflowBridge() {
  const { setWorkflowContext } = useCopilot()
  const blocks = useWorkflowStore((s) => s.blocks)
  const edges = useWorkflowStore((s) => s.edges)
  const workflowValues = useSubBlockStore((s) => s.workflowValues)
  const activeWorkflowId = useWorkflowRegistry((s) => s.activeWorkflowId)
  const blockValidations = useValidationStore((s) => s.blockValidations)

  useEffect(() => {
    const subBlockValues = activeWorkflowId ? workflowValues[activeWorkflowId] || {} : {}

    // Only pass blocks with actual errors/warnings to avoid sending unnecessary data
    const validationErrors = Object.fromEntries(
      Object.entries(blockValidations)
        .filter(([, r]) => r.errors && r.errors.length > 0)
        .map(([id, r]) => [id, r.errors])
    )
    const validationWarnings = Object.fromEntries(
      Object.entries(blockValidations)
        .filter(([, r]) => r.warnings && r.warnings.length > 0)
        .map(([id, r]) => [id, r.warnings])
    )

    setWorkflowContext({
      blocks: blocks || {},
      edges: edges || [],
      subBlockValues,
      ...(Object.keys(validationErrors).length > 0 ? { validationErrors } : {}),
      ...(Object.keys(validationWarnings).length > 0 ? { validationWarnings } : {}),
    })
    return () => setWorkflowContext(null)
  }, [blocks, edges, workflowValues, activeWorkflowId, blockValidations, setWorkflowContext])

  return null
}
