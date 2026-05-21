/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Badge, badgeVariants } from '../badge'

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children text', () => {
      render(<Badge>New</Badge>)
      expect(screen.getByText('New')).toBeInTheDocument()
    })

    it('renders as a div element', () => {
      render(<Badge data-testid="badge">hello</Badge>)
      expect(screen.getByTestId('badge').tagName).toBe('DIV')
    })
  })

  describe('base classes', () => {
    it('applies base workflow-editor-badge class', () => {
      render(<Badge data-testid="badge">x</Badge>)
      expect(screen.getByTestId('badge')).toHaveClass('workflow-editor-badge')
    })

    it('applies default variant when none is provided', () => {
      render(<Badge data-testid="badge">x</Badge>)
      expect(screen.getByTestId('badge')).toHaveClass('workflow-editor-badge-variant-default')
    })
  })

  describe('variants', () => {
    it('applies default variant class', () => {
      render(
        <Badge data-testid="badge" variant="default">
          x
        </Badge>
      )
      expect(screen.getByTestId('badge')).toHaveClass('workflow-editor-badge-variant-default')
    })

    it('applies secondary variant class', () => {
      render(
        <Badge data-testid="badge" variant="secondary">
          x
        </Badge>
      )
      expect(screen.getByTestId('badge')).toHaveClass('workflow-editor-badge-variant-secondary')
    })

    it('applies destructive variant class', () => {
      render(
        <Badge data-testid="badge" variant="destructive">
          x
        </Badge>
      )
      expect(screen.getByTestId('badge')).toHaveClass('workflow-editor-badge-variant-destructive')
    })

    it('applies outline variant class', () => {
      render(
        <Badge data-testid="badge" variant="outline">
          x
        </Badge>
      )
      expect(screen.getByTestId('badge')).toHaveClass('workflow-editor-badge-variant-outline')
    })
  })

  describe('className merging', () => {
    it('merges custom className with variant classes', () => {
      render(
        <Badge data-testid="badge" className="custom-badge extra">
          x
        </Badge>
      )
      const el = screen.getByTestId('badge')
      expect(el).toHaveClass('custom-badge')
      expect(el).toHaveClass('extra')
      expect(el).toHaveClass('workflow-editor-badge')
    })
  })

  describe('prop pass-through', () => {
    it('forwards arbitrary data attributes', () => {
      render(<Badge data-testid="badge-x">x</Badge>)
      expect(screen.getByTestId('badge-x')).toBeInTheDocument()
    })

    it('forwards aria attributes', () => {
      render(<Badge aria-label="status-badge">x</Badge>)
      expect(screen.getByLabelText('status-badge')).toBeInTheDocument()
    })
  })

  describe('badgeVariants export', () => {
    it('returns a className string for given variant', () => {
      const cls = badgeVariants({ variant: 'outline' })
      expect(typeof cls).toBe('string')
      expect(cls).toContain('workflow-editor-badge-variant-outline')
    })

    it('returns default variant className when variant omitted', () => {
      const cls = badgeVariants({})
      expect(cls).toContain('workflow-editor-badge-variant-default')
    })
  })
})
