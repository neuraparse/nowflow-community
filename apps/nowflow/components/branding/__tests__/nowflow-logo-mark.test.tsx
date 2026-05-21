/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { NowFlowLogoMark } from '@/components/branding/nowflow-logo-mark'

describe('NowFlowLogoMark', () => {
  it('renders an SVG element with img role', () => {
    const { container } = render(<NowFlowLogoMark />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('viewBox', '0 0 64 64')
  })

  it('uses the default idPrefix when none is provided', () => {
    const { container } = render(<NowFlowLogoMark />)
    const gradient = container.querySelector('#nowflow-primaryGradient')
    expect(gradient).not.toBeNull()
  })

  it('uses a custom idPrefix when provided', () => {
    const { container } = render(<NowFlowLogoMark idPrefix="brand-42" />)
    expect(container.querySelector('#brand-42-primaryGradient')).not.toBeNull()
    expect(container.querySelector('#brand-42-accentGradient')).not.toBeNull()
    expect(container.querySelector('#brand-42-glow')).not.toBeNull()
  })

  it('forwards arbitrary SVG props (e.g. className)', () => {
    const { container } = render(<NowFlowLogoMark className="logo-class" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('logo-class')
  })

  it('forwards refs to the underlying SVG element', () => {
    const ref = React.createRef<SVGSVGElement>()
    render(<NowFlowLogoMark ref={ref} />)
    expect(ref.current).toBeInstanceOf(SVGSVGElement)
  })

  it('has displayName set', () => {
    expect(NowFlowLogoMark.displayName).toBe('NowFlowLogoMark')
  })
})
