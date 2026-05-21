/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Radix Select relies on PointerEvent APIs and scrollIntoView that jsdom lacks.
beforeAll(() => {
  if (!(window.Element.prototype as any).hasPointerCapture) {
    ;(window.Element.prototype as any).hasPointerCapture = () => false
  }
  if (!(window.Element.prototype as any).releasePointerCapture) {
    ;(window.Element.prototype as any).releasePointerCapture = () => {}
  }
  if (!(window.Element.prototype as any).setPointerCapture) {
    ;(window.Element.prototype as any).setPointerCapture = () => {}
  }
  if (!(window.Element.prototype as any).scrollIntoView) {
    ;(window.Element.prototype as any).scrollIntoView = () => {}
  }
})

type SelectHarnessProps = {
  onValueChange?: (value: string) => void
  defaultValue?: string
  disabled?: boolean
}

const SelectHarness = ({ onValueChange, defaultValue, disabled }: SelectHarnessProps) => (
  <Select defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
    <SelectTrigger className="custom-trigger-class" aria-label="Fruit">
      <SelectValue placeholder="Pick a fruit" />
    </SelectTrigger>
    <SelectContent className="custom-content-class">
      <SelectGroup>
        <SelectLabel>Fruit</SelectLabel>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectSeparator />
        <SelectItem value="cherry" disabled>
          Cherry
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
)

describe('Select', () => {
  it('renders the trigger with the placeholder when no value is set', () => {
    render(<SelectHarness />)

    expect(screen.getByRole('combobox', { name: 'Fruit' })).toBeInTheDocument()
    expect(screen.getByText('Pick a fruit')).toBeInTheDocument()
  })

  it('renders the default value in the trigger', () => {
    render(<SelectHarness defaultValue="banana" />)

    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveTextContent('Banana')
  })

  it('opens the listbox on trigger click and shows items', async () => {
    const user = userEvent.setup()
    render(<SelectHarness />)

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }))

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Banana' })).toBeInTheDocument()
  })

  it('calls onValueChange with the selected value when an option is clicked', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<SelectHarness onValueChange={onValueChange} />)

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('option', { name: 'Apple' }))

    expect(onValueChange).toHaveBeenCalledWith('apple')
  })

  it('supports keyboard navigation with arrow keys and Enter', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<SelectHarness onValueChange={onValueChange} defaultValue="apple" />)

    const trigger = screen.getByRole('combobox', { name: 'Fruit' })
    trigger.focus()

    // Open the menu via keyboard.
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onValueChange).toHaveBeenCalledWith('banana')
  })

  it('marks disabled items as disabled and does not select them', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<SelectHarness onValueChange={onValueChange} />)

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cherry' })).toBeInTheDocument()
    })

    const cherry = screen.getByRole('option', { name: 'Cherry' })
    expect(cherry).toHaveAttribute('data-disabled')

    await user.click(cherry)

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('forwards className to the trigger and content', async () => {
    const user = userEvent.setup()
    render(<SelectHarness />)

    const trigger = screen.getByRole('combobox', { name: 'Fruit' })
    expect(trigger).toHaveClass('custom-trigger-class')

    await user.click(trigger)
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    // Content is the element that wraps the listbox viewport.
    const listbox = screen.getByRole('listbox')
    const content = listbox.closest('.custom-content-class')
    expect(content).not.toBeNull()
  })

  it('does not open when the select is disabled', async () => {
    const user = userEvent.setup()
    render(<SelectHarness disabled />)

    const trigger = screen.getByRole('combobox', { name: 'Fruit' })
    expect(trigger).toBeDisabled()

    await user.click(trigger)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
