import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createLogger } from '@/lib/logs/console-logger'
import { safeStorage } from '@/stores/safe-storage'
import { BlockStyle, BlockStyleStore, DEFAULT_BLOCK_STYLE } from './types'

const logger = createLogger('BlockStyleStore')

/**
 * Store for managing block styling and customization
 */
export const useBlockStyleStore = create<BlockStyleStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        styles: {},
        activeStyleEditorId: null,

        // Actions
        setBlockStyle: (blockId: string, style: Partial<BlockStyle>) => {
          logger.debug(`Setting style for block ${blockId}:`, style)
          set((state) => {
            const newStyle = {
              ...(state.styles[blockId] || DEFAULT_BLOCK_STYLE),
              ...style,
            }
            const newState = {
              styles: {
                ...state.styles,
                [blockId]: newStyle,
              },
            }
            logger.debug(`Updated state for ${blockId}`, newStyle)
            logger.debug(`Total styled blocks:`, Object.keys(newState.styles).length)
            return newState
          })
        },

        resetBlockStyle: (blockId: string) => {
          set((state) => {
            const newStyles = { ...state.styles }
            delete newStyles[blockId]
            return { styles: newStyles }
          })
        },

        getBlockStyle: (blockId: string) => {
          return get().styles[blockId] || DEFAULT_BLOCK_STYLE
        },

        toggleBlockStyleEditor: (blockId: string) => {
          set((state) => {
            // If the same block is clicked, close the editor
            if (state.activeStyleEditorId === blockId) {
              return { activeStyleEditorId: null }
            }
            // Otherwise, open the editor for this block
            return { activeStyleEditorId: blockId }
          })
        },

        closeBlockStyleEditor: () => {
          set({ activeStyleEditorId: null })
        },
      }),
      {
        name: 'block-style-store',
        storage: safeStorage,
      }
    )
  )
)
