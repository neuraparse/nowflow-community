/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, buttonVariants } from '../button'

describe('Button', () => {
  describe('rendering', () => {
    it('renders children text', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('renders as a native button element by default', () => {
      render(<Button>Default</Button>)
      const btn = screen.getByRole('button', { name: 'Default' })
      expect(btn.tagName).toBe('BUTTON')
    })

    it('renders as a child element when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/home">Go home</a>
        </Button>
      )
      const link = screen.getByRole('link', { name: 'Go home' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/home')
    })
  })

  describe('default styling classes', () => {
    it('applies base workflow-editor-button-base class', () => {
      render(<Button>Styled</Button>)
      const btn = screen.getByRole('button', { name: 'Styled' })
      expect(btn).toHaveClass('workflow-editor-button-base')
    })

    it('applies default variant and size when none provided', () => {
      render(<Button>Default</Button>)
      const btn = screen.getByRole('button', { name: 'Default' })
      expect(btn).toHaveClass('workflow-editor-button-variant-default')
      expect(btn).toHaveClass('h-10')
      expect(btn).toHaveClass('px-4')
      expect(btn).toHaveClass('py-2')
    })
  })

  describe('variants', () => {
    it('applies default variant classes', () => {
      render(<Button variant="default">V</Button>)
      expect(screen.getByRole('button')).toHaveClass('workflow-editor-button-variant-default')
    })

    it('applies destructive variant classes', () => {
      render(<Button variant="destructive">V</Button>)
      expect(screen.getByRole('button')).toHaveClass('workflow-editor-button-variant-destructive')
    })

    it('applies outline variant classes', () => {
      render(<Button variant="outline">V</Button>)
      expect(screen.getByRole('button')).toHaveClass('workflow-editor-button-variant-outline')
    })

    it('applies secondary variant classes', () => {
      render(<Button variant="secondary">V</Button>)
      expect(screen.getByRole('button')).toHaveClass('workflow-editor-button-variant-secondary')
    })

    it('applies ghost variant classes', () => {
      render(<Button variant="ghost">V</Button>)
      expect(screen.getByRole('button')).toHaveClass('workflow-editor-button-variant-ghost')
    })

    it('applies link variant classes', () => {
      render(<Button variant="link">V</Button>)
      expect(screen.getByRole('button')).toHaveClass('workflow-editor-button-variant-link')
    })
  })

  describe('sizes', () => {
    it('applies default size classes', () => {
      render(<Button size="default">S</Button>)
      const btn = screen.getByRole('button')
      expect(btn).toHaveClass('h-10')
      expect(btn).toHaveClass('px-4')
      expect(btn).toHaveClass('py-2')
    })

    it('applies sm size classes', () => {
      render(<Button size="sm">S</Button>)
      const btn = screen.getByRole('button')
      expect(btn).toHaveClass('h-9')
      expect(btn).toHaveClass('px-3')
    })

    it('applies lg size classes', () => {
      render(<Button size="lg">S</Button>)
      const btn = screen.getByRole('button')
      expect(btn).toHaveClass('h-11')
      expect(btn).toHaveClass('px-8')
    })

    it('applies icon size classes', () => {
      render(<Button size="icon" aria-label="icon-btn" />)
      const btn = screen.getByRole('button', { name: 'icon-btn' })
      expect(btn).toHaveClass('h-10')
      expect(btn).toHaveClass('w-10')
    })
  })

  describe('className merging (cn utility)', () => {
    it('merges custom className with variant classes', () => {
      render(<Button className="custom-class extra">Merge</Button>)
      const btn = screen.getByRole('button', { name: 'Merge' })
      expect(btn).toHaveClass('custom-class')
      expect(btn).toHaveClass('extra')
      expect(btn).toHaveClass('workflow-editor-button-base')
    })
  })

  describe('prop pass-through', () => {
    it('forwards disabled prop', () => {
      render(<Button disabled>Off</Button>)
      const btn = screen.getByRole('button', { name: 'Off' })
      expect(btn).toBeDisabled()
    })

    it('forwards type attribute', () => {
      render(<Button type="submit">Submit</Button>)
      expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit')
    })

    it('forwards arbitrary data attributes', () => {
      render(<Button data-testid="btn-1">X</Button>)
      expect(screen.getByTestId('btn-1')).toBeInTheDocument()
    })

    it('forwards aria attributes', () => {
      render(<Button aria-label="close">X</Button>)
      expect(screen.getByLabelText('close')).toBeInTheDocument()
    })
  })

  describe('user events', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(<Button onClick={handleClick}>Click</Button>)

      await user.click(screen.getByRole('button', { name: 'Click' }))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(
        <Button onClick={handleClick} disabled>
          Click
        </Button>
      )

      await user.click(screen.getByRole('button', { name: 'Click' }))

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the underlying button element', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Button ref={ref}>With ref</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
      expect(ref.current?.textContent).toBe('With ref')
    })
  })

  describe('displayName', () => {
    it('has the correct displayName', () => {
      expect(Button.displayName).toBe('Button')
    })
  })

  describe('buttonVariants export', () => {
    it('returns a className string for given variant/size', () => {
      const cls = buttonVariants({ variant: 'outline', size: 'lg' })
      expect(typeof cls).toBe('string')
      expect(cls).toContain('workflow-editor-button-variant-outline')
      expect(cls).toContain('h-11')
    })
  })
})
