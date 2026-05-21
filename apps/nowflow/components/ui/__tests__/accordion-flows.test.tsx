/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const Items = () => (
  <>
    <AccordionItem value="a">
      <AccordionTrigger>Section A</AccordionTrigger>
      <AccordionContent>Body A</AccordionContent>
    </AccordionItem>
    <AccordionItem value="b">
      <AccordionTrigger>Section B</AccordionTrigger>
      <AccordionContent>Body B</AccordionContent>
    </AccordionItem>
  </>
)

describe('Accordion flows', () => {
  it('single mode: opening B closes A', async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="single" collapsible defaultValue="a">
        <Items />
      </Accordion>
    )

    const triggerA = screen.getByRole('button', { name: 'Section A' })
    const triggerB = screen.getByRole('button', { name: 'Section B' })

    expect(triggerA).toHaveAttribute('aria-expanded', 'true')
    expect(triggerB).toHaveAttribute('aria-expanded', 'false')

    await user.click(triggerB)

    expect(triggerA).toHaveAttribute('aria-expanded', 'false')
    expect(triggerB).toHaveAttribute('aria-expanded', 'true')
  })

  it('multiple mode: both can stay open', async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="multiple" defaultValue={['a']}>
        <Items />
      </Accordion>
    )

    const triggerA = screen.getByRole('button', { name: 'Section A' })
    const triggerB = screen.getByRole('button', { name: 'Section B' })

    await user.click(triggerB)

    expect(triggerA).toHaveAttribute('aria-expanded', 'true')
    expect(triggerB).toHaveAttribute('aria-expanded', 'true')
  })

  it('Space toggles the focused trigger', async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="single" collapsible>
        <Items />
      </Accordion>
    )

    const triggerA = screen.getByRole('button', { name: 'Section A' })
    triggerA.focus()

    await user.keyboard(' ')
    expect(triggerA).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard(' ')
    expect(triggerA).toHaveAttribute('aria-expanded', 'false')
  })

  it('Enter toggles the focused trigger', async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="single" collapsible>
        <Items />
      </Accordion>
    )

    const triggerA = screen.getByRole('button', { name: 'Section A' })
    triggerA.focus()

    await user.keyboard('{Enter}')
    expect(triggerA).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapsible single mode: clicking the open trigger closes it', async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="single" collapsible defaultValue="a">
        <Items />
      </Accordion>
    )

    const triggerA = screen.getByRole('button', { name: 'Section A' })
    expect(triggerA).toHaveAttribute('aria-expanded', 'true')

    await user.click(triggerA)
    expect(triggerA).toHaveAttribute('aria-expanded', 'false')
  })

  it('single non-collapsible mode: clicking the open trigger does not close it', async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="single" defaultValue="a">
        <Items />
      </Accordion>
    )

    const triggerA = screen.getByRole('button', { name: 'Section A' })
    expect(triggerA).toHaveAttribute('aria-expanded', 'true')

    await user.click(triggerA)
    // collapsible=false (default) keeps at least one item open
    expect(triggerA).toHaveAttribute('aria-expanded', 'true')
  })

  it('aria-controls points at the content region', () => {
    render(
      <Accordion type="single" collapsible defaultValue="a">
        <Items />
      </Accordion>
    )

    const triggerA = screen.getByRole('button', { name: 'Section A' })
    const contentId = triggerA.getAttribute('aria-controls')
    expect(contentId).toBeTruthy()
    expect(document.getElementById(contentId!)).toHaveTextContent('Body A')
  })
})
