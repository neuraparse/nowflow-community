/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { Analytics } from '../analytics'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-path'),
  useSearchParams: vi.fn(() => new URLSearchParams('a=1&b=2')),
}))

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).gtag = vi.fn()
  })

  it('renders without crashing and outputs nothing to the DOM', () => {
    const { container } = render(<Analytics />)
    expect(container).toBeEmptyDOMElement()
  })

  it('calls gtag with page_path including query string on mount', () => {
    const gtag = vi.fn()
    ;(window as any).gtag = gtag
    render(<Analytics />)
    expect(gtag).toHaveBeenCalledWith(
      'config',
      expect.any(String),
      expect.objectContaining({ page_path: '/test-path?a=1&b=2' })
    )
  })

  it('does not call gtag when window.gtag is undefined', () => {
    ;(window as any).gtag = undefined
    expect(() => render(<Analytics />)).not.toThrow()
  })
})
