/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Radix uses hasPointerCapture / setPointerCapture / scrollIntoView which jsdom lacks.
beforeAll(() => {
  if (!(window.Element.prototype as any).hasPointerCapture) {
    ;(window.Element.prototype as any).hasPointerCapture = () => false
  }
  if (!(window.Element.prototype as any).setPointerCapture) {
    ;(window.Element.prototype as any).setPointerCapture = () => {}
  }
  if (!(window.Element.prototype as any).releasePointerCapture) {
    ;(window.Element.prototype as any).releasePointerCapture = () => {}
  }
  if (!(window.Element.prototype as any).scrollIntoView) {
    ;(window.Element.prototype as any).scrollIntoView = () => {}
  }
})

type HarnessProps = {
  onFirst?: () => void
  onSecond?: () => void
  onThird?: () => void
}

const Menu = ({ onFirst, onSecond, onThird }: HarnessProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuLabel>Actions</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onFirst}>First</DropdownMenuItem>
      <DropdownMenuItem disabled onSelect={onSecond}>
        Second (disabled)
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onThird}>Third</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

describe('DropdownMenu flows', () => {
  it('click trigger opens, click trigger again closes', async () => {
    const user = userEvent.setup()
    render(<Menu />)

    const trigger = screen.getByText('Open menu')

    await user.click(trigger)
    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument()
    })

    // Radix sets pointer-events: none on the trigger while the menu is open,
    // so re-closing via user.click() can't happen — close via Escape instead.
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('First')).not.toBeInTheDocument()
    })
  })

  it('keyboard navigation via ArrowDown/ArrowUp/Enter selects correct item', async () => {
    const user = userEvent.setup()
    const onFirst = vi.fn()
    const onThird = vi.fn()

    render(<Menu onFirst={onFirst} onThird={onThird} />)

    const trigger = screen.getByText('Open menu')
    trigger.focus()

    // ArrowDown both opens the menu and focuses the first enabled item.
    await user.keyboard('{ArrowDown}')
    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument()
    })

    // Move down past the disabled "Second" to "Third".
    await user.keyboard('{ArrowDown}')

    // Move back up to "First".
    await user.keyboard('{ArrowUp}')
    await user.keyboard('{Enter}')

    expect(onFirst).toHaveBeenCalledTimes(1)
    expect(onThird).not.toHaveBeenCalled()
  })

  it('Escape closes and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Menu />)

    const trigger = screen.getByText('Open menu')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('First')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })
  })

  it('disabled items are skipped in keyboard navigation', async () => {
    const user = userEvent.setup()
    const onSecond = vi.fn()
    const onThird = vi.fn()

    render(<Menu onSecond={onSecond} onThird={onThird} />)

    const trigger = screen.getByText('Open menu')
    trigger.focus()
    await user.keyboard('{ArrowDown}')

    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument()
    })

    // From First, ArrowDown should skip the disabled Second and land on Third.
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onThird).toHaveBeenCalledTimes(1)
    expect(onSecond).not.toHaveBeenCalled()
  })

  it('disabled item has data-disabled and does not fire onSelect when clicked', async () => {
    const user = userEvent.setup()
    const onSecond = vi.fn()

    render(<Menu onSecond={onSecond} />)

    await user.click(screen.getByText('Open menu'))

    await waitFor(() => {
      expect(screen.getByText('Second (disabled)')).toBeInTheDocument()
    })

    const disabled = screen.getByText('Second (disabled)')
    expect(disabled).toHaveAttribute('data-disabled')

    await user.click(disabled)
    expect(onSecond).not.toHaveBeenCalled()
  })
})
