/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Skeleton } from '../skeleton'

describe('Skeleton', () => {
  describe('rendering', () => {
    it('renders as a div', () => {
      render(<Skeleton data-testid="skeleton" />)
      expect(screen.getByTestId('skeleton').tagName).toBe('DIV')
    })

    it('renders children inside', () => {
      render(
        <Skeleton data-testid="skeleton">
          <span>inner</span>
        </Skeleton>
      )
      expect(screen.getByText('inner')).toBeInTheDocument()
    })
  })

  describe('base classes', () => {
    it('applies base workflow-editor-skeleton class', () => {
      render(<Skeleton data-testid="skeleton" />)
      expect(screen.getByTestId('skeleton')).toHaveClass('workflow-editor-skeleton')
    })

    it('applies animate-pulse class', () => {
      render(<Skeleton data-testid="skeleton" />)
      expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse')
    })

    it('applies rounded-md and bg-muted classes', () => {
      render(<Skeleton data-testid="skeleton" />)
      const el = screen.getByTestId('skeleton')
      expect(el).toHaveClass('rounded-md')
      expect(el).toHaveClass('bg-muted')
    })
  })

  describe('className passthrough', () => {
    it('merges custom className with base classes', () => {
      render(<Skeleton data-testid="skeleton" className="h-4 w-20 custom" />)
      const el = screen.getByTestId('skeleton')
      expect(el).toHaveClass('h-4')
      expect(el).toHaveClass('w-20')
      expect(el).toHaveClass('custom')
      expect(el).toHaveClass('animate-pulse')
    })
  })

  describe('prop pass-through', () => {
    it('forwards arbitrary data attributes', () => {
      render(<Skeleton data-testid="skeleton-x" data-foo="bar" />)
      expect(screen.getByTestId('skeleton-x')).toHaveAttribute('data-foo', 'bar')
    })

    it('forwards aria attributes', () => {
      render(<Skeleton aria-label="loading" />)
      expect(screen.getByLabelText('loading')).toBeInTheDocument()
    })

    it('forwards inline style', () => {
      render(<Skeleton data-testid="skeleton" style={{ width: 120 }} />)
      const el = screen.getByTestId('skeleton') as HTMLDivElement
      expect(el.style.width).toBe('120px')
    })
  })
})
