/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../accordion'

const renderBasicAccordion = (props: Partial<React.ComponentProps<typeof Accordion>> = {}) => {
  return render(
    <Accordion type="single" collapsible {...(props as any)}>
      <AccordionItem value="item-1">
        <AccordionTrigger>Section One</AccordionTrigger>
        <AccordionContent>Content One</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Section Two</AccordionTrigger>
        <AccordionContent>Content Two</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

describe('Accordion', () => {
  describe('rendering', () => {
    it('renders all triggers', () => {
      renderBasicAccordion()
      expect(screen.getByRole('button', { name: 'Section One' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Section Two' })).toBeInTheDocument()
    })

    it('hides content when closed by default', () => {
      renderBasicAccordion()
      expect(screen.queryByText('Content One')).not.toBeInTheDocument()
      expect(screen.queryByText('Content Two')).not.toBeInTheDocument()
    })

    it('renders a chevron icon inside each trigger', () => {
      const { container } = renderBasicAccordion()
      const svgs = container.querySelectorAll('button svg')
      expect(svgs.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('default open state (uncontrolled)', () => {
    it('opens item matching defaultValue on mount (single)', () => {
      render(
        <Accordion type="single" collapsible defaultValue="item-2">
          <AccordionItem value="item-1">
            <AccordionTrigger>One</AccordionTrigger>
            <AccordionContent>Body One</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Two</AccordionTrigger>
            <AccordionContent>Body Two</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      expect(screen.getByText('Body Two')).toBeInTheDocument()
      expect(screen.queryByText('Body One')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('opens multiple items matching defaultValue on mount (multiple)', () => {
      render(
        <Accordion type="multiple" defaultValue={['item-1', 'item-2']}>
          <AccordionItem value="item-1">
            <AccordionTrigger>One</AccordionTrigger>
            <AccordionContent>Body One</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Two</AccordionTrigger>
            <AccordionContent>Body Two</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      expect(screen.getByText('Body One')).toBeInTheDocument()
      expect(screen.getByText('Body Two')).toBeInTheDocument()
    })
  })

  describe('uncontrolled open/close via click (single mode)', () => {
    it('opens item on trigger click', async () => {
      const user = userEvent.setup()
      renderBasicAccordion()

      await user.click(screen.getByRole('button', { name: 'Section One' }))

      expect(screen.getByText('Content One')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Section One' })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    })

    it('closes previously open item when another is clicked (single)', async () => {
      const user = userEvent.setup()
      renderBasicAccordion()

      await user.click(screen.getByRole('button', { name: 'Section One' }))
      expect(screen.getByText('Content One')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Section Two' }))
      expect(screen.getByText('Content Two')).toBeInTheDocument()
      expect(screen.queryByText('Content One')).not.toBeInTheDocument()
    })

    it('collapses open item when clicked again (collapsible)', async () => {
      const user = userEvent.setup()
      renderBasicAccordion()

      const trigger = screen.getByRole('button', { name: 'Section One' })
      await user.click(trigger)
      expect(screen.getByText('Content One')).toBeInTheDocument()

      await user.click(trigger)
      expect(screen.queryByText('Content One')).not.toBeInTheDocument()
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('multiple mode', () => {
    it('allows multiple items open simultaneously', async () => {
      const user = userEvent.setup()
      render(
        <Accordion type="multiple">
          <AccordionItem value="a">
            <AccordionTrigger>A</AccordionTrigger>
            <AccordionContent>Body A</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>B</AccordionTrigger>
            <AccordionContent>Body B</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      await user.click(screen.getByRole('button', { name: 'A' }))
      await user.click(screen.getByRole('button', { name: 'B' }))

      expect(screen.getByText('Body A')).toBeInTheDocument()
      expect(screen.getByText('Body B')).toBeInTheDocument()
    })

    it('independently toggles items in multiple mode', async () => {
      const user = userEvent.setup()
      render(
        <Accordion type="multiple" defaultValue={['a']}>
          <AccordionItem value="a">
            <AccordionTrigger>A</AccordionTrigger>
            <AccordionContent>Body A</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>B</AccordionTrigger>
            <AccordionContent>Body B</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      expect(screen.getByText('Body A')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'A' }))
      expect(screen.queryByText('Body A')).not.toBeInTheDocument()
      expect(screen.queryByText('Body B')).not.toBeInTheDocument()
    })
  })

  describe('controlled mode', () => {
    it('uses value prop and calls onValueChange (single)', async () => {
      const onValueChange = vi.fn()
      const user = userEvent.setup()

      const { rerender } = render(
        <Accordion type="single" collapsible value="item-1" onValueChange={onValueChange}>
          <AccordionItem value="item-1">
            <AccordionTrigger>One</AccordionTrigger>
            <AccordionContent>Body One</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Two</AccordionTrigger>
            <AccordionContent>Body Two</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      expect(screen.getByText('Body One')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Two' }))
      expect(onValueChange).toHaveBeenCalledWith('item-2')

      // Content does not swap until the controlled value prop changes.
      expect(screen.queryByText('Body Two')).not.toBeInTheDocument()

      rerender(
        <Accordion type="single" collapsible value="item-2" onValueChange={onValueChange}>
          <AccordionItem value="item-1">
            <AccordionTrigger>One</AccordionTrigger>
            <AccordionContent>Body One</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Two</AccordionTrigger>
            <AccordionContent>Body Two</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      expect(screen.getByText('Body Two')).toBeInTheDocument()
    })

    it('uses value prop and calls onValueChange (multiple)', async () => {
      const onValueChange = vi.fn()
      const user = userEvent.setup()

      render(
        <Accordion type="multiple" value={['item-1']} onValueChange={onValueChange}>
          <AccordionItem value="item-1">
            <AccordionTrigger>One</AccordionTrigger>
            <AccordionContent>Body One</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Two</AccordionTrigger>
            <AccordionContent>Body Two</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      expect(screen.getByText('Body One')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Two' }))
      expect(onValueChange).toHaveBeenCalledWith(['item-1', 'item-2'])
    })
  })

  describe('aria attributes', () => {
    it('wires aria-expanded and aria-controls on trigger', async () => {
      const user = userEvent.setup()
      renderBasicAccordion()

      const trigger = screen.getByRole('button', { name: 'Section One' })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-controls')

      await user.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('renders a region for open content with aria-labelledby', async () => {
      const user = userEvent.setup()
      renderBasicAccordion()

      await user.click(screen.getByRole('button', { name: 'Section One' }))
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-labelledby')
    })

    it('reflects state via data-state on trigger and item', async () => {
      const user = userEvent.setup()
      renderBasicAccordion()

      const trigger = screen.getByRole('button', { name: 'Section One' })
      expect(trigger).toHaveAttribute('data-state', 'closed')

      await user.click(trigger)
      expect(trigger).toHaveAttribute('data-state', 'open')
    })
  })

  describe('className passthrough', () => {
    it('merges custom className on AccordionItem', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="x" className="custom-item" data-testid="item">
            <AccordionTrigger>X</AccordionTrigger>
            <AccordionContent>Body</AccordionContent>
          </AccordionItem>
        </Accordion>
      )
      expect(screen.getByTestId('item')).toHaveClass('custom-item')
    })

    it('merges custom className on AccordionTrigger', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="x">
            <AccordionTrigger className="custom-trigger">X</AccordionTrigger>
            <AccordionContent>Body</AccordionContent>
          </AccordionItem>
        </Accordion>
      )
      const trigger = screen.getByRole('button', { name: 'X' })
      expect(trigger).toHaveClass('custom-trigger')
      expect(trigger).toHaveClass('flex')
    })

    it('merges custom className on AccordionContent inner div', async () => {
      const user = userEvent.setup()
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="x">
            <AccordionTrigger>X</AccordionTrigger>
            <AccordionContent className="custom-content">Body</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      await user.click(screen.getByRole('button', { name: 'X' }))
      const body = screen.getByText('Body')
      expect(body).toHaveClass('custom-content')
      expect(body).toHaveClass('pb-4')
    })
  })
})
