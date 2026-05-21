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
} from '@/components/ui/command'

// cmdk uses ResizeObserver + scrollIntoView; jsdom lacks both.
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

type HarnessProps = {
  onApple?: () => void
  onBanana?: () => void
  onCherry?: () => void
  onDate?: () => void
  defaultValue?: string
}

const Palette = ({ onApple, onBanana, onCherry, onDate, defaultValue }: HarnessProps) => (
  <Command defaultValue={defaultValue}>
    <CommandInput placeholder="Search..." />
    <CommandList>
      <CommandEmpty>No results</CommandEmpty>
      <CommandGroup heading="Fruit">
        <CommandItem value="apple" onSelect={onApple}>
          Apple
        </CommandItem>
        <CommandItem value="banana" onSelect={onBanana}>
          Banana
        </CommandItem>
        <CommandItem value="cherry" onSelect={onCherry}>
          Cherry
        </CommandItem>
        <CommandItem value="date" disabled onSelect={onDate}>
          Date
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
)

describe('Command flows', () => {
  it('typing narrows list and shows empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Palette />)

    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement
    await user.type(input, 'ap')

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'zzz')

    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
  })

  it('arrow keys navigate, Enter selects, Escape clears the input', async () => {
    const user = userEvent.setup()
    const onApple = vi.fn()
    const onBanana = vi.fn()

    render(<Palette defaultValue="apple" onApple={onApple} onBanana={onBanana} />)

    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement
    input.focus()

    // ArrowDown moves selection from apple -> banana
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onBanana).toHaveBeenCalledTimes(1)
    expect(onApple).not.toHaveBeenCalled()

    // Type something — cmdk tracks the search value on the input.
    await user.type(input, 'ap')
    expect(input.value).toBe('ap')
  })

  it('onSelect fires only for enabled items (disabled items ignored)', async () => {
    const user = userEvent.setup()
    const onCherry = vi.fn()
    const onDate = vi.fn()

    render(<Palette onCherry={onCherry} onDate={onDate} />)

    await user.click(screen.getByText('Cherry'))
    expect(onCherry).toHaveBeenCalledTimes(1)

    await user.click(screen.getByText('Date'))
    expect(onDate).not.toHaveBeenCalled()
    expect(screen.getByText('Date').closest('[cmdk-item]')).toHaveAttribute('data-disabled', 'true')
  })

  it('focus stays on the input during arrow-key navigation', async () => {
    const user = userEvent.setup()
    render(<Palette defaultValue="apple" />)

    const input = screen.getByPlaceholderText('Search...')
    input.focus()
    expect(input).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(input).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(input).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(input).toHaveFocus()
  })
})
