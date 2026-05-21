/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

// cmdk uses ResizeObserver and scrollIntoView which jsdom does not implement.
beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!(window.Element.prototype as any).scrollIntoView) {
    ;(window.Element.prototype as any).scrollIntoView = () => {}
  }
})

type CommandHarnessProps = {
  onValueChange?: (value: string) => void
  onSelectApple?: () => void
  onSelectBanana?: () => void
  onSelectCherry?: () => void
  defaultValue?: string
}

const CommandHarness = ({
  onValueChange,
  onSelectApple,
  onSelectBanana,
  onSelectCherry,
  defaultValue,
}: CommandHarnessProps) => (
  <Command className="custom-command-class" defaultValue={defaultValue}>
    <CommandInput
      placeholder="Search fruit..."
      className="custom-input-class"
      onValueChange={onValueChange}
    />
    <CommandList>
      <CommandEmpty>No results found</CommandEmpty>
      <CommandGroup heading="Fruit">
        <CommandItem value="apple" onSelect={onSelectApple}>
          Apple
          <CommandShortcut>A</CommandShortcut>
        </CommandItem>
        <CommandItem value="banana" onSelect={onSelectBanana}>
          Banana
        </CommandItem>
        <CommandSeparator />
        <CommandItem value="cherry" disabled onSelect={onSelectCherry}>
          Cherry
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
)

describe('Command', () => {
  it('renders input placeholder and default items', () => {
    render(<CommandHarness />)

    expect(screen.getByPlaceholderText('Search fruit...')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.getByText('Cherry')).toBeInTheDocument()
  })

  it('updates the input value and cmdk state as the user types', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<CommandHarness onValueChange={onValueChange} />)

    const input = screen.getByPlaceholderText('Search fruit...') as HTMLInputElement
    await user.type(input, 'ap')

    // cmdk tracks the search internally and reflects it back on the input value.
    expect(input.value).toBe('ap')
    // Typing should filter results so only the matching item remains visible.
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
    // Wrapper forwards cmdk's native onValueChange — should fire per keystroke.
    expect(onValueChange).toHaveBeenCalledWith('a')
    expect(onValueChange).toHaveBeenLastCalledWith('ap')
  })

  it('filters items by search query and shows empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<CommandHarness />)

    const input = screen.getByPlaceholderText('Search fruit...')
    await user.type(input, 'zzz')

    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })

  it('selects an item on click and invokes its onSelect handler', async () => {
    const user = userEvent.setup()
    const onSelectApple = vi.fn()
    render(<CommandHarness onSelectApple={onSelectApple} />)

    await user.click(screen.getByText('Apple'))

    expect(onSelectApple).toHaveBeenCalledTimes(1)
  })

  it('supports arrow-down and Enter keyboard navigation', async () => {
    const user = userEvent.setup()
    const onSelectApple = vi.fn()
    const onSelectBanana = vi.fn()
    render(
      <CommandHarness
        defaultValue="apple"
        onSelectApple={onSelectApple}
        onSelectBanana={onSelectBanana}
      />
    )

    const input = screen.getByPlaceholderText('Search fruit...')
    input.focus()

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onSelectBanana).toHaveBeenCalledTimes(1)
    expect(onSelectApple).not.toHaveBeenCalled()
  })

  it('does not call onSelect for disabled items', async () => {
    const user = userEvent.setup()
    const onSelectCherry = vi.fn()
    render(<CommandHarness onSelectCherry={onSelectCherry} />)

    const cherry = screen.getByText('Cherry')
    await user.click(cherry)

    expect(onSelectCherry).not.toHaveBeenCalled()
    expect(cherry.closest('[cmdk-item]')).toHaveAttribute('data-disabled', 'true')
  })

  it('forwards className to the root and the input', () => {
    const { container } = render(<CommandHarness />)

    expect(container.querySelector('[cmdk-root]')).toHaveClass('custom-command-class')
    expect(screen.getByPlaceholderText('Search fruit...')).toHaveClass('custom-input-class')
  })

  it('honors defaultValue by marking the matching item as selected', () => {
    render(<CommandHarness defaultValue="banana" />)

    const banana = screen.getByText('Banana').closest('[cmdk-item]')
    expect(banana).toHaveAttribute('data-selected', 'true')
  })
})
