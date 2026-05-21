/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

describe('DropdownMenu', () => {
  it('renders the trigger and hides content by default', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(screen.getByText('Open menu')).toBeInTheDocument()
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
  })

  it('opens content on trigger click', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
  })

  it('fires onSelect when an item is clicked and closes the menu', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Item 1'))

    expect(onSelect).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
    })
  })

  it('does not fire onSelect for disabled items', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onSelect={onSelect}>
            Disabled item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))
    await waitFor(() => {
      expect(screen.getByText('Disabled item')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Disabled item'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes on Escape key', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
    })
  })

  it('supports keyboard navigation: ArrowDown + Enter selects first item', async () => {
    const user = userEvent.setup()
    const onSelectFirst = vi.fn()
    const onSelectSecond = vi.fn()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelectFirst}>First</DropdownMenuItem>
          <DropdownMenuItem onSelect={onSelectSecond}>Second</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))
    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument()
    })

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onSelectFirst).toHaveBeenCalledTimes(1)
    expect(onSelectSecond).not.toHaveBeenCalled()
  })

  it('renders label and separator inside content', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel data-testid="menu-label">Actions</DropdownMenuLabel>
          <DropdownMenuSeparator data-testid="menu-separator" />
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))

    await waitFor(() => {
      expect(screen.getByTestId('menu-label')).toBeInTheDocument()
      expect(screen.getByTestId('menu-separator')).toBeInTheDocument()
    })
  })

  it('renders DropdownMenuGroup with child items', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>Group item A</DropdownMenuItem>
            <DropdownMenuItem>Group item B</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))

    await waitFor(() => {
      expect(screen.getByText('Group item A')).toBeInTheDocument()
      expect(screen.getByText('Group item B')).toBeInTheDocument()
    })
  })

  it('toggles DropdownMenuCheckboxItem checked state', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
            Toggle
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))
    await waitFor(() => {
      expect(screen.getByText('Toggle')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Toggle'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('fires onValueChange for DropdownMenuRadioGroup selection', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="a">Alpha</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Beta</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))
    await waitFor(() => {
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Beta'))

    expect(onValueChange).toHaveBeenCalledWith('b')
  })

  it('renders DropdownMenuShortcut with provided className', () => {
    render(
      <DropdownMenuShortcut className="extra-shortcut-class" data-testid="shortcut">
        Ctrl+K
      </DropdownMenuShortcut>
    )

    const shortcut = screen.getByTestId('shortcut')
    expect(shortcut).toBeInTheDocument()
    expect(shortcut).toHaveClass('extra-shortcut-class')
    expect(shortcut).toHaveClass('ml-auto')
  })

  it('forwards className to content and items', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent className="custom-content-class" data-testid="dropdown-content">
          <DropdownMenuItem className="custom-item-class" data-testid="dropdown-item">
            Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open menu'))

    await waitFor(() => {
      expect(screen.getByTestId('dropdown-content')).toHaveClass('custom-content-class')
      expect(screen.getByTestId('dropdown-item')).toHaveClass('custom-item-class')
    })
  })
})
