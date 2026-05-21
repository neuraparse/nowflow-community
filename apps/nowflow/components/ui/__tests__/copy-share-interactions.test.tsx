/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CopyButton } from '@/components/ui/copy-button'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('CopyButton interactions', () => {
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
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('click calls navigator.clipboard.writeText with the text prop', async () => {
    render(<CopyButton text="hello world" />)

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    expect(writeText).toHaveBeenCalledWith('hello world')
  })

  it('shows success state briefly then reverts (fake timers)', async () => {
    vi.useFakeTimers()

    render(<CopyButton text="copy-me" />)
    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    // Let the awaited clipboard promise resolve so setCopied(true) runs
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Copied!')).toBeInTheDocument()

    // Advance past the 2000ms timeout, revert to default
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.queryByText('Copied!')).not.toBeInTheDocument()
    expect(screen.getByText('Click to copy')).toBeInTheDocument()
  })

  it('preserves newlines when copying multi-line text', async () => {
    const multi = 'line 1\nline 2\n\nline 4'
    render(<CopyButton text={multi} />)

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    const arg = writeText.mock.calls[0][0] as string
    expect(arg).toBe(multi)
    expect(arg).toContain('\n')
    expect(arg.split('\n')).toHaveLength(4)
  })

  it('stops click propagation to parent handlers', async () => {
    const parentClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <CopyButton text="x" />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    expect(parentClick).not.toHaveBeenCalled()
  })
})
