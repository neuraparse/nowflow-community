import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { debouncedSafeStorage } from '@/stores/safe-storage'
import type { SubBlockConfig, SubBlockType } from '@/blocks/types'
import { useEnvironmentStore } from '../../settings/environment/store'
import { useGeneralStore } from '../../settings/general/store'
import { loadSubblockValues, saveSubblockValues } from '../persistence'
import { useWorkflowRegistry } from '../registry/store'
import { workflowSync } from '../sync'
import { SubBlockStore } from './types'
import { extractEnvVarName, findMatchingEnvVar, isEnvVarReference } from './utils'

// Add debounce utility for syncing
let syncDebounceTimer: NodeJS.Timeout | null = null
// CRITICAL FIX: Increased from 100ms to 800ms to prevent sync spam on every keystroke
// User types fast → 100ms was triggering sync for every character
// 800ms ensures sync happens only after user finishes typing
const DEBOUNCE_DELAY = 800 // 800ms delay - wait for user to finish typing before syncing

// Debounce timer for localStorage persistence (separate from DB sync)
let persistDebounceTimer: NodeJS.Timeout | null = null
const PERSIST_DELAY = 500 // 500ms - persist to localStorage after user stops typing

// CRITICAL FIX: Track pending local changes to prevent DB fetch from overwriting user input
// Format: { workflowId: { blockId: { subBlockId: timestamp } } }
// When user types, we mark that field as "dirty" with a timestamp
// During DB fetch, we skip updating fields that have recent local changes
let pendingLocalChanges: Record<string, Record<string, Record<string, number>>> = {}
const LOCAL_CHANGE_PROTECTION_WINDOW = 3000 // 3 seconds - protect local changes for this duration after last edit

/**
 * Mark a subblock value as having local changes
 * This prevents DB fetch from overwriting user input while they're typing
 */
export function markLocalChange(workflowId: string, blockId: string, subBlockId: string): void {
  if (!pendingLocalChanges[workflowId]) {
    pendingLocalChanges[workflowId] = {}
  }
  if (!pendingLocalChanges[workflowId][blockId]) {
    pendingLocalChanges[workflowId][blockId] = {}
  }
  pendingLocalChanges[workflowId][blockId][subBlockId] = Date.now()
}

/**
 * Check if a subblock has recent local changes that should be protected
 */
export function hasRecentLocalChange(
  workflowId: string,
  blockId: string,
  subBlockId: string
): boolean {
  const timestamp = pendingLocalChanges[workflowId]?.[blockId]?.[subBlockId]
  if (!timestamp) return false
  return Date.now() - timestamp < LOCAL_CHANGE_PROTECTION_WINDOW
}

/**
 * Clear local change tracking for a specific field (called after successful sync)
 */
export function clearLocalChange(workflowId: string, blockId: string, subBlockId: string): void {
  if (pendingLocalChanges[workflowId]?.[blockId]) {
    delete pendingLocalChanges[workflowId][blockId][subBlockId]
    if (Object.keys(pendingLocalChanges[workflowId][blockId]).length === 0) {
      delete pendingLocalChanges[workflowId][blockId]
    }
    if (Object.keys(pendingLocalChanges[workflowId]).length === 0) {
      delete pendingLocalChanges[workflowId]
    }
  }
}

/**
 * Clear all local changes for a workflow (called after successful sync)
 */
export function clearAllLocalChanges(workflowId: string): void {
  delete pendingLocalChanges[workflowId]
}

/**
 * Get all pending local changes for a workflow
 * Used by sync to know which fields have unsaved local changes
 */
export function getPendingLocalChanges(
  workflowId: string
): Record<string, Record<string, number>> | undefined {
  return pendingLocalChanges[workflowId]
}

/**
 * SubBlockState stores values for all subblocks in workflows
 *
 * Important implementation notes:
 * 1. Values are stored per workflow, per block, per subblock
 * 2. When workflows are synced to the database, the mergeSubblockState function
 *    in utils.ts combines the block structure with these values
 * 3. If a subblock value exists here but not in the block structure
 *    (e.g., inputFormat in starter block), the merge function will include it
 *    in the synchronized state to ensure persistence
 */

