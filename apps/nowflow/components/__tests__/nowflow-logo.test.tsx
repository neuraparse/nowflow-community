/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { NowFlowLogo, NowFlowTextLogo } from '@/components/nowflow-logo'

// Mock the logo mark so we can verify prop forwarding without depending on its internals.
vi.mock('@/components/branding/nowflow-logo-mark', () => {
  const NowFlowLogoMark = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    (props, ref) =>
      React.createElement('svg', { ...props, ref, 'data-testid': 'nowflow-logo-mark' })
  )
  NowFlowLogoMark.displayName = 'NowFlowLogoMark'
  return { NowFlowLogoMark }
})

describe('NowFlowLogo', () => {
  it('renders the underlying logo mark (smoke test)', () => {
    const { getByTestId } = render(<NowFlowLogo />)
    expect(getByTestId('nowflow-logo-mark')).toBeInTheDocument()
  })

  it('forwards arbitrary SVG props (className, width, aria-label)', () => {
    const { getByTestId } = render(
      <NowFlowLogo className="custom-logo" width={48} aria-label="NowFlow" />
    )
    const svg = getByTestId('nowflow-logo-mark')
    expect(svg).toHaveClass('custom-logo')
    expect(svg.getAttribute('width')).toBe('48')
    expect(svg.getAttribute('aria-label')).toBe('NowFlow')
  })
})

describe('NowFlowTextLogo', () => {
  it('renders an <svg> with the expected viewBox (smoke test)', () => {
    const { container } = render(<NowFlowTextLogo />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('viewBox')).toBe('0 0 120 24')
  })

  it('has accessibility attributes marking it as decorative', () => {
    const { container } = render(<NowFlowTextLogo />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
  })

  it('renders both "Now" and "Flow" text labels', () => {
    const { container } = render(<NowFlowTextLogo />)
    const textNodes = Array.from(container.querySelectorAll('text')).map((n) => n.textContent)
    expect(textNodes).toContain('Now')
    expect(textNodes).toContain('Flow')
  })

  it('declares a linear gradient for the Flow portion', () => {
    const { container } = render(<NowFlowTextLogo />)
    expect(container.querySelector('#nowflow-text-gradient')).not.toBeNull()
    expect(container.querySelectorAll('stop')).toHaveLength(3)
  })

  it('forwards SVG props (className, data attributes)', () => {
    const { container } = render(
      <NowFlowTextLogo className="text-logo-class" data-testid="text-logo" />
    )
    const svg = container.querySelector('svg')!
    expect(svg).toHaveClass('text-logo-class')
    expect(svg.getAttribute('data-testid')).toBe('text-logo')
  })
})
