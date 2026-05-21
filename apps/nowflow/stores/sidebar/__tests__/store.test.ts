/**
 * Tests for the sidebar Zustand store.
 * Covers: initial state, mode/expanded actions, modal + workspace dropdown flags,
 * and resource group open/toggle logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSidebarStore } from '@/stores/sidebar/store'

vi.mock('@/stores/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

const INITIAL_STATE = useSidebarStore.getState()

describe('useSidebarStore', () => {
  beforeEach(() => {
    useSidebarStore.setState(
      {
        ...INITIAL_STATE,
        mode: 'expanded',
        isExpanded: true,
        workspaceDropdownOpen: false,
        isAnyModalOpen: false,
        resourceGroups: { data: false, tools: false, platform: false },
      },
      true
    )
  })

  describe('initial state', () => {
    it('has the expected defaults', () => {
      const state = useSidebarStore.getState()
      expect(state.mode).toBe('expanded')
      expect(state.isExpanded).toBe(true)
      expect(state.workspaceDropdownOpen).toBe(false)
      expect(state.isAnyModalOpen).toBe(false)
      expect(state.resourceGroups).toEqual({
        data: false,
        tools: false,
        platform: false,
      })
    })
  })

  describe('setMode', () => {
    it('updates mode to collapsed', () => {
      useSidebarStore.getState().setMode('collapsed')
      expect(useSidebarStore.getState().mode).toBe('collapsed')
    })

    it('updates mode to hover', () => {
      useSidebarStore.getState().setMode('hover')
      expect(useSidebarStore.getState().mode).toBe('hover')
    })

    it('is idempotent when setting the same mode', () => {
      useSidebarStore.getState().setMode('expanded')
      useSidebarStore.getState().setMode('expanded')
      expect(useSidebarStore.getState().mode).toBe('expanded')
    })
  })

  describe('toggleExpanded', () => {
    it('flips isExpanded from true to false', () => {
      useSidebarStore.getState().toggleExpanded()
      expect(useSidebarStore.getState().isExpanded).toBe(false)
    })

    it('flips isExpanded back after two toggles', () => {
      useSidebarStore.getState().toggleExpanded()
      useSidebarStore.getState().toggleExpanded()
      expect(useSidebarStore.getState().isExpanded).toBe(true)
    })
  })

  describe('setWorkspaceDropdownOpen', () => {
    it('sets true', () => {
      useSidebarStore.getState().setWorkspaceDropdownOpen(true)
      expect(useSidebarStore.getState().workspaceDropdownOpen).toBe(true)
    })

    it('sets false', () => {
      useSidebarStore.getState().setWorkspaceDropdownOpen(true)
      useSidebarStore.getState().setWorkspaceDropdownOpen(false)
      expect(useSidebarStore.getState().workspaceDropdownOpen).toBe(false)
    })
  })

  describe('setAnyModalOpen', () => {
    it('sets isAnyModalOpen to true', () => {
      useSidebarStore.getState().setAnyModalOpen(true)
      expect(useSidebarStore.getState().isAnyModalOpen).toBe(true)
    })

    it('sets isAnyModalOpen to false', () => {
      useSidebarStore.getState().setAnyModalOpen(true)
      useSidebarStore.getState().setAnyModalOpen(false)
      expect(useSidebarStore.getState().isAnyModalOpen).toBe(false)
    })
  })

  describe('forceExpanded', () => {
    it('forces expanded false regardless of prior state', () => {
      useSidebarStore.getState().forceExpanded(false)
      expect(useSidebarStore.getState().isExpanded).toBe(false)
    })

    it('forces expanded true regardless of prior state', () => {
      useSidebarStore.setState({ isExpanded: false })
      useSidebarStore.getState().forceExpanded(true)
      expect(useSidebarStore.getState().isExpanded).toBe(true)
    })
  })

  describe('setOpenResourceGroup', () => {
    it('opens the given group exclusively', () => {
      useSidebarStore.getState().setOpenResourceGroup('tools')
      expect(useSidebarStore.getState().resourceGroups).toEqual({
        data: false,
        tools: true,
        platform: false,
      })
    })

    it('switching groups only keeps the newly opened one', () => {
      useSidebarStore.getState().setOpenResourceGroup('data')
      useSidebarStore.getState().setOpenResourceGroup('platform')
      expect(useSidebarStore.getState().resourceGroups).toEqual({
        data: false,
        tools: false,
        platform: true,
      })
    })

    it('closes all groups when passed null', () => {
      useSidebarStore.getState().setOpenResourceGroup('data')
      useSidebarStore.getState().setOpenResourceGroup(null)
      expect(useSidebarStore.getState().resourceGroups).toEqual({
        data: false,
        tools: false,
        platform: false,
      })
    })
  })

  describe('toggleResourceGroup', () => {
    it('opens a closed group exclusively', () => {
      useSidebarStore.getState().toggleResourceGroup('tools')
      expect(useSidebarStore.getState().resourceGroups).toEqual({
        data: false,
        tools: true,
        platform: false,
      })
    })

    it('closes a group that is currently open', () => {
      useSidebarStore.getState().toggleResourceGroup('tools')
      useSidebarStore.getState().toggleResourceGroup('tools')
      expect(useSidebarStore.getState().resourceGroups).toEqual({
        data: false,
        tools: false,
        platform: false,
      })
    })

    it('toggling a different group closes the previously opened one', () => {
      useSidebarStore.getState().toggleResourceGroup('data')
      useSidebarStore.getState().toggleResourceGroup('platform')
      expect(useSidebarStore.getState().resourceGroups).toEqual({
        data: false,
        tools: false,
        platform: true,
      })
    })
  })
})
