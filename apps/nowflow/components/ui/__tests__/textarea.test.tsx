/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from '../textarea'

describe('Textarea', () => {
  describe('rendering', () => {
    it('renders a textarea element', () => {
      render(<Textarea data-testid="ta" />)
      const textarea = screen.getByTestId('ta')
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('renders with a placeholder', () => {
      render(<Textarea placeholder="Describe it" />)
      expect(screen.getByPlaceholderText('Describe it')).toBeInTheDocument()
    })

    it('renders with a value', () => {
      render(<Textarea value="existing content" readOnly data-testid="ta" />)
      expect(screen.getByTestId('ta')).toHaveValue('existing content')
    })
  })

  describe('default styling classes', () => {
    it('applies the base editor-field classes', () => {
      render(<Textarea data-testid="ta" />)
      const textarea = screen.getByTestId('ta')
      expect(textarea).toHaveClass('workflow-editor-field')
      expect(textarea).toHaveClass('workflow-editor-textarea-field')
      expect(textarea).toHaveClass('glass-textarea')
    })

    it('applies layout classes including min-height', () => {
      render(<Textarea data-testid="ta" />)
      const textarea = screen.getByTestId('ta')
      expect(textarea).toHaveClass('flex')
      expect(textarea).toHaveClass('min-h-[96px]')
      expect(textarea).toHaveClass('w-full')
    })
  })

  describe('className merging (cn utility)', () => {
    it('merges custom className with base classes', () => {
      render(<Textarea className="custom-ta extra-ta" data-testid="ta" />)
      const textarea = screen.getByTestId('ta')
      expect(textarea).toHaveClass('custom-ta')
      expect(textarea).toHaveClass('extra-ta')
      expect(textarea).toHaveClass('workflow-editor-field')
    })
  })

  describe('style prop', () => {
    it('applies inline styles', () => {
      render(<Textarea data-testid="ta" style={{ resize: 'none' }} />)
      expect(screen.getByTestId('ta')).toHaveStyle({ resize: 'none' })
    })
  })

  describe('prop pass-through', () => {
    it('forwards disabled prop', () => {
      render(<Textarea disabled data-testid="ta" />)
      expect(screen.getByTestId('ta')).toBeDisabled()
    })

    it('forwards readOnly prop', () => {
      render(<Textarea readOnly data-testid="ta" />)
      expect(screen.getByTestId('ta')).toHaveAttribute('readonly')
    })

    it('forwards rows and cols attributes', () => {
      render(<Textarea rows={10} cols={40} data-testid="ta" />)
      const textarea = screen.getByTestId('ta')
      expect(textarea).toHaveAttribute('rows', '10')
      expect(textarea).toHaveAttribute('cols', '40')
    })

    it('forwards name and id props', () => {
      render(<Textarea name="bio" id="bio-field" data-testid="ta" />)
      const textarea = screen.getByTestId('ta')
      expect(textarea).toHaveAttribute('name', 'bio')
      expect(textarea).toHaveAttribute('id', 'bio-field')
    })

    it('forwards aria attributes', () => {
      render(<Textarea aria-label="description" data-testid="ta" />)
      expect(screen.getByLabelText('description')).toBeInTheDocument()
    })

    it('forwards onChange handler', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      render(<Textarea onChange={handleChange} data-testid="ta" />)

      await user.type(screen.getByTestId('ta'), 'x')

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('user events', () => {
    it('allows typing into the textarea', async () => {
      const user = userEvent.setup()
      render(<Textarea data-testid="ta" />)
      const textarea = screen.getByTestId('ta') as HTMLTextAreaElement

      await user.type(textarea, 'multi\nline')

      expect(textarea.value).toBe('multi\nline')
    })

    it('does not accept input when disabled', async () => {
      const user = userEvent.setup()
      render(<Textarea disabled data-testid="ta" />)
      const textarea = screen.getByTestId('ta') as HTMLTextAreaElement

      await user.type(textarea, 'nope')

      expect(textarea.value).toBe('')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the underlying textarea element', () => {
      const ref = React.createRef<HTMLTextAreaElement>()
      render(<Textarea ref={ref} data-testid="ta" />)
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    })
  })

  describe('displayName', () => {
    it('has the correct displayName', () => {
      expect(Textarea.displayName).toBe('Textarea')
    })
  })
})
