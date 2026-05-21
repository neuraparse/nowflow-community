/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { NowFlowBrandLockup, NowFlowWordmark } from '@/components/branding/nowflow-brand'

describe('NowFlowWordmark', () => {
  it('renders with the Now and Flow spans', () => {
    render(<NowFlowWordmark />)
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getByText('Flow')).toBeInTheDocument()
  })

  it('applies size classes for md by default', () => {
    const { container } = render(<NowFlowWordmark />)
    const span = container.querySelector('span.font-logo')
    expect(span).toHaveClass('text-[24px]')
  })

  it('applies sm size classes when size="sm"', () => {
    const { container } = render(<NowFlowWordmark size="sm" />)
    const span = container.querySelector('span.font-logo')
    expect(span).toHaveClass('text-[16px]')
  })

  it('applies lg size classes when size="lg"', () => {
    const { container } = render(<NowFlowWordmark size="lg" />)
    const span = container.querySelector('span.font-logo')
    expect(span).toHaveClass('text-[28px]')
  })

  it('merges an additional className', () => {
    const { container } = render(<NowFlowWordmark className="extra-class" />)
    const span = container.querySelector('span.font-logo')
    expect(span).toHaveClass('extra-class')
  })
})

describe('NowFlowBrandLockup', () => {
  it('renders the wordmark', () => {
    render(<NowFlowBrandLockup />)
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getByText('Flow')).toBeInTheDocument()
  })

  it('does not show the subtitle by default', () => {
    render(<NowFlowBrandLockup />)
    expect(screen.queryByText('Agentic Workflow Platform')).not.toBeInTheDocument()
  })

  it('shows the default subtitle when showSubtitle is true', () => {
    render(<NowFlowBrandLockup showSubtitle />)
    expect(screen.getByText('Agentic Workflow Platform')).toBeInTheDocument()
  })

  it('renders a custom subtitle', () => {
    render(<NowFlowBrandLockup showSubtitle subtitle="Custom Tagline" />)
    expect(screen.getByText('Custom Tagline')).toBeInTheDocument()
  })

  it('renders a badge node when provided', () => {
    render(<NowFlowBrandLockup badge={<span data-testid="brand-badge">BADGE</span>} />)
    expect(screen.getByTestId('brand-badge')).toBeInTheDocument()
  })

  it('uses custom markIdPrefix to generate unique SVG gradient ids', () => {
    const { container } = render(<NowFlowBrandLockup markIdPrefix="hero-lockup" />)
    expect(container.querySelector('#hero-lockup-primaryGradient')).not.toBeNull()
  })

  it('renders without crashing with required props only', () => {
    const { container } = render(<NowFlowBrandLockup />)
    expect(container.firstChild).not.toBeNull()
  })
})
