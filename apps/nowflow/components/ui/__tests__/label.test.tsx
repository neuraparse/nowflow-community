/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Label } from '../label'

describe('Label', () => {
  describe('rendering', () => {
    it('renders a label element with text', () => {
      render(<Label>Email address</Label>)
      const label = screen.getByText('Email address')
      expect(label).toBeInTheDocument()
      expect(label.tagName).toBe('LABEL')
    })

    it('renders children nodes', () => {
      render(
        <Label>
          <span data-testid="child">Required</span>
        </Label>
      )
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  describe('default styling classes', () => {
    it('applies the workflow-editor-label class', () => {
      render(<Label data-testid="lbl">Name</Label>)
      expect(screen.getByTestId('lbl')).toHaveClass('workflow-editor-label')
    })

    it('applies typographic classes', () => {
      render(<Label data-testid="lbl">Name</Label>)
      const label = screen.getByTestId('lbl')
      expect(label).toHaveClass('text-sm')
      expect(label).toHaveClass('font-medium')
      expect(label).toHaveClass('leading-none')
    })
  })

  describe('className merging (cn utility)', () => {
    it('merges custom className with base classes', () => {
      render(
        <Label className="custom-label extra-class" data-testid="lbl">
          Label
        </Label>
      )
      const label = screen.getByTestId('lbl')
      expect(label).toHaveClass('custom-label')
      expect(label).toHaveClass('extra-class')
      expect(label).toHaveClass('workflow-editor-label')
    })
  })

  describe('prop pass-through', () => {
    it('forwards htmlFor prop to the label element', () => {
      render(
        <Label htmlFor="email-input" data-testid="lbl">
          Email
        </Label>
      )
      expect(screen.getByTestId('lbl')).toHaveAttribute('for', 'email-input')
    })

    it('forwards id prop', () => {
      render(
        <Label id="my-label" data-testid="lbl">
          Label
        </Label>
      )
      expect(screen.getByTestId('lbl')).toHaveAttribute('id', 'my-label')
    })

    it('forwards arbitrary data attributes', () => {
      render(<Label data-testid="my-label">Hello</Label>)
      expect(screen.getByTestId('my-label')).toBeInTheDocument()
    })
  })

  describe('association with inputs', () => {
    it('focuses the associated input when clicked via htmlFor', async () => {
      const user = userEvent.setup()
      render(
        <>
          <Label htmlFor="my-input">Click me</Label>
          <input id="my-input" data-testid="inp" />
        </>
      )

      await user.click(screen.getByText('Click me'))

      expect(screen.getByTestId('inp')).toHaveFocus()
    })
  })

  describe('user events', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(
        <Label onClick={handleClick} data-testid="lbl">
          Click
        </Label>
      )

      await user.click(screen.getByTestId('lbl'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the underlying label element', () => {
      const ref = React.createRef<HTMLLabelElement>()
      render(
        <Label ref={ref} data-testid="lbl">
          With ref
        </Label>
      )
      expect(ref.current).toBeInstanceOf(HTMLLabelElement)
      expect(ref.current?.textContent).toBe('With ref')
    })
  })

  describe('displayName', () => {
    it('has a displayName set', () => {
      expect(Label.displayName).toBeDefined()
    })
  })
})
