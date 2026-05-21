import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { safeStorage } from '@/stores/safe-storage'

export type WorkflowNodeStyle = 'default' | 'hero'

interface WorkflowStyleState {
  globalNodeStyle: WorkflowNodeStyle
  setGlobalNodeStyle: (style: WorkflowNodeStyle) => void
  toggleGlobalNodeStyle: () => void
  laraBoxMode: boolean
  setLaraBoxMode: (enabled: boolean) => void
  toggleLaraBoxMode: () => void
}

export const useWorkflowStyleStore = create<WorkflowStyleState>()(
  devtools(
    persist(
      (set) => ({
        globalNodeStyle: 'hero', // Default to hero style

        setGlobalNodeStyle: (style: WorkflowNodeStyle) => {
          set({ globalNodeStyle: style })
        },

        toggleGlobalNodeStyle: () => {
          set((state) => ({
            globalNodeStyle: state.globalNodeStyle === 'default' ? 'hero' : 'default',
          }))
        },

        laraBoxMode: false,

        setLaraBoxMode: (enabled: boolean) => {
          set({ laraBoxMode: enabled })
        },

        toggleLaraBoxMode: () => {
          set((state) => ({ laraBoxMode: !state.laraBoxMode }))
        },
      }),
      {
        name: 'workflow-style-storage',
        storage: safeStorage,
      }
    )
  )
)
