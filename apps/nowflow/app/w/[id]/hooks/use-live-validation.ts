import { useEffect, useRef } from 'react'
import { validateAllBlocks } from '@/lib/workflows/pre-run-validation'
import { useGeneralStore } from '@/stores/settings/general/store'
import { useValidationStore } from '@/stores/validation/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { mergeSubblockState } from '@/stores/workflows/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

// Module-level timer ref for cancellation from outside
let globalTimerRef: ReturnType<typeof setTimeout> | null = null

/**
 * Cancel any pending live validation.
 * Used to prevent race conditions when pre-run validation executes.
 */
export function cancelPendingValidation() {
  if (globalTimerRef) {
    clearTimeout(globalTimerRef)
    globalTimerRef = null
  }
}

/**
 * Live validation: validates all blocks in the background
 * whenever blocks or subblock values change. Debounced to
 * avoid hammering validation on every keystroke.
 */
export function useLiveValidation() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const runValidation = () => {
      if (!useGeneralStore.getState().isLiveValidationEnabled) return

      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
      if (!activeWorkflowId) return

      const blocks = useWorkflowStore.getState().blocks
      if (Object.keys(blocks).length === 0) return

      const mergedStates = mergeSubblockState(blocks, activeWorkflowId)

      // Guard: if mergedStates is empty despite having blocks, something went wrong
      // (e.g., SSE update cleared workflowStore mid-validation). Don't overwrite validation state.
      if (Object.keys(mergedStates).length === 0) return

      const results = validateAllBlocks(mergedStates)

      // Always push results — the store itself skips the update if nothing changed.
      // This ensures warnings are always correctly regenerated (e.g., after clearing a field).
      useValidationStore.getState().setResults(results)
    }

    const scheduleValidation = () => {
      if (!useGeneralStore.getState().isLiveValidationEnabled) return

      if (timerRef.current) clearTimeout(timerRef.current)
      if (globalTimerRef) clearTimeout(globalTimerRef)

      const timer = setTimeout(() => runValidation(), 200)
      timerRef.current = timer
      globalTimerRef = timer
    }

    // Track block count to detect additions/removals
    let prevBlockCount = Object.keys(useWorkflowStore.getState().blocks).length
    // Track workflowValues reference for cheap change detection (no JSON.stringify)
    let prevWorkflowValues = useSubBlockStore.getState().workflowValues

    // Subscribe to workflow store (block additions/removals)
    const unsubWorkflow = useWorkflowStore.subscribe((state) => {
      const count = Object.keys(state.blocks).length
      if (count !== prevBlockCount) {
        if (count > prevBlockCount) {
          runValidation()
        } else {
          scheduleValidation()
        }
        prevBlockCount = count
      }
    })

    // Subscribe to subblock store (value changes)
    // Uses reference comparison instead of JSON.stringify for performance
    const unsubSubBlock = useSubBlockStore.subscribe((state) => {
      if (state.workflowValues === prevWorkflowValues) return

      // Detect if any field was CLEARED (non-empty → empty).
      // Only check the active workflow's changed blocks for efficiency.
      let fieldCleared = false
      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
      if (activeWorkflowId) {
        const prev = prevWorkflowValues[activeWorkflowId]
        const curr = state.workflowValues[activeWorkflowId]
        if (prev && curr && prev !== curr) {
          outer: for (const blockId of Object.keys(curr)) {
            if (prev[blockId] === curr[blockId]) continue
            for (const subBlockId of Object.keys(curr[blockId] || {})) {
              const newVal = curr[blockId][subBlockId]
              const oldVal = prev[blockId]?.[subBlockId]
              if (oldVal && oldVal !== '' && (!newVal || newVal === '')) {
                fieldCleared = true
                break outer
              }
            }
          }
        }
      }

      prevWorkflowValues = state.workflowValues

      if (fieldCleared) {
        // Field cleared → run immediately so warning reappears without delay.
        // CRITICAL: Clear any pending debounced timers first — a stale timer
        // (from a previous SSE-triggered scheduleValidation) could fire 200ms later
        // and overwrite the results with an identical or racy snapshot.
        if (timerRef.current) clearTimeout(timerRef.current)
        if (globalTimerRef) clearTimeout(globalTimerRef)
        timerRef.current = null
        globalTimerRef = null

        runValidation()

        // Belt-and-suspenders: schedule a backup validation 300ms later.
        // This catches edge cases where the immediate run is somehow overwritten
        // by a concurrent SSE-triggered store merge before React processes renders.
        const backupTimer = setTimeout(() => runValidation(), 300)
        timerRef.current = backupTimer
        globalTimerRef = backupTimer
      } else {
        scheduleValidation()
      }
    })

    // Run initial validation after mount
    const initTimer = setTimeout(() => runValidation(), 500)

    return () => {
      unsubWorkflow()
      unsubSubBlock()

      const currentTimer = timerRef.current
      const currentGlobalTimer = globalTimerRef
      timerRef.current = null
      globalTimerRef = null

      if (currentTimer) clearTimeout(currentTimer)
      if (currentGlobalTimer) clearTimeout(currentGlobalTimer)
      clearTimeout(initTimer)
    }
  }, [])
}
