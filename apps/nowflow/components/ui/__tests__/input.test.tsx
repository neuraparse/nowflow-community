/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<Input data-testid="inp" />)
      const input = screen.getByTestId('inp')
      expect(input.tagName).toBe('INPUT')
    })

    it('renders with a placeholder', () => {
      render(<Input placeholder="Enter your name" />)
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
    })

    it('uses the provided type attribute', () => {
      render(<Input type="email" data-testid="email" />)
      expect(screen.getByTestId('email')).toHaveAttribute('type', 'email')
    })

    it('uses the provided value', () => {
      render(<Input value="hello" readOnly data-testid="inp" />)
      expect(screen.getByTestId('inp')).toHaveValue('hello')
    })
  })

  describe('default attributes', () => {
    it('defaults autoComplete to "off"', () => {
      render(<Input data-testid="inp" />)
      expect(screen.getByTestId('inp')).toHaveAttribute('autocomplete', 'off')
    })

    it('allows autoComplete to be overridden', () => {
      render(<Input data-testid="inp" autoComplete="email" />)
      expect(screen.getByTestId('inp')).toHaveAttribute('autocomplete', 'email')
    })

    it('sets autoCorrect, autoCapitalize and spellCheck for editor-style input', () => {
      render(<Input data-testid="inp" />)
      const input = screen.getByTestId('inp')
      expect(input).toHaveAttribute('autocorrect', 'off')
      expect(input).toHaveAttribute('autocapitalize', 'none')
      expect(input).toHaveAttribute('spellcheck', 'false')
    })
  })

  describe('default styling classes', () => {
    it('applies the base editor-field classes', () => {
      render(<Input data-testid="inp" />)
      const input = screen.getByTestId('inp')
      expect(input).toHaveClass('workflow-editor-field')
      expect(input).toHaveClass('workflow-editor-input-field')
      expect(input).toHaveClass('glass-field')
    })

    it('applies layout classes', () => {
      render(<Input data-testid="inp" />)
      const input = screen.getByTestId('inp')
      expect(input).toHaveClass('flex')
      expect(input).toHaveClass('h-10')
      expect(input).toHaveClass('w-full')
    })
  })

  describe('className merging (cn utility)', () => {
    it('merges custom className with base classes', () => {
      render(<Input className="my-custom-class another" data-testid="inp" />)
      const input = screen.getByTestId('inp')
      expect(input).toHaveClass('my-custom-class')
      expect(input).toHaveClass('another')
      expect(input).toHaveClass('workflow-editor-field')
    })
  })

  describe('style prop', () => {
    it('applies inline styles', () => {
      render(<Input data-testid="inp" style={{ backgroundColor: 'rgb(255, 0, 0)' }} />)
      expect(screen.getByTestId('inp')).toHaveStyle({ backgroundColor: 'rgb(255, 0, 0)' })
    })
  })

  describe('prop pass-through', () => {
    it('forwards disabled prop', () => {
      render(<Input disabled data-testid="inp" />)
      expect(screen.getByTestId('inp')).toBeDisabled()
    })

    it('forwards readOnly prop', () => {
      render(<Input readOnly data-testid="inp" />)
      expect(screen.getByTestId('inp')).toHaveAttribute('readonly')
    })

    it('forwards name and id props', () => {
      render(<Input name="username" id="username-input" data-testid="inp" />)
      const input = screen.getByTestId('inp')
      expect(input).toHaveAttribute('name', 'username')
      expect(input).toHaveAttribute('id', 'username-input')
    })

    it('forwards aria attributes', () => {
      render(<Input aria-label="search" data-testid="inp" />)
      expect(screen.getByLabelText('search')).toBeInTheDocument()
    })

    it('forwards onChange handler', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      render(<Input onChange={handleChange} data-testid="inp" />)

      await user.type(screen.getByTestId('inp'), 'a')

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('user events', () => {
    it('allows typing into the input', async () => {
      const user = userEvent.setup()
      render(<Input data-testid="inp" />)
      const input = screen.getByTestId('inp') as HTMLInputElement

      await user.type(input, 'hello world')

      expect(input).toHaveValue('hello world')
    })

    it('does not accept input when disabled', async () => {
      const user = userEvent.setup()
      render(<Input disabled data-testid="inp" />)
      const input = screen.getByTestId('inp') as HTMLInputElement

      await user.type(input, 'abc')

      expect(input).toHaveValue('')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the underlying input element', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} data-testid="inp" />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })
  })

  describe('displayName', () => {
    it('has the correct displayName', () => {
      expect(Input.displayName).toBe('Input')
    })
  })
})
