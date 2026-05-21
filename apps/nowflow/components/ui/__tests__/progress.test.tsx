/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Progress } from '../progress'

const getIndicator = (root: HTMLElement): HTMLElement | null =>
  root.querySelector('.workflow-editor-progress-indicator')

describe('Progress', () => {
  describe('rendering', () => {
    it('renders a progressbar', () => {
      render(<Progress value={50} />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('applies base workflow-editor-progress class', () => {
      render(<Progress data-testid="progress" value={30} />)
      expect(screen.getByTestId('progress')).toHaveClass('workflow-editor-progress')
    })

    it('renders an indicator child element', () => {
      render(<Progress data-testid="progress" value={40} />)
      const root = screen.getByTestId('progress')
      const indicator = getIndicator(root)
      expect(indicator).not.toBeNull()
    })
  })

  describe('value updates', () => {
    it('applies translateX style based on value (value=0 -> -100%)', () => {
      render(<Progress data-testid="progress" value={0} />)
      const indicator = getIndicator(screen.getByTestId('progress'))
      expect(indicator?.style.transform).toBe('translateX(-100%)')
    })

    it('applies translateX style based on value (value=50 -> -50%)', () => {
      render(<Progress data-testid="progress" value={50} />)
      const indicator = getIndicator(screen.getByTestId('progress'))
      expect(indicator?.style.transform).toBe('translateX(-50%)')
    })

    it('applies translateX style based on value (value=100 -> -0%)', () => {
      render(<Progress data-testid="progress" value={100} />)
      const indicator = getIndicator(screen.getByTestId('progress'))
      expect(indicator?.style.transform).toBe('translateX(-0%)')
    })

    it('defaults to -100% when value is undefined', () => {
      render(<Progress data-testid="progress" />)
      const indicator = getIndicator(screen.getByTestId('progress'))
      expect(indicator?.style.transform).toBe('translateX(-100%)')
    })

    it('re-renders indicator transform when value changes', () => {
      const { rerender } = render(<Progress data-testid="progress" value={25} />)
      let indicator = getIndicator(screen.getByTestId('progress'))
      expect(indicator?.style.transform).toBe('translateX(-75%)')

      rerender(<Progress data-testid="progress" value={80} />)
      indicator = getIndicator(screen.getByTestId('progress'))
      expect(indicator?.style.transform).toBe('translateX(-20%)')
    })
  })

  describe('className passthrough', () => {
    it('merges className on root', () => {
      render(<Progress data-testid="progress" className="my-progress" value={10} />)
      const el = screen.getByTestId('progress')
      expect(el).toHaveClass('my-progress')
      expect(el).toHaveClass('workflow-editor-progress')
    })

    it('applies indicatorClassName to indicator element', () => {
      render(
        <Progress data-testid="progress" value={10} indicatorClassName="my-indicator extra-ind" />
      )
      const indicator = getIndicator(screen.getByTestId('progress'))
      expect(indicator).toHaveClass('my-indicator')
      expect(indicator).toHaveClass('extra-ind')
      expect(indicator).toHaveClass('workflow-editor-progress-indicator')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the underlying root element', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Progress ref={ref} value={10} />)
      expect(ref.current).not.toBeNull()
    })
  })
})
