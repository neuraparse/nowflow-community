/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

describe('Dialog flows', () => {
  it('opens, tabs into content, submits form inside, closes via action button', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())

    const Harness = () => {
      const [open, setOpen] = React.useState(false)
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create item</DialogTitle>
              <DialogDescription>Provide a name</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                onSubmit(e)
                setOpen(false)
              }}
            >
              <input aria-label="Name" placeholder="name" />
              <DialogFooter>
                <button type="submit">Save</button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )
    }

    render(<Harness />)

    const trigger = screen.getByText('Open')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const input = screen.getByLabelText('Name') as HTMLInputElement
    await user.click(input)
    await user.keyboard('widget')
    expect(input.value).toBe('widget')

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    await user.click(saveBtn)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('escape closes and returns focus to trigger', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Launch</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thing</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
          <p>Body</p>
        </DialogContent>
      </Dialog>
    )

    const trigger = screen.getByText('Launch')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })
  })

  it('clicking the backdrop (overlay pointer-down outside content) closes the dialog', async () => {
    const user = userEvent.setup()

    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
          <p>Body</p>
        </DialogContent>
      </Dialog>
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Radix closes on pointer-down-outside. Dispatch the event on the overlay.
    const overlay = document.querySelector('.workflow-editor-overlay') as HTMLElement
    expect(overlay).toBeTruthy()
    await user.pointer({ target: overlay, keys: '[MouseLeft]' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('tab order moves from a before-trigger to trigger to inside-dialog controls when open', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <button type="button">Before</button>
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
              <DialogDescription>Desc</DialogDescription>
            </DialogHeader>
            <button type="button">First inside</button>
            <button type="button">Second inside</button>
          </DialogContent>
        </Dialog>
        <button type="button">After</button>
      </div>
    )

    const before = screen.getByRole('button', { name: 'Before' })
    before.focus()
    expect(before).toHaveFocus()

    await user.tab()
    expect(screen.getByText('Open')).toHaveFocus()

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Focus should be trapped inside the dialog — tabbing cycles through dialog controls.
    await user.tab()
    const active = document.activeElement as HTMLElement
    expect(screen.getByRole('dialog').contains(active)).toBe(true)
  })

  it('wires aria-labelledby and aria-describedby to title and description ids', async () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accessible title</DialogTitle>
            <DialogDescription>Accessible description</DialogDescription>
          </DialogHeader>
          <p>Body</p>
        </DialogContent>
      </Dialog>
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    const describedBy = dialog.getAttribute('aria-describedby')

    expect(labelledBy).toBeTruthy()
    expect(describedBy).toBeTruthy()

    const titleNode = document.getElementById(labelledBy as string)
    const descNode = document.getElementById(describedBy as string)
    expect(titleNode).toHaveTextContent('Accessible title')
    expect(descNode).toHaveTextContent('Accessible description')
  })

  it('does not open when the trigger is disabled', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger disabled>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Should not show</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
          <p>Body</p>
        </DialogContent>
      </Dialog>
    )

    const trigger = screen.getByText('Open')
    expect(trigger).toBeDisabled()

    await user.click(trigger)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Should not show')).not.toBeInTheDocument()
  })

  it('closes via a DialogClose inside the footer', async () => {
    const user = userEvent.setup()

    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>Dismiss</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Dismiss'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
