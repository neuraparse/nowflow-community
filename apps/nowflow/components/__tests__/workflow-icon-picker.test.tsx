/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkflowIconPicker } from '@/components/workflow-icon-picker'
import { WORKFLOW_ICONS } from '@/components/workflow-icons'

// jsdom lacks hasPointerCapture / scrollIntoView / ResizeObserver used by Radix.
beforeAll(() => {
  if (!(Element.prototype as any).hasPointerCapture) {
    ;(Element.prototype as any).hasPointerCapture = () => false
  }
  if (!(Element.prototype as any).releasePointerCapture) {
    ;(Element.prototype as any).releasePointerCapture = () => {}
  }
  if (!(Element.prototype as any).setPointerCapture) {
    ;(Element.prototype as any).setPointerCapture = () => {}
  }
  if (!(Element.prototype as any).scrollIntoView) {
    ;(Element.prototype as any).scrollIntoView = () => {}
  }
  if (typeof (globalThis as any).ResizeObserver === 'undefined') {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (typeof (globalThis as any).DOMRect === 'undefined') {
    ;(globalThis as any).DOMRect = class {
      x = 0
      y = 0
      width = 0
      height = 0
      top = 0
      right = 0
      bottom = 0
      left = 0
      static fromRect() {
        return new (globalThis as any).DOMRect()
      }
    }
  }
})

describe('WorkflowIconPicker', () => {
  it('renders a default trigger button without crashing', () => {
    render(<WorkflowIconPicker onIconSelect={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renders with a custom trigger node', () => {
    render(
      <WorkflowIconPicker
        onIconSelect={() => {}}
        trigger={<button type="button">Open picker</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Open picker' })).toBeInTheDocument()
  })

  it('displays the icon corresponding to selectedIconId in the default trigger', () => {
    const { container } = render(
      <WorkflowIconPicker selectedIconId="bot" onIconSelect={() => {}} />
    )
    const coloredIconWrapper = container.querySelector('[style*="color"]') as HTMLElement
    expect(coloredIconWrapper).not.toBeNull()
    // "bot" is #3B82F6 (normalized by browsers to rgb(59, 130, 246)).
    expect(coloredIconWrapper.getAttribute('style')).toMatch(/(#3B82F6|rgb\(59, 130, 246\))/i)
  })

  it('opens the popover when the trigger is clicked and shows the search field', async () => {
    const user = userEvent.setup()
    render(<WorkflowIconPicker onIconSelect={() => {}} />)

    await user.click(screen.getByRole('button'))

    // Popover content is rendered in a portal but still accessible via role/placeholder.
    expect(await screen.findByPlaceholderText('Search icons...')).toBeInTheDocument()
    expect(screen.getByText('Choose Icon')).toBeInTheDocument()
  })

  it('filters the icon list when a search query is typed', async () => {
    const user = userEvent.setup()
    render(<WorkflowIconPicker onIconSelect={() => {}} />)

    await user.click(screen.getByRole('button'))
    const search = await screen.findByPlaceholderText('Search icons...')

    await user.type(search, 'bot')

    // At least the "Bot" icon should remain; icons without "bot" in name or category should not.
    // We can check the search results region has a reasonable number of icon buttons.
    const allButtons = screen.getAllByRole('button')
    // The first button is the trigger; rest are filtered icon buttons.
    // Icons matching "bot" in name: only "Bot" (id=bot). Category "AI & Automation" doesn't match.
    const iconButtonCount = allButtons.length - 1
    expect(iconButtonCount).toBeGreaterThanOrEqual(1)
    expect(iconButtonCount).toBeLessThan(WORKFLOW_ICONS.length)
  })

  it('shows a "No icons found" empty state when no icons match the query', async () => {
    const user = userEvent.setup()
    render(<WorkflowIconPicker onIconSelect={() => {}} />)

    await user.click(screen.getByRole('button'))
    const search = await screen.findByPlaceholderText('Search icons...')
    await user.type(search, 'zzzzznothing')

    expect(await screen.findByText('No icons found')).toBeInTheDocument()
  })

  it('fires onIconSelect and closes the popover when an icon is clicked', async () => {
    const onIconSelect = vi.fn()
    const user = userEvent.setup()
    render(<WorkflowIconPicker onIconSelect={onIconSelect} />)

    await user.click(screen.getByRole('button'))
    const search = await screen.findByPlaceholderText('Search icons...')
    // Narrow list to a deterministic single icon.
    await user.type(search, 'Bot')

    // Buttons rendered in the portal: trigger + icon buttons. Pick the icon button that is not the trigger.
    const allButtons = screen.getAllByRole('button')
    const iconButton = allButtons.find((btn) => btn !== screen.getAllByRole('button')[0])!
    await user.click(iconButton)

    expect(onIconSelect).toHaveBeenCalledTimes(1)
    expect(onIconSelect).toHaveBeenCalledWith(expect.any(String))
    // Popover closes, so the search field is gone.
    expect(screen.queryByPlaceholderText('Search icons...')).not.toBeInTheDocument()
  })

  it('closes the popover when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<WorkflowIconPicker onIconSelect={() => {}} />)

    await user.click(screen.getByRole('button'))
    const search = await screen.findByPlaceholderText('Search icons...')
    expect(search).toBeInTheDocument()

    // Radix Popover closes on Escape at the document/content level.
    fireEvent.keyDown(search, { key: 'Escape', code: 'Escape' })

    // Allow Radix to flush close state.
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByPlaceholderText('Search icons...')).not.toBeInTheDocument()
  })

  it('visually marks the selected icon with a check overlay', async () => {
    const user = userEvent.setup()
    render(<WorkflowIconPicker selectedIconId="bot" onIconSelect={() => {}} />)

    await user.click(screen.getByRole('button'))
    await screen.findByPlaceholderText('Search icons...')

    // The selected icon button should contain the lucide-react Check icon (svg with class "lucide-check").
    const checks = document.querySelectorAll('svg.lucide-check')
    expect(checks.length).toBeGreaterThanOrEqual(1)

    // And the selected icon button should have the primary border marker class.
    const selectedMarker = document.querySelectorAll('.border-primary')
    expect(selectedMarker.length).toBeGreaterThanOrEqual(1)
  })

  it('merges className into the default trigger', () => {
    const { container } = render(
      <WorkflowIconPicker onIconSelect={() => {}} className="picker-class" />
    )
    const trigger = container.querySelector('button')!
    expect(trigger).toHaveClass('picker-class')
  })

  it('renders category tabs when no search query is active', async () => {
    const user = userEvent.setup()
    render(<WorkflowIconPicker onIconSelect={() => {}} />)
    await user.click(screen.getByRole('button'))

    // Opens without search, so Tabs render; expect at least one tab.
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.length).toBeGreaterThanOrEqual(1)

    const moreHeader = screen.queryByText('More Categories')
    // May or may not exist depending on how many categories; both are fine, but if found it must be visible.
    if (moreHeader) {
      expect(moreHeader).toBeInTheDocument()
    }
  })

  it('allows selecting a different category tab and shows its icons', async () => {
    const user = userEvent.setup()
    render(<WorkflowIconPicker onIconSelect={() => {}} />)
    await user.click(screen.getByRole('button'))

    const tabs = await screen.findAllByRole('tab')
    if (tabs.length > 1) {
      await user.click(tabs[1])
      // After selecting tab 2, at least one icon button should be visible inside its panel.
      const activePanel = document.querySelector('[role="tabpanel"][data-state="active"]')
      expect(activePanel).not.toBeNull()
      const innerIcons = within(activePanel as HTMLElement).getAllByRole('button')
      expect(innerIcons.length).toBeGreaterThan(0)
    }
  })
})
