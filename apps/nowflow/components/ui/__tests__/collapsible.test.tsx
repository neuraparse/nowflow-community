/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible'

describe('Collapsible', () => {
  describe('rendering', () => {
    it('renders the trigger', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Hidden body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.getByRole('button', { name: 'Toggle' })).toBeInTheDocument()
    })

    it('hides content when closed by default', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Hidden body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.queryByText('Hidden body')).not.toBeInTheDocument()
    })
  })

  describe('default open state (uncontrolled)', () => {
    it('renders content visible when defaultOpen is true', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Visible body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.getByText('Visible body')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    })
  })

  describe('uncontrolled open/close via trigger click', () => {
    it('opens content when trigger is clicked', async () => {
      const user = userEvent.setup()
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )

      await user.click(screen.getByRole('button', { name: 'Toggle' }))
      expect(screen.getByText('Body')).toBeInTheDocument()
    })

    it('closes content when trigger is clicked again', async () => {
      const user = userEvent.setup()
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )

      const trigger = screen.getByRole('button', { name: 'Toggle' })
      await user.click(trigger)
      expect(screen.getByText('Body')).toBeInTheDocument()

      await user.click(trigger)
      expect(screen.queryByText('Body')).not.toBeInTheDocument()
    })
  })

  describe('controlled mode', () => {
    it('does not auto-update when open prop is static', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <Collapsible open={false} onOpenChange={onOpenChange}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )

      await user.click(screen.getByRole('button', { name: 'Toggle' }))
      expect(onOpenChange).toHaveBeenCalledWith(true)
      expect(screen.queryByText('Body')).not.toBeInTheDocument()
    })

    it('reflects open=true prop immediately', () => {
      render(
        <Collapsible open>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.getByText('Body')).toBeInTheDocument()
    })

    it('updates visibility when controlled open prop changes', () => {
      const { rerender } = render(
        <Collapsible open={false}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.queryByText('Body')).not.toBeInTheDocument()

      rerender(
        <Collapsible open>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.getByText('Body')).toBeInTheDocument()
    })
  })

  describe('aria attributes', () => {
    it('sets aria-expanded on trigger and updates on toggle', async () => {
      const user = userEvent.setup()
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )

      const trigger = screen.getByRole('button', { name: 'Toggle' })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-controls')

      await user.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('reflects state via data-state on the trigger', async () => {
      const user = userEvent.setup()
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )

      const trigger = screen.getByRole('button', { name: 'Toggle' })
      expect(trigger).toHaveAttribute('data-state', 'closed')

      await user.click(trigger)
      expect(trigger).toHaveAttribute('data-state', 'open')
    })
  })

  describe('disabled state', () => {
    it('does not open when disabled', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      render(
        <Collapsible disabled onOpenChange={onOpenChange}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )

      await user.click(screen.getByRole('button', { name: 'Toggle' }))
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.queryByText('Body')).not.toBeInTheDocument()
    })
  })

  describe('className passthrough', () => {
    it('forwards className on Collapsible root', () => {
      render(
        <Collapsible className="custom-root" data-testid="root">
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.getByTestId('root')).toHaveClass('custom-root')
    })

    it('forwards className on CollapsibleTrigger', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger className="custom-trigger">Toggle</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveClass('custom-trigger')
    })

    it('forwards className on CollapsibleContent', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent className="custom-content">Body</CollapsibleContent>
        </Collapsible>
      )
      const body = screen.getByText('Body')
      expect(body).toHaveClass('custom-content')
    })
  })
})
