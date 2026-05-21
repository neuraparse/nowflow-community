/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Separator } from '../separator'

describe('Separator', () => {
  describe('rendering', () => {
    it('renders a separator element', () => {
      render(<Separator data-testid="sep" />)
      expect(screen.getByTestId('sep')).toBeInTheDocument()
    })

    it('applies base workflow-editor-separator class', () => {
      render(<Separator data-testid="sep" />)
      expect(screen.getByTestId('sep')).toHaveClass('workflow-editor-separator')
    })
  })

  describe('orientation', () => {
    it('defaults to horizontal orientation (h-[1px] w-full)', () => {
      render(<Separator data-testid="sep" />)
      const el = screen.getByTestId('sep')
      expect(el).toHaveClass('h-[1px]')
      expect(el).toHaveClass('w-full')
      expect(el).toHaveAttribute('data-orientation', 'horizontal')
    })

    it('applies vertical classes when orientation="vertical"', () => {
      render(<Separator data-testid="sep" orientation="vertical" />)
      const el = screen.getByTestId('sep')
      expect(el).toHaveClass('h-full')
      expect(el).toHaveClass('w-[1px]')
      expect(el).toHaveAttribute('data-orientation', 'vertical')
    })
  })

  describe('aria role (decorative vs non-decorative)', () => {
    it('is decorative by default (no role="separator")', () => {
      render(<Separator data-testid="sep" />)
      // When decorative, Radix sets role="none" (not separator)
      const el = screen.getByTestId('sep')
      expect(el).toHaveAttribute('role', 'none')
    })

    it('has role="separator" when decorative is false', () => {
      render(<Separator decorative={false} />)
      const el = screen.getByRole('separator')
      expect(el).toBeInTheDocument()
    })

    it('exposes aria-orientation for non-decorative vertical separator', () => {
      render(<Separator decorative={false} orientation="vertical" />)
      const el = screen.getByRole('separator')
      expect(el).toHaveAttribute('aria-orientation', 'vertical')
    })
  })

  describe('className passthrough', () => {
    it('merges custom className', () => {
      render(<Separator data-testid="sep" className="my-sep extra" />)
      const el = screen.getByTestId('sep')
      expect(el).toHaveClass('my-sep')
      expect(el).toHaveClass('extra')
      expect(el).toHaveClass('workflow-editor-separator')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the underlying element', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Separator ref={ref} data-testid="sep" />)
      expect(ref.current).not.toBeNull()
    })
  })
})
