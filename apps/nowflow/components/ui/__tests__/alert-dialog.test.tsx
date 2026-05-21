/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
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

type HarnessProps = {
  defaultOpen?: boolean
  contentClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  actionClassName?: string
  cancelClassName?: string
  onAction?: () => void
  onCancel?: () => void
}

const renderAlertDialog = (props: HarnessProps = {}) => {
  const {
    defaultOpen = false,
    contentClassName,
    titleClassName,
    descriptionClassName,
    actionClassName,
    cancelClassName,
    onAction,
    onCancel,
  } = props

  return render(
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger>Delete</AlertDialogTrigger>
      <AlertDialogContent className={contentClassName}>
        <AlertDialogHeader>
          <AlertDialogTitle className={titleClassName}>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription className={descriptionClassName}>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={cancelClassName} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction className={actionClassName} onClick={onAction}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

describe('AlertDialog', () => {
  it('does not render content before the trigger is clicked', () => {
    renderAlertDialog()
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
  })

  it('opens when the trigger is clicked', async () => {
    const user = userEvent.setup()
    renderAlertDialog()

    await user.click(screen.getByText('Delete'))

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    })
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('renders content inside a portal (outside the component container)', async () => {
    const user = userEvent.setup()
    const { container } = renderAlertDialog()

    await user.click(screen.getByText('Delete'))

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    })

    expect(container.contains(screen.getByText('Are you sure?'))).toBe(false)
  })

  it('has alertdialog role and proper aria attributes when open', async () => {
    renderAlertDialog({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-describedby')
  })

  it('closes when the cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    renderAlertDialog({ defaultOpen: true, onCancel })

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
    })
  })

  it('closes when the action button is clicked', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    renderAlertDialog({ defaultOpen: true, onAction })

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
    })
  })

  it('closes when the Escape key is pressed', async () => {
    const user = userEvent.setup()
    renderAlertDialog({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
    })
  })

  it('passes className through to content, title, description, action, and cancel', async () => {
    renderAlertDialog({
      defaultOpen: true,
      contentClassName: 'custom-content',
      titleClassName: 'custom-title',
      descriptionClassName: 'custom-description',
      actionClassName: 'custom-action',
      cancelClassName: 'custom-cancel',
    })

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    expect(screen.getByRole('alertdialog')).toHaveClass('custom-content')
    expect(screen.getByText('Are you sure?')).toHaveClass('custom-title')
    expect(screen.getByText('This action cannot be undone.')).toHaveClass('custom-description')
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('custom-action')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('custom-cancel')
  })
})