export const useSubBlockStore = create<SubBlockStore>()(
  devtools(
    persist(
      (set, get) => ({
        workflowValues: {},
        // Initialize tool params-related state
        toolParams: {},
        clearedParams: {},

        setValue: (
          blockId: string,
          subBlockId: string,
          value: any,
          options?: { remote?: boolean }
        ) => {
          const isRemote = options?.remote === true
          const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
          if (!activeWorkflowId) {
            console.error(
              '🚨 CRITICAL: SubBlockStore.setValue called with NO active workflow ID!',
              {
                blockId,
                subBlockId,
                value:
                  typeof value === 'string' && value.length > 20
                    ? `${value.substring(0, 20)}...`
                    : value,
                registryState: useWorkflowRegistry.getState(),
              }
            )
            // CRITICAL FIX: Throw error instead of silent return to catch bugs
            throw new Error(
              'Cannot setValue: No active workflow ID. This is a critical bug - data will be lost!'
            )
          }

          // Ensure value is properly serializable (convert null to empty string for persistence)
          const persistableValue = value === null ? '' : value

          // Equality check: if value hasn't changed, skip ALL side-effects.
          // This prevents spurious Zustand subscriber notifications (→ live-validation cascade)
          // that happen when sidebar opens and auto-fill hooks re-write the same values.
          const existingValue = get().workflowValues[activeWorkflowId]?.[blockId]?.[subBlockId]
          if (existingValue !== undefined) {
            const isSame =
              existingValue === persistableValue ||
              (typeof persistableValue === 'object' &&
                persistableValue !== null &&
                JSON.stringify(existingValue) === JSON.stringify(persistableValue))
            if (isSame) return
          }

          set((state) => ({
            workflowValues: {
              ...state.workflowValues,
              [activeWorkflowId]: {
                ...state.workflowValues[activeWorkflowId],
                [blockId]: {
                  ...state.workflowValues[activeWorkflowId]?.[blockId],
                  [subBlockId]: persistableValue,
                },
              },
            },
          }))

          // For remote changes (from collaboration), skip local-change tracking
          // and DB sync — the originating user already persisted the change.
          // Only mark as local and trigger persistence for the user's own edits.
          if (!isRemote) {
            // CRITICAL FIX: Mark this field as having local changes
            // This prevents DB fetch from overwriting user input while they're typing
            markLocalChange(activeWorkflowId, blockId, subBlockId)

            // Debounced persistence: localStorage + workflowStore update
            // These are expensive (JSON.stringify for localStorage, extra Zustand updates for workflowStore)
            // so we batch them instead of running on every keystroke
            if (persistDebounceTimer) {
              clearTimeout(persistDebounceTimer)
            }
            persistDebounceTimer = setTimeout(() => {
              // Update the workflow store's block structure
              const { useWorkflowStore } = require('../workflow/store')
              const workflowStore = useWorkflowStore.getState()
              const block = workflowStore.blocks[blockId]

              if (block && block.subBlocks) {
                const existingSubBlock = block.subBlocks[subBlockId]
                workflowStore.updateBlock(blockId, {
                  ...block,
                  subBlocks: {
                    ...block.subBlocks,
                    [subBlockId]: {
                      ...(existingSubBlock || {
                        id: subBlockId,
                        type: 'short-input' as SubBlockType,
                      }),
                      value: persistableValue,
                    },
                  },
                })
              }

              // Persist to localStorage for backup
              const currentValues = get().workflowValues[activeWorkflowId] || {}
              saveSubblockValues(activeWorkflowId, currentValues)
            }, PERSIST_DELAY)

            // Trigger debounced sync to DB
            get().syncWithDB()
          }
        },

        getValue: (blockId: string, subBlockId: string) => {
          const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
          if (!activeWorkflowId) return null

          return get().workflowValues[activeWorkflowId]?.[blockId]?.[subBlockId] ?? null
        },

        clear: () => {
          const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
          if (!activeWorkflowId) return

          set((state) => ({
            workflowValues: {
              ...state.workflowValues,
              [activeWorkflowId]: {},
            },
          }))

          saveSubblockValues(activeWorkflowId, {})

          // Trigger sync to DB immediately on clear
          workflowSync.sync()
        },

        initializeFromWorkflow: (workflowId: string, blocks: Record<string, any>) => {
          // First, try to load from localStorage
          const savedValues = loadSubblockValues(workflowId)

          if (savedValues) {
            set((state) => ({
              workflowValues: {
                ...state.workflowValues,
                [workflowId]: savedValues,
              },
            }))
            return
          }

          // If no saved values, initialize from blocks
          const values: Record<string, Record<string, any>> = {}
          Object.entries(blocks).forEach(([blockId, block]) => {
            values[blockId] = {}
            Object.entries(block?.subBlocks || {}).forEach(([subBlockId, subBlock]) => {
              // Convert null values to empty strings for persistence
              const subBlockValue = (subBlock as SubBlockConfig).value
              values[blockId][subBlockId] = subBlockValue === null ? '' : subBlockValue
            })
          })

          set((state) => ({
            workflowValues: {
              ...state.workflowValues,
              [workflowId]: values,
            },
          }))

          // Save to localStorage
          saveSubblockValues(workflowId, values)
        },

        // Debounced sync function to trigger DB sync
        syncWithDB: () => {
          // Clear any existing timeout
          if (syncDebounceTimer) {
            // console.log('⏱️ SubBlockStore.syncWithDB: Clearing previous debounce timer')
            clearTimeout(syncDebounceTimer)
          }

          // Set new timeout
          // console.log(`⏱️ SubBlockStore.syncWithDB: Setting ${DEBOUNCE_DELAY}ms debounce timer for DB sync`)
          syncDebounceTimer = setTimeout(() => {
            // console.log('🚀 SubBlockStore.syncWithDB: Debounce timer expired, triggering syncUserAction()')
            // Trigger user action sync to DB
            workflowSync.syncUserAction()
          }, DEBOUNCE_DELAY)
        },

        // Tool params related functionality
        setToolParam: (toolId: string, paramId: string, value: string) => {
          // If setting a non-empty value, we should remove it from clearedParams if it exists
          if (value.trim() !== '') {
            set((state) => {
              const newClearedParams = { ...state.clearedParams }
              if (newClearedParams[toolId] && newClearedParams[toolId][paramId]) {
                delete newClearedParams[toolId][paramId]
                // Clean up empty objects
                if (Object.keys(newClearedParams[toolId]).length === 0) {
                  delete newClearedParams[toolId]
                }
              }

              return { clearedParams: newClearedParams }
            })
          }

          // Set the parameter value
          set((state) => ({
            toolParams: {
              ...state.toolParams,
              [toolId]: {
                ...(state.toolParams[toolId] || {}),
                [paramId]: value,
              },
            },
          }))

          // For API keys, also store under a normalized tool name for cross-referencing
          // This allows both blocks and tools to share the same parameters
          if (paramId.toLowerCase() === 'apikey' || paramId.toLowerCase() === 'api_key') {
            // Extract the tool name part (e.g., "crm" from "crm-create")
            const baseTool = toolId.split('-')[0].toLowerCase()

            if (baseTool !== toolId) {
              // Set the same value for the base tool to enable cross-referencing
              set((state) => ({
                toolParams: {
                  ...state.toolParams,
                  [baseTool]: {
                    ...(state.toolParams[baseTool] || {}),
                    [paramId]: value,
                  },
                },
              }))
            }
          }

          // CRITICAL FIX: Trigger sync to DB when API keys are set
          // Without this, toolParams are only saved to localStorage but not synced to database
          // This prevents cross-device persistence of API keys
          get().syncWithDB()
        },

        markParamAsCleared: (instanceId: string, paramId: string) => {
          // Mark this specific instance as cleared
          set((state) => ({
            clearedParams: {
              ...state.clearedParams,
              [instanceId]: {
                ...(state.clearedParams[instanceId] || {}),
                [paramId]: true,
              },
            },
          }))
        },

        unmarkParamAsCleared: (instanceId: string, paramId: string) => {
          // Remove the cleared flag for this parameter
          set((state) => {
            const newClearedParams = { ...state.clearedParams }
            if (newClearedParams[instanceId] && newClearedParams[instanceId][paramId]) {
              delete newClearedParams[instanceId][paramId]
              // Clean up empty objects
              if (Object.keys(newClearedParams[instanceId]).length === 0) {
                delete newClearedParams[instanceId]
              }
            }
            return { clearedParams: newClearedParams }
          })
        },

        isParamCleared: (instanceId: string, paramId: string) => {
          // Only check this specific instance
          return !!get().clearedParams[instanceId]?.[paramId]
        },

        getToolParam: (toolId: string, paramId: string) => {
          // Check for direct match first
          const directValue = get().toolParams[toolId]?.[paramId]
          if (directValue) return directValue

          // Try base tool name if it's a compound tool ID
          if (toolId.includes('-')) {
            const baseTool = toolId.split('-')[0].toLowerCase()
            return get().toolParams[baseTool]?.[paramId]
          }

          // Try matching against any stored tool that starts with this ID
          // This helps match "crm" with "crm-create" etc.
          const matchingToolIds = Object.keys(get().toolParams).filter(
            (id) => id.startsWith(toolId) || id.split('-')[0] === toolId
          )

          for (const id of matchingToolIds) {
            const value = get().toolParams[id]?.[paramId]
            if (value) return value
          }

          return undefined
        },

        getToolParams: (toolId: string) => {
          return get().toolParams[toolId] || {}
        },

        isEnvVarReference,

        resolveToolParamValue: (toolId: string, paramId: string, instanceId?: string) => {
          // If this is a specific instance that has been deliberately cleared, don't auto-fill it
          if (instanceId && get().isParamCleared(instanceId, paramId)) {
            return undefined
          }

          // Check if auto-fill environment variables is enabled
          const isAutoFillEnvVarsEnabled = useGeneralStore.getState().isAutoFillEnvVarsEnabled
          if (!isAutoFillEnvVarsEnabled) {
            // When auto-fill is disabled, we still return existing stored values, but don't
            // attempt to resolve environment variables or set new values
            return get().toolParams[toolId]?.[paramId]
          }

          const envStore = useEnvironmentStore.getState()

          // First check params store for previously entered value
          const storedValue = get().getToolParam(toolId, paramId)

          if (storedValue) {
            // If the stored value is an environment variable reference like {{EXA_API_KEY}}
            if (isEnvVarReference(storedValue)) {
              // Extract variable name from {{VAR_NAME}}
              const envVarName = extractEnvVarName(storedValue)
              if (!envVarName) return undefined

              // Check if this environment variable still exists
              const envValue = envStore.getVariable(envVarName)

              if (envValue) {
                // Environment variable exists, return the reference
                return storedValue
              } else {
                // Environment variable no longer exists
                return undefined
              }
            }

            // Return the stored value directly if it's not an env var reference
            return storedValue
          }

          // If no stored value, try to guess based on parameter name
          // This handles cases where the user hasn't entered a value yet
          if (paramId.toLowerCase() === 'apikey' || paramId.toLowerCase() === 'api_key') {
            const matchingVar = findMatchingEnvVar(toolId)
            if (matchingVar) {
              const envReference = `{{${matchingVar}}}`
              get().setToolParam(toolId, paramId, envReference)
              return envReference
            }
          }

          // No value found
          return undefined
        },

        clearToolParams: () => {
          set({ toolParams: {}, clearedParams: {} })
        },
      }),
      {
        name: 'subblock-store',
        partialize: (state) => ({
          // PERF: workflowValues excluded — already persisted via saveSubblockValues()
          // This prevents the persist middleware from JSON.stringify'ing the entire
          // workflow values on every set() call. Only small objects are serialized.
          toolParams: state.toolParams,
          clearedParams: state.clearedParams,
        }),
        storage: debouncedSafeStorage,
      }
    ),
    { name: 'subblock-store' }
  )
)
