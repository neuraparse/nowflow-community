/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { CodeBlock } from '@/components/ui/code-block'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('CodeBlock', () => {
  it('renders the provided code string inside a <code> element', () => {
    const code = "const x = 'hello'"
    render(<CodeBlock code={code} />)

    const codeEl = screen.getByText(code)
    expect(codeEl).toBeInTheDocument()
    expect(codeEl.tagName).toBe('CODE')
  })

  it('wraps the <code> element inside a <pre>', () => {
    const { container } = render(<CodeBlock code="abc" />)
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.querySelector('code')?.textContent).toBe('abc')
  })

  it('applies the workflow-editor-code-block class to the wrapper', () => {
    const { container } = render(<CodeBlock code="abc" />)
    expect(container.querySelector('.workflow-editor-code-block')).toBeInTheDocument()
  })

  it('merges custom className onto the wrapper div', () => {
    const { container } = render(<CodeBlock code="abc" className="my-extra" />)
    expect(container.querySelector('.workflow-editor-code-block')).toHaveClass('my-extra')
  })

  it('forwards additional HTMLAttributes onto the <pre> element', () => {
    const { container } = render(
      <CodeBlock code="abc" data-testid="pre-el" aria-label="code sample" />
    )
    const pre = container.querySelector('pre')
    expect(pre).toHaveAttribute('data-testid', 'pre-el')
    expect(pre).toHaveAttribute('aria-label', 'code sample')
  })

  it('renders a copy button alongside the code', () => {
    render(<CodeBlock code="abc" />)
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument()
  })

  it('renders multiline code preserving text content', () => {
    const code = 'line1\nline2\nline3'
    const { container } = render(<CodeBlock code={code} />)
    const codeEl = container.querySelector('code')
    expect(codeEl).not.toBeNull()
    expect(codeEl?.textContent).toBe(code)
  })

  it('accepts a language prop without throwing', () => {
    const { container } = render(<CodeBlock code="abc" language="typescript" />)
    expect(container.querySelector('code')?.textContent).toBe('abc')
  })
})
