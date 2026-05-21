/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Slider } from '../slider'

// Radix Slider relies on ResizeObserver and pointer capture APIs
// that aren't implemented by jsdom. Provide minimal stubs.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub

  if (!(Element.prototype as any).hasPointerCapture) {
    ;(Element.prototype as any).hasPointerCapture = () => false
  }
  if (!(Element.prototype as any).releasePointerCapture) {
    ;(Element.prototype as any).releasePointerCapture = () => {}
  }
  if (!(Element.prototype as any).setPointerCapture) {
    ;(Element.prototype as any).setPointerCapture = () => {}
  }
})

describe('Slider', () => {
  describe('rendering', () => {
    it('renders with slider role', () => {
      render(<Slider aria-label="volume" />)
      expect(screen.getByRole('slider')).toBeInTheDocument()
    })

    it('applies the base workflow-editor-slider class to root', () => {
      const { container } = render(<Slider aria-label="volume" />)
      const root = container.querySelector('.workflow-editor-slider')
      expect(root).not.toBeNull()
    })

    it('renders track, range, and thumb elements', () => {
      const { container } = render(<Slider aria-label="volume" defaultValue={[50]} />)
      expect(container.querySelector('.workflow-editor-slider-track')).not.toBeNull()
      expect(container.querySelector('.workflow-editor-slider-range')).not.toBeNull()
      expect(container.querySelector('.workflow-editor-slider-thumb')).not.toBeNull()
    })
  })

  describe('default values (uncontrolled)', () => {
    it('respects defaultValue prop', () => {
      render(<Slider aria-label="volume" defaultValue={[42]} min={0} max={100} />)
      const thumb = screen.getByRole('slider')
      expect(thumb).toHaveAttribute('aria-valuenow', '42')
    })

    it('uses 0 as default when no defaultValue provided', () => {
      render(<Slider aria-label="volume" min={0} max={100} />)
      const thumb = screen.getByRole('slider')
      expect(thumb).toHaveAttribute('aria-valuenow', '0')
    })
  })

  describe('min / max / step handling', () => {
    it('exposes aria-valuemin and aria-valuemax', () => {
      render(<Slider aria-label="volume" defaultValue={[5]} min={0} max={10} />)
      const thumb = screen.getByRole('slider')
      expect(thumb).toHaveAttribute('aria-valuemin', '0')
      expect(thumb).toHaveAttribute('aria-valuemax', '10')
      expect(thumb).toHaveAttribute('aria-valuenow', '5')
    })

    it('clamps keyboard increments to max', async () => {
      const user = userEvent.setup()
      render(<Slider aria-label="volume" defaultValue={[9]} min={0} max={10} step={1} />)
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(thumb).toHaveAttribute('aria-valuenow', '10')

      await user.keyboard('{ArrowRight}')
      expect(thumb).toHaveAttribute('aria-valuenow', '10')
    })

    it('clamps keyboard decrements to min', async () => {
      const user = userEvent.setup()
      render(<Slider aria-label="volume" defaultValue={[1]} min={0} max={10} step={1} />)
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowLeft}')
      expect(thumb).toHaveAttribute('aria-valuenow', '0')

      await user.keyboard('{ArrowLeft}')
      expect(thumb).toHaveAttribute('aria-valuenow', '0')
    })

    it('uses step to determine increment size', async () => {
      const user = userEvent.setup()
      render(<Slider aria-label="volume" defaultValue={[0]} min={0} max={100} step={10} />)
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(thumb).toHaveAttribute('aria-valuenow', '10')

      await user.keyboard('{ArrowRight}')
      expect(thumb).toHaveAttribute('aria-valuenow', '20')
    })
  })

  describe('keyboard interaction', () => {
    it('increases value with ArrowRight', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Slider
          aria-label="volume"
          defaultValue={[50]}
          min={0}
          max={100}
          step={1}
          onValueChange={onValueChange}
        />
      )
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(thumb).toHaveAttribute('aria-valuenow', '51')
      expect(onValueChange).toHaveBeenCalledWith([51])
    })

    it('decreases value with ArrowLeft', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Slider
          aria-label="volume"
          defaultValue={[50]}
          min={0}
          max={100}
          step={1}
          onValueChange={onValueChange}
        />
      )
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowLeft}')
      expect(thumb).toHaveAttribute('aria-valuenow', '49')
      expect(onValueChange).toHaveBeenCalledWith([49])
    })

    it('supports Home/End to jump to min/max', async () => {
      const user = userEvent.setup()
      render(<Slider aria-label="volume" defaultValue={[50]} min={0} max={100} step={1} />)
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{End}')
      expect(thumb).toHaveAttribute('aria-valuenow', '100')

      await user.keyboard('{Home}')
      expect(thumb).toHaveAttribute('aria-valuenow', '0')
    })
  })

  describe('controlled mode', () => {
    it('reflects value prop', () => {
      const { rerender } = render(
        <Slider aria-label="volume" value={[25]} onValueChange={() => {}} min={0} max={100} />
      )
      const thumb = screen.getByRole('slider')
      expect(thumb).toHaveAttribute('aria-valuenow', '25')

      rerender(
        <Slider aria-label="volume" value={[75]} onValueChange={() => {}} min={0} max={100} />
      )
      expect(thumb).toHaveAttribute('aria-valuenow', '75')
    })

    it('does not move without parent update in controlled mode', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Slider
          aria-label="volume"
          value={[50]}
          onValueChange={onValueChange}
          min={0}
          max={100}
          step={1}
        />
      )
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(onValueChange).toHaveBeenCalledWith([51])
      expect(thumb).toHaveAttribute('aria-valuenow', '50')
    })
  })

  describe('onValueChange callback', () => {
    it('fires onValueChange when value changes via keyboard', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Slider
          aria-label="volume"
          defaultValue={[10]}
          min={0}
          max={100}
          step={5}
          onValueChange={onValueChange}
        />
      )
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenCalledWith([15])
    })

    it('does not fire onValueChange when value is already at max', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Slider
          aria-label="volume"
          defaultValue={[10]}
          min={0}
          max={10}
          step={1}
          onValueChange={onValueChange}
        />
      )
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(onValueChange).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('sets aria-disabled/data-disabled when disabled', () => {
      const { container } = render(<Slider aria-label="volume" disabled defaultValue={[50]} />)
      const root = container.querySelector('.workflow-editor-slider')
      expect(root).toHaveAttribute('data-disabled')
    })

    it('does not fire onValueChange when disabled', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Slider
          aria-label="volume"
          disabled
          defaultValue={[50]}
          min={0}
          max={100}
          step={1}
          onValueChange={onValueChange}
        />
      )
      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(onValueChange).not.toHaveBeenCalled()
    })
  })

  describe('aria roles/labels', () => {
    it('has role=slider on thumb', () => {
      render(<Slider aria-label="volume" defaultValue={[5]} />)
      expect(screen.getByRole('slider')).toBeInTheDocument()
    })

    it('renders a single slider thumb (wrapper renders one Thumb)', () => {
      render(<Slider aria-label="range" defaultValue={[10]} min={0} max={100} />)
      expect(screen.getAllByRole('slider')).toHaveLength(1)
    })
  })

  describe('className passthrough', () => {
    it('merges custom className on root', () => {
      const { container } = render(<Slider className="custom-slider extra" aria-label="volume" />)
      const root = container.querySelector('.workflow-editor-slider')
      expect(root).toHaveClass('custom-slider')
      expect(root).toHaveClass('extra')
      expect(root).toHaveClass('workflow-editor-slider')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to root element', () => {
      const ref = React.createRef<HTMLSpanElement>()
      render(<Slider ref={ref} aria-label="volume" defaultValue={[5]} />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.classList.contains('workflow-editor-slider')).toBe(true)
    })
  })
})
