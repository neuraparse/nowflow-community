/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from '../checkbox'

describe('Checkbox', () => {
  describe('rendering', () => {
    it('renders with checkbox role', () => {
      render(<Checkbox aria-label="accept" />)
      expect(screen.getByRole('checkbox', { name: 'accept' })).toBeInTheDocument()
    })

    it('renders as unchecked by default', () => {
      render(<Checkbox aria-label="cb" />)
      const cb = screen.getByRole('checkbox', { name: 'cb' })
      expect(cb).toHaveAttribute('data-state', 'unchecked')
      expect(cb).toHaveAttribute('aria-checked', 'false')
    })

    it('applies the base workflow-editor-checkbox class', () => {
      render(<Checkbox aria-label="styled" />)
      expect(screen.getByRole('checkbox', { name: 'styled' })).toHaveClass(
        'workflow-editor-checkbox'
      )
    })
  })

  describe('default values (uncontrolled)', () => {
    it('respects defaultChecked prop', () => {
      render(<Checkbox defaultChecked aria-label="cb" />)
      const cb = screen.getByRole('checkbox', { name: 'cb' })
      expect(cb).toHaveAttribute('data-state', 'checked')
      expect(cb).toHaveAttribute('aria-checked', 'true')
    })

    it('toggles state on click when uncontrolled', async () => {
      const user = userEvent.setup()
      render(<Checkbox aria-label="cb" />)
      const cb = screen.getByRole('checkbox', { name: 'cb' })

      await user.click(cb)
      expect(cb).toHaveAttribute('data-state', 'checked')

      await user.click(cb)
      expect(cb).toHaveAttribute('data-state', 'unchecked')
    })

    it('toggles via keyboard (Space)', async () => {
      const user = userEvent.setup()
      render(<Checkbox aria-label="cb" />)
      const cb = screen.getByRole('checkbox', { name: 'cb' })

      cb.focus()
      expect(cb).toHaveFocus()

      await user.keyboard(' ')
      expect(cb).toHaveAttribute('data-state', 'checked')

      await user.keyboard(' ')
      expect(cb).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('controlled mode', () => {
    it('reflects checked prop value', () => {
      const { rerender } = render(
        <Checkbox checked={false} onCheckedChange={() => {}} aria-label="cb" />
      )
      const cb = screen.getByRole('checkbox', { name: 'cb' })
      expect(cb).toHaveAttribute('data-state', 'unchecked')

      rerender(<Checkbox checked={true} onCheckedChange={() => {}} aria-label="cb" />)
      expect(cb).toHaveAttribute('data-state', 'checked')
    })

    it('does not update its own state without parent update', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Checkbox checked={false} onCheckedChange={onCheckedChange} aria-label="cb" />)
      const cb = screen.getByRole('checkbox', { name: 'cb' })

      await user.click(cb)
      expect(onCheckedChange).toHaveBeenCalledWith(true)
      // still unchecked because parent did not update
      expect(cb).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('onCheckedChange callback', () => {
    it('fires onCheckedChange when clicked', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Checkbox onCheckedChange={onCheckedChange} aria-label="cb" />)

      await user.click(screen.getByRole('checkbox', { name: 'cb' }))
      expect(onCheckedChange).toHaveBeenCalledTimes(1)
      expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it('fires onCheckedChange with false when unchecking', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Checkbox defaultChecked onCheckedChange={onCheckedChange} aria-label="cb" />)

      await user.click(screen.getByRole('checkbox', { name: 'cb' }))
      expect(onCheckedChange).toHaveBeenCalledWith(false)
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute when disabled prop is set', () => {
      render(<Checkbox disabled aria-label="cb" />)
      expect(screen.getByRole('checkbox', { name: 'cb' })).toBeDisabled()
    })

    it('does not fire onCheckedChange when disabled', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Checkbox disabled onCheckedChange={onCheckedChange} aria-label="cb" />)

      await user.click(screen.getByRole('checkbox', { name: 'cb' }))
      expect(onCheckedChange).not.toHaveBeenCalled()
    })
  })

  describe('aria roles/labels', () => {
    it('has role=checkbox', () => {
      render(<Checkbox aria-label="accept" />)
      expect(screen.getByRole('checkbox', { name: 'accept' })).toBeInTheDocument()
    })

    it('forwards aria-labelledby', () => {
      render(
        <>
          <span id="cb-label">Accept terms</span>
          <Checkbox aria-labelledby="cb-label" />
        </>
      )
      expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeInTheDocument()
    })

    it('reflects aria-checked when checked', () => {
      render(<Checkbox defaultChecked aria-label="cb" />)
      expect(screen.getByRole('checkbox', { name: 'cb' })).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('className passthrough', () => {
    it('merges custom className with base classes', () => {
      render(<Checkbox className="custom-class extra" aria-label="cb" />)
      const cb = screen.getByRole('checkbox', { name: 'cb' })
      expect(cb).toHaveClass('custom-class')
      expect(cb).toHaveClass('extra')
      expect(cb).toHaveClass('workflow-editor-checkbox')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to underlying element', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Checkbox ref={ref} aria-label="cb" />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.getAttribute('role')).toBe('checkbox')
    })
  })
})
