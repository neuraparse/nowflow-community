/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { formatDisplayText } from '@/components/ui/formatted-text'

describe('formatDisplayText', () => {
  it('returns an empty array for empty input', () => {
    expect(formatDisplayText('')).toEqual([])
  })

  it('renders plain text as a single span', () => {
    const { container } = render(<>{formatDisplayText('hello world')}</>)
    const spans = container.querySelectorAll('span')
    expect(spans).toHaveLength(1)
    expect(spans[0].textContent).toBe('hello world')
  })

  it('highlights block references wrapped in angle brackets', () => {
    const { container } = render(<>{formatDisplayText('before <block.output> after')}</>)
    const highlighted = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '<block.output>'
    )
    expect(highlighted).toBeDefined()
    expect(highlighted).toHaveStyle({ color: 'rgb(59, 130, 246)' })
  })

  it('highlights environment variables wrapped in double braces', () => {
    const { container } = render(<>{formatDisplayText('use {{API_KEY}} here')}</>)
    const highlighted = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '{{API_KEY}}'
    )
    expect(highlighted).toBeDefined()
    expect(highlighted).toHaveStyle({ color: 'rgb(59, 130, 246)' })
  })

  it('renders plain text segments without blue highlight', () => {
    const { container } = render(<>{formatDisplayText('start <x.y> end')}</>)
    const plain = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent === 'start ' || s.textContent === ' end'
    )
    expect(plain.length).toBe(2)
    plain.forEach((node) => {
      expect(node).toHaveClass('text-zinc-800')
      expect(node).toHaveClass('dark:text-zinc-100')
    })
  })

  it('handles mixed block refs and env vars in one string', () => {
    const { container } = render(<>{formatDisplayText('hi <a.b> middle {{ENV}} tail')}</>)
    const spans = Array.from(container.querySelectorAll('span'))
    const texts = spans.map((s) => s.textContent)

    expect(texts).toContain('<a.b>')
    expect(texts).toContain('{{ENV}}')
    expect(texts.join('')).toBe('hi <a.b> middle {{ENV}} tail')
  })

  it('preserves insertion order across multiple tokens', () => {
    const { container } = render(<>{formatDisplayText('<one> <two> {{THREE}}')}</>)
    const spans = Array.from(container.querySelectorAll('span'))
    const nonEmpty = spans.map((s) => s.textContent).filter((t) => t && t.length > 0)
    expect(nonEmpty.join('')).toBe('<one> <two> {{THREE}}')
  })

  it('does not strip quotes by default', () => {
    const { container } = render(<>{formatDisplayText('"quoted"')}</>)
    expect(container.textContent).toBe('"quoted"')
  })
})
