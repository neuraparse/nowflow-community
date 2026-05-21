/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const renderTooltip = (ui: React.ReactNode) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)

describe('Tooltip', () => {
  it('renders the trigger without showing content initially', () => {
    renderTooltip(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Helpful hint</TooltipContent>
      </Tooltip>
    )

    expect(screen.getByText('Hover me')).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows content on keyboard focus of trigger', async () => {
    const user = userEvent.setup()

    renderTooltip(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Helpful hint</TooltipContent>
      </Tooltip>
    )

    await user.tab()

    await waitFor(() => {
      expect(screen.getAllByText('Helpful hint').length).toBeGreaterThan(0)
    })
  })

  it('hides content after Escape is pressed', async () => {
    const user = userEvent.setup()

    renderTooltip(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Helpful hint</TooltipContent>
      </Tooltip>
    )

    await user.tab()
    await waitFor(() => {
      expect(screen.getAllByText('Helpful hint').length).toBeGreaterThan(0)
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('forwards className to content', async () => {
    const user = userEvent.setup()

    renderTooltip(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent className="custom-tooltip-class" data-testid="tooltip-content">
          Helpful hint
        </TooltipContent>
      </Tooltip>
    )

    await user.tab()

    await waitFor(() => {
      expect(screen.getByTestId('tooltip-content')).toHaveClass('custom-tooltip-class')
    })
  })

  it('supports defaultOpen tooltips', () => {
    renderTooltip(
      <Tooltip defaultOpen>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Open hint</TooltipContent>
      </Tooltip>
    )

    expect(screen.getAllByText('Open hint').length).toBeGreaterThan(0)
  })

  it('renders children within trigger', () => {
    renderTooltip(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Trigger button</button>
        </TooltipTrigger>
        <TooltipContent>Body</TooltipContent>
      </Tooltip>
    )

    expect(screen.getByRole('button', { name: 'Trigger button' })).toBeInTheDocument()
  })
})
