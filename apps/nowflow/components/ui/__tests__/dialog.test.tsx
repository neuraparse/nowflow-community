/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const renderDialog = (
  options: {
    defaultOpen?: boolean
    hideCloseButton?: boolean
    contentClassName?: string
    titleClassName?: string
    descriptionClassName?: string
  } = {}
) => {
  const {
    defaultOpen = false,
    hideCloseButton = false,
    contentClassName,
    titleClassName,
    descriptionClassName,
  } = options

  return render(
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger>Open dialog</DialogTrigger>
      <DialogContent className={contentClassName} hideCloseButton={hideCloseButton}>
        <DialogHeader>
          <DialogTitle className={titleClassName}>Dialog Title</DialogTitle>
          <DialogDescription className={descriptionClassName}>
            Dialog description text
          </DialogDescription>
        </DialogHeader>
        <div>Dialog body content</div>
        <DialogFooter>
          <button type="button">Confirm</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('does not show content before trigger is clicked', () => {
    renderDialog()
    expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument()
    expect(screen.queryByText('Dialog body content')).not.toBeInTheDocument()
  })

  it('opens the dialog when the trigger is clicked', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByText('Open dialog'))

    await waitFor(() => {
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })
    expect(screen.getByText('Dialog description text')).toBeInTheDocument()
    expect(screen.getByText('Dialog body content')).toBeInTheDocument()
  })

  it('renders content inside a portal (outside the trigger container)', async () => {
    const user = userEvent.setup()
    const { container } = renderDialog()

    await user.click(screen.getByText('Open dialog'))

    await waitFor(() => {
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    // The rendered content lives outside the component's container when portalled.
    expect(container.contains(screen.getByText('Dialog Title'))).toBe(false)
  })

  it('renders accessible role and aria attributes when open', async () => {
    renderDialog({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-describedby')
  })

  it('closes via the built-in close button', async () => {
    const user = userEvent.setup()
    renderDialog({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    const closeButton = screen.getByRole('button', { name: /close/i })
    expect(closeButton).toBeInTheDocument()
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument()
    })
  })

  it('closes when the Escape key is pressed', async () => {
    const user = userEvent.setup()
    renderDialog({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument()
    })
  })

  it('hides the close button when hideCloseButton is true', async () => {
    renderDialog({ defaultOpen: true, hideCloseButton: true })

    await waitFor(() => {
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  it('passes className through to content, title, and description', async () => {
    renderDialog({
      defaultOpen: true,
      contentClassName: 'custom-content',
      titleClassName: 'custom-title',
      descriptionClassName: 'custom-description',
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog')).toHaveClass('custom-content')
    expect(screen.getByText('Dialog Title')).toHaveClass('custom-title')
    expect(screen.getByText('Dialog description text')).toHaveClass('custom-description')
  })

  it('renders DialogHeader and DialogFooter children', async () => {
    renderDialog({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })
})
