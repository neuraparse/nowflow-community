/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from '../switch'

describe('Switch', () => {
  describe('rendering', () => {
    it('renders with switch role', () => {
      render(<Switch aria-label="toggle" />)
      expect(screen.getByRole('switch', { name: 'toggle' })).toBeInTheDocument()
    })

    it('renders as unchecked by default', () => {
      render(<Switch aria-label="toggle" />)
      const sw = screen.getByRole('switch', { name: 'toggle' })
      expect(sw).toHaveAttribute('data-state', 'unchecked')
      expect(sw).toHaveAttribute('aria-checked', 'false')
    })

    it('applies the base workflow-editor-switch class', () => {
      render(<Switch aria-label="toggle" />)
      expect(screen.getByRole('switch', { name: 'toggle' })).toHaveClass('workflow-editor-switch')
    })
  })

  describe('default values (uncontrolled)', () => {
    it('respects defaultChecked prop', () => {
      render(<Switch defaultChecked aria-label="toggle" />)
      const sw = screen.getByRole('switch', { name: 'toggle' })
      expect(sw).toHaveAttribute('data-state', 'checked')
      expect(sw).toHaveAttribute('aria-checked', 'true')
    })

    it('toggles state on click', async () => {
      const user = userEvent.setup()
      render(<Switch aria-label="toggle" />)
      const sw = screen.getByRole('switch', { name: 'toggle' })

      await user.click(sw)
      expect(sw).toHaveAttribute('data-state', 'checked')

      await user.click(sw)
      expect(sw).toHaveAttribute('data-state', 'unchecked')
    })

    it('toggles via keyboard (Space)', async () => {
      const user = userEvent.setup()
      render(<Switch aria-label="toggle" />)
      const sw = screen.getByRole('switch', { name: 'toggle' })

      sw.focus()
      expect(sw).toHaveFocus()

      await user.keyboard(' ')
      expect(sw).toHaveAttribute('data-state', 'checked')

      await user.keyboard(' ')
      expect(sw).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('controlled mode', () => {
    it('reflects checked prop value', () => {
      const { rerender } = render(
        <Switch checked={false} onCheckedChange={() => {}} aria-label="toggle" />
      )
      const sw = screen.getByRole('switch', { name: 'toggle' })
      expect(sw).toHaveAttribute('data-state', 'unchecked')

      rerender(<Switch checked={true} onCheckedChange={() => {}} aria-label="toggle" />)
      expect(sw).toHaveAttribute('data-state', 'checked')
    })

    it('does not toggle without parent update in controlled mode', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="toggle" />)
      const sw = screen.getByRole('switch', { name: 'toggle' })

      await user.click(sw)
      expect(onCheckedChange).toHaveBeenCalledWith(true)
      expect(sw).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('onCheckedChange callback', () => {
    it('fires onCheckedChange when toggled on', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Switch onCheckedChange={onCheckedChange} aria-label="toggle" />)

      await user.click(screen.getByRole('switch', { name: 'toggle' }))
      expect(onCheckedChange).toHaveBeenCalledTimes(1)
      expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it('fires onCheckedChange with false when toggled off', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Switch defaultChecked onCheckedChange={onCheckedChange} aria-label="toggle" />)

      await user.click(screen.getByRole('switch', { name: 'toggle' }))
      expect(onCheckedChange).toHaveBeenCalledWith(false)
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute when disabled prop is set', () => {
      render(<Switch disabled aria-label="toggle" />)
      expect(screen.getByRole('switch', { name: 'toggle' })).toBeDisabled()
    })

    it('does not fire onCheckedChange when disabled', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Switch disabled onCheckedChange={onCheckedChange} aria-label="toggle" />)

      await user.click(screen.getByRole('switch', { name: 'toggle' }))
      expect(onCheckedChange).not.toHaveBeenCalled()
    })
  })

  describe('aria roles/labels', () => {
    it('has role=switch', () => {
      render(<Switch aria-label="t" />)
      expect(screen.getByRole('switch', { name: 't' })).toBeInTheDocument()
    })

    it('forwards aria-labelledby', () => {
      render(
        <>
          <span id="sw-label">Dark mode</span>
          <Switch aria-labelledby="sw-label" />
        </>
      )
      expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument()
    })

    it('reflects aria-checked when checked', () => {
      render(<Switch defaultChecked aria-label="t" />)
      expect(screen.getByRole('switch', { name: 't' })).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('className passthrough', () => {
    it('merges custom className with base classes', () => {
      render(<Switch className="custom-class extra" aria-label="t" />)
      const sw = screen.getByRole('switch', { name: 't' })
      expect(sw).toHaveClass('custom-class')
      expect(sw).toHaveClass('extra')
      expect(sw).toHaveClass('workflow-editor-switch')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to underlying element', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Switch ref={ref} aria-label="t" />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.getAttribute('role')).toBe('switch')
    })
  })
})
