import { useCallback, useEffect, useRef } from 'react'
import isEqual from 'lodash/isEqual'
import { useGeneralStore } from '@/stores/settings/general/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getProviderFromModel } from '@/providers/utils'

/**
 * Helper to handle API key auto-fill for provider-based blocks
 * Used for agent, router, evaluator, and any other blocks that use LLM providers
 */
function handleProviderBasedApiKey(
  blockId: string,
  subBlockId: string,
  modelValue: string | null | undefined,
  storeValue: any
) {
  // Only proceed if we have a model selected
  if (!modelValue) return

  // Get the provider for this model
  const provider = getProviderFromModel(modelValue)

  // Skip if we couldn't determine a provider or if it's Ollama (no API key needed)
  if (!provider || provider === 'ollama') return

  const subBlockStore = useSubBlockStore.getState()

  // Try to get a saved API key for this provider
  const savedValue = subBlockStore.resolveToolParamValue(provider, 'apiKey', blockId)
  const currentValue = subBlockStore.getValue(blockId, subBlockId)

  // If we have a valid API key, use it — but only if it differs from current value.
  // Writing the same value triggers the subblock store subscription → live-validation cascade
  // which resolves the apiKey warning (making warnings disappear on sidebar open).
  if (savedValue && savedValue !== '' && savedValue !== currentValue) {
    subBlockStore.setValue(blockId, subBlockId, savedValue)
  }
  // CRITICAL FIX: Don't clear the field if no saved key found
  // Preserve existing API keys that user has entered
  // Only clear when user explicitly changes the model (handled in model change useEffect)
}

/**
 * Helper to handle API key auto-fill for non-agent blocks
 */
function handleStandardBlockApiKey(
  blockId: string,
  subBlockId: string,
  blockType: string | undefined,
  storeValue: any
) {
  if (!blockType) return

  const subBlockStore = useSubBlockStore.getState()

  // Only auto-fill if the field is empty
  if (!storeValue || storeValue === '') {
    // Pass the blockId as instanceId to check if this specific instance has been cleared
    const savedValue = subBlockStore.resolveToolParamValue(blockType, 'apiKey', blockId)

    if (savedValue && savedValue !== '' && savedValue !== storeValue) {
      // Auto-fill the API key from the param store
      subBlockStore.setValue(blockId, subBlockId, savedValue)
    }
  }
  // Handle environment variable references
  else if (
    storeValue &&
    typeof storeValue === 'string' &&
    storeValue.startsWith('{{') &&
    storeValue.endsWith('}}')
  ) {
    // Pass the blockId as instanceId
    const currentValue = subBlockStore.resolveToolParamValue(blockType, 'apiKey', blockId)

    if (currentValue !== storeValue) {
      // If we got a replacement or null, update the field
      if (currentValue) {
        // Replacement found - update to new reference
        subBlockStore.setValue(blockId, subBlockId, currentValue)
      }
    }
  }
}

/**
 * Helper to store API key values
 */
function storeApiKeyValue(
  blockId: string,
  blockType: string | undefined,
  modelValue: string | null | undefined,
  newValue: any,
  storeValue: any
) {
  if (!blockType) return

  const subBlockStore = useSubBlockStore.getState()

  // Check if this is user explicitly clearing a field that had a value
  // We only want to mark it as cleared if it's a user action, not an automatic
  // clearing from model switching
  if (
    storeValue &&
    storeValue !== '' &&
    (newValue === null || newValue === '' || String(newValue).trim() === '')
  ) {
    // Mark this specific instance as cleared so we don't auto-fill it
    subBlockStore.markParamAsCleared(blockId, 'apiKey')
    return
  }

  // Only store non-empty values
  if (!newValue || String(newValue).trim() === '') return

  // If user enters a value, we should clear any "cleared" flag
  // to ensure auto-fill will work in the future
  if (subBlockStore.isParamCleared(blockId, 'apiKey')) {
    subBlockStore.unmarkParamAsCleared(blockId, 'apiKey')
  }

  // For provider-based blocks, store the API key under the provider name
  if (
    (blockType === 'agent' || blockType === 'router' || blockType === 'evaluator') &&
    modelValue
  ) {
    const provider = getProviderFromModel(modelValue)
    if (provider && provider !== 'ollama') {
      subBlockStore.setToolParam(provider, 'apiKey', String(newValue))
    }
  } else {
    // For other blocks, store under the block type
    subBlockStore.setToolParam(blockType, 'apiKey', String(newValue))
  }
}

