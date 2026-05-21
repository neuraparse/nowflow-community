/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

describe('Popover', () => {
  it('renders the trigger and hides content by default', () => {
    render(
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    )

    expect(screen.getByText('Open popover')).toBeInTheDocument()
    expect(screen.queryByText('Popover body')).not.toBeInTheDocument()
  })

  it('opens content on trigger click', async () => {
    const user = userEvent.setup()

    render(
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    )

    await user.click(screen.getByText('Open popover'))

    await waitFor(() => {
      expect(screen.getByText('Popover body')).toBeInTheDocument()
    })
  })

  it('closes on Escape key', async () => {
    const user = userEvent.setup()

    render(
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    )

    await user.click(screen.getByText('Open popover'))
    await waitFor(() => {
      expect(screen.getByText('Popover body')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Popover body')).not.toBeInTheDocument()
    })
  })

  it('closes on outside click', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <button type="button">Outside</button>
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverContent>Popover body</PopoverContent>
        </Popover>
      </div>
    )

    await user.click(screen.getByText('Open popover'))
    await waitFor(() => {
      expect(screen.getByText('Popover body')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Outside'))

    await waitFor(() => {
      expect(screen.queryByText('Popover body')).not.toBeInTheDocument()
    })
  })

  it('supports controlled open state via onOpenChange', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <Popover onOpenChange={onOpenChange}>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    )

    await user.click(screen.getByText('Open popover'))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true)
    })
  })

  it('forwards className to content', async () => {
    const user = userEvent.setup()

    render(
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent className="custom-popover-class" data-testid="popover-content">
          Body
        </PopoverContent>
      </Popover>
    )

    await user.click(screen.getByText('Open popover'))

    await waitFor(() => {
      expect(screen.getByTestId('popover-content')).toHaveClass('custom-popover-class')
    })
  })

  it('respects defaultOpen', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>Already open</PopoverContent>
      </Popover>
    )

    expect(screen.getByText('Already open')).toBeInTheDocument()
  })
})
