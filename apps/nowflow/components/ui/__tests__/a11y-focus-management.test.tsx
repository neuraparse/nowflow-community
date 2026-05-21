/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// jsdom is missing several DOM APIs that Radix uses internally.
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

describe('A11y: focus management', () => {
  describe('Dialog', () => {
    it('traps focus while open and returns to trigger on close', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <button type="button">Action 1</button>
            <button type="button">Action 2</button>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByText('Open dialog')
      trigger.focus()
      expect(trigger).toHaveFocus()

      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const dialog = screen.getByRole('dialog')
      // Focus should have moved inside the dialog once open.
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      })

      // Trap: tab from the last focusable should loop back into the dialog.
      const buttons = screen.getAllByRole('button')
      const lastInDialog = buttons[buttons.length - 1]
      lastInDialog.focus()
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)

      // Close via Escape; focus should return to the trigger.
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('Open dialog')).toHaveFocus()
      })
    })
  })

  describe('AlertDialog', () => {
    it('traps focus while open and returns focus to trigger on close', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>Delete item</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>Cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )

      const trigger = screen.getByText('Delete item')
      trigger.focus()
      expect(trigger).toHaveFocus()

      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      const dialog = screen.getByRole('alertdialog')
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      })

      // Focus should stay trapped across multiple tabs.
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)

      // Close and expect focus back on the trigger.
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('Delete item')).toHaveFocus()
      })
    })
  })

  describe('Sheet', () => {
    it('traps focus while open and returns focus to trigger on close', async () => {
      const user = userEvent.setup()
      render(
        <Sheet>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
              <SheetDescription>Sheet body description</SheetDescription>
            </SheetHeader>
            <button type="button">Inside sheet</button>
          </SheetContent>
        </Sheet>
      )

      const trigger = screen.getByText('Open sheet')
      trigger.focus()
      expect(trigger).toHaveFocus()

      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const dialog = screen.getByRole('dialog')
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      })

      // Trap: tabbing stays inside.
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)

      // Close via Escape; focus should return to the trigger.
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('Open sheet')).toHaveFocus()
      })
    })
  })

  describe('Popover', () => {
    it('moves focus to content when opened via keyboard (Enter on trigger)', async () => {
      const user = userEvent.setup()
      render(
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverContent>
            <button type="button">Inside popover</button>
          </PopoverContent>
        </Popover>
      )

      const trigger = screen.getByText('Open popover')
      trigger.focus()
      expect(trigger).toHaveFocus()

      // Open via keyboard.
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText('Inside popover')).toBeInTheDocument()
      })

      // Focus should have been moved into the popover content.
      const popoverButton = screen.getByRole('button', { name: 'Inside popover' })
      const content = popoverButton.closest('[role="dialog"]') || popoverButton.parentElement
      await waitFor(() => {
        expect(content?.contains(document.activeElement)).toBe(true)
      })
    })
  })

  describe('Tooltip', () => {
    it('reveals content when trigger receives keyboard focus and hides on Escape', async () => {
      const user = userEvent.setup()
      render(
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>Hover me</TooltipTrigger>
            <TooltipContent>Helpful hint</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )

      // Tab to focus the trigger — tooltip should reveal.
      await user.tab()
      await waitFor(() => {
        expect(screen.getAllByText('Helpful hint').length).toBeGreaterThan(0)
      })

      // Escape hides it.
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      })
    })
  })

  describe('DropdownMenu', () => {
    it('focuses first item when opened via keyboard', async () => {
      const user = userEvent.setup()
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>First</DropdownMenuItem>
            <DropdownMenuItem>Second</DropdownMenuItem>
            <DropdownMenuItem>Third</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const trigger = screen.getByText('Open menu')
      trigger.focus()
      expect(trigger).toHaveFocus()

      // Open via keyboard (Enter or Space). Enter should move focus to the first item.
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText('First').closest('[role="menuitem"]')).toHaveFocus()
      })
    })
  })
})