/**
 * Custom hook to get and set values for a sub-block in a workflow.
 * Handles complex object values properly by using deep equality comparison.
 *
 * @param blockId The ID of the block containing the sub-block
 * @param subBlockId The ID of the sub-block
 * @param triggerWorkflowUpdate Whether to trigger a workflow update when the value changes
 * @returns A tuple containing the current value and a setter function
 */
export function useSubBlockValue<T = any>(
  blockId: string,
  subBlockId: string,
  triggerWorkflowUpdate: boolean = false
): readonly [T | null, (value: T) => void] {
  const blockType = useWorkflowStore(
    useCallback((state) => state.blocks?.[blockId]?.type, [blockId])
  )

  const initialValue = useWorkflowStore(
    useCallback(
      (state) => state.blocks?.[blockId]?.subBlocks?.[subBlockId]?.value ?? null,
      [blockId, subBlockId]
    )
  )

  // Keep a ref to the latest value to prevent unnecessary re-renders
  const valueRef = useRef<T | null>(null)

  // Previous model reference for detecting model changes
  const prevModelRef = useRef<string | null>(null)

  // Get value from subblock store - always call this hook unconditionally
  // This will cause re-renders when the value changes
  const storeValue = useSubBlockStore(
    useCallback((state) => state.getValue(blockId, subBlockId), [blockId, subBlockId])
  )

  // Use storeValue directly instead of valueRef for reactive updates
  const currentValue = storeValue !== undefined && storeValue !== null ? storeValue : initialValue

  // Check if this is an API key field that could be auto-filled
  const isApiKey =
    subBlockId === 'apiKey' || (subBlockId?.toLowerCase().includes('apikey') ?? false)

  // Check if auto-fill environment variables is enabled - always call this hook unconditionally
  const isAutoFillEnvVarsEnabled = useGeneralStore((state) => state.isAutoFillEnvVarsEnabled)

  // Always call this hook unconditionally - don't wrap it in a condition
  const modelSubBlockValue = useSubBlockStore((state) =>
    blockId ? state.getValue(blockId, 'model') : null
  )

  // Determine if this is a provider-based block type
  const isProviderBasedBlock =
    blockType === 'agent' || blockType === 'router' || blockType === 'evaluator'

  // Compute the modelValue based on block type
  const modelValue = isProviderBasedBlock ? (modelSubBlockValue as string) : null

  // Use a ref to access storeValue without adding it to setValue dependencies.
  // This prevents setValue from being recreated on every keystroke.
  const storeValueRef = useRef(storeValue)
  storeValueRef.current = storeValue

  // Hook to set a value in the subblock store
  const setValue = useCallback(
    (newValue: T) => {
      // Fast path for primitives (strings, numbers, booleans) - avoid lodash overhead
      const hasChanged =
        typeof newValue === 'object' && newValue !== null
          ? !isEqual(valueRef.current, newValue)
          : valueRef.current !== newValue

      if (hasChanged) {
        valueRef.current = newValue

        // Deep clone only for objects to prevent mutation; primitives are passed as-is
        const valueCopy =
          newValue === null
            ? null
            : typeof newValue === 'object'
              ? JSON.parse(JSON.stringify(newValue))
              : newValue

        // Handle API key storage for reuse across blocks
        if (isApiKey && blockType) {
          storeApiKeyValue(blockId, blockType, modelValue, newValue, storeValueRef.current)
        }

        // Update the subblock store with the new value
        // The store's setValue method will now trigger the debounced sync automatically
        useSubBlockStore.getState().setValue(blockId, subBlockId, valueCopy)

        if (triggerWorkflowUpdate) {
          useWorkflowStore.getState().triggerUpdate()
        }
      }
    },
    [blockId, subBlockId, blockType, isApiKey, triggerWorkflowUpdate, modelValue]
  )

  // Initialize valueRef on first render
  useEffect(() => {
    valueRef.current = storeValue !== undefined ? storeValue : initialValue
  }, [])

  // Auto-fill API key from saved toolParams whenever relevant dependencies change.
  // Cascade prevention is handled inside handleProviderBasedApiKey via the
  // `savedValue !== currentValue` check — setValue is only called when the value
  // genuinely differs, so no spurious subblock-store updates for existing blocks.
  useEffect(() => {
    // Only process API key fields
    if (!isApiKey) return

    // Skip if auto-fill is disabled AND we already have a value
    // This prevents overwriting existing values when auto-fill is off
    if (!isAutoFillEnvVarsEnabled && storeValue && storeValue !== '') return

    // Handle different block types
    if (isProviderBasedBlock) {
      handleProviderBasedApiKey(blockId, subBlockId, modelValue, storeValue)
    } else {
      // Normal handling for non-provider blocks
      handleStandardBlockApiKey(blockId, subBlockId, blockType, storeValue)
    }
  }, [
    blockId,
    subBlockId,
    blockType,
    storeValue,
    isApiKey,
    isAutoFillEnvVarsEnabled,
    modelValue,
    isProviderBasedBlock,
  ])

  // Monitor for model changes in provider-based blocks
  useEffect(() => {
    // Only process API key fields in model-based blocks
    if (!isApiKey || !isProviderBasedBlock) return

    // Check if the model has changed
    if (modelValue !== prevModelRef.current) {
      // CRITICAL FIX: Skip if this is the initial load (prevModelRef is undefined/null)
      // Only process model changes when user actively switches models
      const isInitialLoad = prevModelRef.current === undefined || prevModelRef.current === null

      // Update the previous model reference
      prevModelRef.current = modelValue

      // Skip auto-clear on initial load to preserve saved API keys
      if (isInitialLoad) {
        return
      }

      // For provider-based blocks, try to auto-fill from saved values
      // Only clear if user explicitly switches to a different model without saved key
      if (modelValue) {
        const provider = getProviderFromModel(modelValue)

        // Skip if we couldn't determine a provider
        if (!provider || provider === 'ollama') return

        const subBlockStore = useSubBlockStore.getState()

        // Check if there's a saved value for this provider
        const savedValue = subBlockStore.resolveToolParamValue(provider, 'apiKey', blockId)

        if (savedValue && savedValue !== '' && isAutoFillEnvVarsEnabled) {
          // Auto-fill only if the value has actually changed
          const currentValue = subBlockStore.getValue(blockId, subBlockId)
          if (savedValue !== currentValue) {
            subBlockStore.setValue(blockId, subBlockId, savedValue)
          }
        } else {
          // CRITICAL FIX: Only clear if there's no current value in store
          // This preserves API keys even when auto-fill is disabled
          const currentValue = subBlockStore.getValue(blockId, subBlockId)
          if (!currentValue || currentValue === '') {
            // Only clear empty fields when switching models
            subBlockStore.setValue(blockId, subBlockId, '')
          }
          // If currentValue exists, keep it (don't clear saved API keys)
        }
      }
    }
  }, [
    blockId,
    subBlockId,
    blockType,
    isApiKey,
    modelValue,
    isAutoFillEnvVarsEnabled,
    storeValue,
    isProviderBasedBlock,
  ])

  // Update the ref if the store value changes
  // This ensures we're always working with the latest value
  useEffect(() => {
    // Use deep comparison for objects to prevent unnecessary updates
    if (!isEqual(valueRef.current, storeValue)) {
      valueRef.current = storeValue !== undefined ? storeValue : initialValue
    }
  }, [storeValue, initialValue])

  // Return currentValue (which is reactive) instead of valueRef.current
  return [currentValue as T | null, setValue] as const
}
