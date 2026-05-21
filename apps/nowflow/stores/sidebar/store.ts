import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '@/stores/safe-storage'

export type SidebarMode = 'expanded' | 'collapsed' | 'hover'
export type ResourceGroup = 'data' | 'tools' | 'platform'

const RESOURCE_GROUP_ORDER: ResourceGroup[] = ['data', 'tools', 'platform']

const DEFAULT_RESOURCE_GROUPS: Record<ResourceGroup, boolean> = {
  data: false,
  tools: false,
  platform: false,
}

function normalizeResourceGroups(
  resourceGroups?: Partial<Record<ResourceGroup, boolean>>
): Record<ResourceGroup, boolean> {
  const mergedGroups = {
    ...DEFAULT_RESOURCE_GROUPS,
    ...resourceGroups,
  }

  const firstExpandedGroup = RESOURCE_GROUP_ORDER.find((group) => mergedGroups[group])

  if (!firstExpandedGroup) {
    return mergedGroups
  }

  return RESOURCE_GROUP_ORDER.reduce(
    (acc, group) => {
      acc[group] = group === firstExpandedGroup
      return acc
    },
    {} as Record<ResourceGroup, boolean>
  )
}

interface SidebarState {
  mode: SidebarMode
  isExpanded: boolean
  // Track workspace dropdown state
  workspaceDropdownOpen: boolean
  // Track if any modal is open
  isAnyModalOpen: boolean
  // Track which resource groups are expanded
  resourceGroups: Record<ResourceGroup, boolean>
  setMode: (mode: SidebarMode) => void
  toggleExpanded: () => void
  // Control workspace dropdown state
  setWorkspaceDropdownOpen: (isOpen: boolean) => void
  // Control modal state
  setAnyModalOpen: (isOpen: boolean) => void
  // Force sidebar expanded state without triggering loops
  forceExpanded: (expanded: boolean) => void
  // Open a single resource group or close all groups
  setOpenResourceGroup: (group: ResourceGroup | null) => void
  // Toggle a resource group open/closed
  toggleResourceGroup: (group: ResourceGroup) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      mode: 'expanded',
      isExpanded: true,
      workspaceDropdownOpen: false,
      isAnyModalOpen: false,
      resourceGroups: DEFAULT_RESOURCE_GROUPS,
      setMode: (mode) => set({ mode }),
      toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setWorkspaceDropdownOpen: (isOpen) => set({ workspaceDropdownOpen: isOpen }),
      setAnyModalOpen: (isOpen) => set({ isAnyModalOpen: isOpen }),
      forceExpanded: (expanded) => set({ isExpanded: expanded }),
      setOpenResourceGroup: (group) =>
        set({
          resourceGroups: group
            ? RESOURCE_GROUP_ORDER.reduce(
                (acc, currentGroup) => {
                  acc[currentGroup] = currentGroup === group
                  return acc
                },
                {} as Record<ResourceGroup, boolean>
              )
            : DEFAULT_RESOURCE_GROUPS,
        }),
      toggleResourceGroup: (group) =>
        set((state) => {
          const isCurrentlyOpen = state.resourceGroups[group]

          if (isCurrentlyOpen) {
            return {
              resourceGroups: DEFAULT_RESOURCE_GROUPS,
            }
          }

          return {
            resourceGroups: RESOURCE_GROUP_ORDER.reduce(
              (acc, currentGroup) => {
                acc[currentGroup] = currentGroup === group
                return acc
              },
              {} as Record<ResourceGroup, boolean>
            ),
          }
        }),
    }),
    {
      name: 'sidebar-state',
      storage: safeStorage,
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as Partial<SidebarState> | undefined

        return {
          ...currentState,
          ...typedPersistedState,
          resourceGroups: normalizeResourceGroups(typedPersistedState?.resourceGroups),
        }
      },
    }
  )
)
