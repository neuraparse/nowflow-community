/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CopyButton } from '@/components/ui/copy-button'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('CopyButton', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the copy icon and label by default', () => {
    render(<CopyButton text="hello" />)

    expect(screen.getByText('Click to copy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument()
  })

  it('hides the label when showLabel is false', () => {
    render(<CopyButton text="hello" showLabel={false} />)

    expect(screen.queryByText('Click to copy')).not.toBeInTheDocument()
  })

  it('merges the provided className onto the button', () => {
    render(<CopyButton text="hello" className="custom-copy-class" />)
    const button = screen.getByRole('button', { name: /copy to clipboard/i })
    expect(button).toHaveClass('custom-copy-class')
  })

  it('calls navigator.clipboard.writeText with the text prop when clicked', async () => {
    render(<CopyButton text="copy-me" />)

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    expect(writeText).toHaveBeenCalledWith('copy-me')
  })

  it('shows "Copied!" state and swaps to the check icon after a successful copy', async () => {
    render(<CopyButton text="copy-me" />)

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })

    const button = screen.getByRole('button', { name: /copy to clipboard/i })
    const svg = button.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveClass('text-green-500')
  })

  it('reverts to the default state after the timeout elapses', async () => {
    render(<CopyButton text="copy-me" />)

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })

    // Real timers: the component sets a 2s timeout; wait a bit longer than that.
    await waitFor(
      () => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    expect(screen.getByText('Click to copy')).toBeInTheDocument()
  })

  it('stops click propagation so it does not trigger parent handlers', async () => {
    const parentClick = vi.fn()

    render(
      <div onClick={parentClick}>
        <CopyButton text="hello" />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    expect(parentClick).not.toHaveBeenCalled()
  })
})
