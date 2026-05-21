/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type HarnessProps = {
  defaultOpen?: boolean
  side?: 'top' | 'bottom' | 'left' | 'right'
  contentClassName?: string
  titleClassName?: string
  descriptionClassName?: string
}

const renderSheet = (props: HarnessProps = {}) => {
  const {
    defaultOpen = false,
    side,
    contentClassName,
    titleClassName,
    descriptionClassName,
  } = props

  return render(
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger>Open sheet</SheetTrigger>
      <SheetContent side={side} className={contentClassName}>
        <SheetHeader>
          <SheetTitle className={titleClassName}>Sheet Title</SheetTitle>
          <SheetDescription className={descriptionClassName}>
            Sheet description text
          </SheetDescription>
        </SheetHeader>
        <div>Sheet body content</div>
        <SheetFooter>
          <button type="button">Save</button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

describe('Sheet', () => {
  it('does not render content before trigger is clicked', () => {
    renderSheet()
    expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument()
    expect(screen.queryByText('Sheet body content')).not.toBeInTheDocument()
  })

  it('opens when the trigger is clicked', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByText('Open sheet'))

    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument()
    })
    expect(screen.getByText('Sheet description text')).toBeInTheDocument()
    expect(screen.getByText('Sheet body content')).toBeInTheDocument()
  })

  it('renders content inside a portal (outside the component container)', async () => {
    const user = userEvent.setup()
    const { container } = renderSheet()

    await user.click(screen.getByText('Open sheet'))

    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument()
    })

    expect(container.contains(screen.getByText('Sheet Title'))).toBe(false)
  })

  it('has dialog role and aria attributes when open', async () => {
    renderSheet({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-describedby')
  })

  it('renders close button with accessible "Close" label', async () => {
    renderSheet({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    renderSheet({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /close/i }))

    await waitFor(() => {
      expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument()
    })
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderSheet({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument()
    })
  })

  it('applies the default "right" side variant class', async () => {
    renderSheet({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog').className).toMatch(/right-0/)
  })

  it('applies the "left" side variant class when side="left"', async () => {
    renderSheet({ defaultOpen: true, side: 'left' })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog').className).toMatch(/left-0/)
  })

  it('applies the "top" side variant class when side="top"', async () => {
    renderSheet({ defaultOpen: true, side: 'top' })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog').className).toMatch(/top-0/)
  })

  it('applies the "bottom" side variant class when side="bottom"', async () => {
    renderSheet({ defaultOpen: true, side: 'bottom' })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog').className).toMatch(/bottom-0/)
  })

  it('passes className through to content, title, and description', async () => {
    renderSheet({
      defaultOpen: true,
      contentClassName: 'custom-content',
      titleClassName: 'custom-title',
      descriptionClassName: 'custom-description',
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog')).toHaveClass('custom-content')
    expect(screen.getByText('Sheet Title')).toHaveClass('custom-title')
    expect(screen.getByText('Sheet description text')).toHaveClass('custom-description')
  })

  it('renders header and footer children', async () => {
    renderSheet({ defaultOpen: true })

    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})
