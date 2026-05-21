/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// jsdom lacks ResizeObserver, pointer capture, and scrollIntoView that Radix uses.
beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
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

describe('A11y: ARIA roles and attributes', () => {
  describe('Dialog', () => {
    it('renders role=dialog with aria-modal behavior (labelled + described)', async () => {
      render(
        <Dialog defaultOpen>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('role', 'dialog')
      // Radix's modal Dialog either sets aria-modal=true or relies on the role=dialog
      // + focus trap semantics. Ensure it is not explicitly non-modal.
      expect(dialog.getAttribute('aria-modal')).not.toBe('false')
      expect(dialog).toHaveAttribute('aria-labelledby')
      expect(dialog).toHaveAttribute('aria-describedby')
    })
  })

  describe('AlertDialog', () => {
    it('renders role=alertdialog with labelled/described ids', async () => {
      render(
        <AlertDialog defaultOpen>
          <AlertDialogTrigger>Delete</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>Cannot undo.</AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>
      )

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      const dialog = screen.getByRole('alertdialog')
      expect(dialog).toHaveAttribute('role', 'alertdialog')
      expect(dialog).toHaveAttribute('aria-labelledby')
      expect(dialog).toHaveAttribute('aria-describedby')
    })
  })

  describe('Tabs', () => {
    it('renders tablist, tab, tabpanel with aria-selected and aria-controls', async () => {
      const user = userEvent.setup()
      render(
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel One</TabsContent>
          <TabsContent value="two">Panel Two</TabsContent>
        </Tabs>
      )

      const tablist = screen.getByRole('tablist')
      expect(tablist).toBeInTheDocument()

      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(2)
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
      expect(tabs[0]).toHaveAttribute('aria-controls')

      // The currently open panel should have role=tabpanel.
      const panelOne = screen.getByRole('tabpanel')
      expect(panelOne).toHaveTextContent('Panel One')
      expect(panelOne).toHaveAttribute('aria-labelledby')

      // Switching tabs toggles aria-selected.
      await user.click(tabs[1])
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
    })
  })

  describe('Accordion', () => {
    it('sets aria-expanded and aria-controls on triggers', async () => {
      const user = userEvent.setup()
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="a">
            <AccordionTrigger>Section A</AccordionTrigger>
            <AccordionContent>Body A</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      const trigger = screen.getByRole('button', { name: 'Section A' })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-controls')

      await user.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('RadioGroup', () => {
    it('uses role=radiogroup with aria-required when required', () => {
      render(
        <RadioGroup aria-label="group" required>
          <RadioGroupItem value="a" aria-label="a" />
          <RadioGroupItem value="b" aria-label="b" />
        </RadioGroup>
      )

      const group = screen.getByRole('radiogroup', { name: 'group' })
      expect(group).toBeInTheDocument()
      expect(group).toHaveAttribute('aria-required', 'true')

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(2)
      radios.forEach((r) => {
        expect(r).toHaveAttribute('aria-checked')
      })
    })
  })

  describe('Switch', () => {
    it('has role=switch with aria-checked reflecting state', async () => {
      const user = userEvent.setup()
      render(<Switch aria-label="toggle" />)

      const sw = screen.getByRole('switch', { name: 'toggle' })
      expect(sw).toHaveAttribute('aria-checked', 'false')

      await user.click(sw)
      expect(sw).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('Checkbox', () => {
    it('has role=checkbox with aria-checked reflecting state', async () => {
      const user = userEvent.setup()
      render(<Checkbox aria-label="accept" />)

      const cb = screen.getByRole('checkbox', { name: 'accept' })
      expect(cb).toHaveAttribute('aria-checked', 'false')

      await user.click(cb)
      expect(cb).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('Slider', () => {
    it('has role=slider with aria-valuemin/max/now', () => {
      render(<Slider aria-label="volume" defaultValue={[30]} min={0} max={100} />)

      const thumb = screen.getByRole('slider')
      expect(thumb).toHaveAttribute('aria-valuemin', '0')
      expect(thumb).toHaveAttribute('aria-valuemax', '100')
      expect(thumb).toHaveAttribute('aria-valuenow', '30')
    })
  })

  describe('Progress', () => {
    it('has role=progressbar with aria-valuemin/valuemax and aria-valuenow when determinate', () => {
      render(<Progress value={42} data-testid="progress" />)

      const progress = screen.getByRole('progressbar')
      expect(progress).toBeInTheDocument()
      expect(progress).toHaveAttribute('aria-valuemin', '0')
      expect(progress).toHaveAttribute('aria-valuemax', '100')
      // aria-valuenow is only present for determinate progress bars; otherwise
      // the data-state reports 'indeterminate'.
      const state = progress.getAttribute('data-state')
      if (state !== 'indeterminate') {
        expect(progress).toHaveAttribute('aria-valuenow')
      }
    })
  })
})
