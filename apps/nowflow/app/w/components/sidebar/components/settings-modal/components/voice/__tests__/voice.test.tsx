/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Voice } from '../voice'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('Voice Settings UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render header', () => {
    render(<Voice />)
    expect(screen.getByText('Voice Commands')).toBeInTheDocument()
  })

  it('should show Enable Voice Commands toggle', () => {
    render(<Voice />)
    expect(screen.getByText('Enable Voice Commands')).toBeInTheDocument()
  })

  it('should show available voice commands list', () => {
    render(<Voice />)
    // Commands are rendered as text in the component
    expect(screen.getByText('Run [workflow]')).toBeInTheDocument()
    expect(screen.getByText('Check status')).toBeInTheDocument()
    expect(screen.getByText('List workflows')).toBeInTheDocument()
    expect(screen.getByText('Stop [workflow]')).toBeInTheDocument()
    expect(screen.getByText('Help')).toBeInTheDocument()
  })

  it('should show Test Voice section with input', () => {
    render(<Voice />)
    expect(screen.getByPlaceholderText('Type a test command...')).toBeInTheDocument()
  })

  it('should send test command and show result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: 'Here are your workflows.',
        action: { type: 'show_status' },
      }),
    })

    render(<Voice />)

    const input = screen.getByPlaceholderText('Type a test command...')
    await userEvent.type(input, 'list my workflows')

    // Find the send button in the test section (second Send icon button)
    const buttons = screen.getAllByRole('button')
    const sendButton = buttons.find((b) => b.textContent === '' && b.querySelector('svg') !== null)
    // Click the last button-like element near the input
    const testSection = input.closest('div')?.parentElement
    const testSendBtn = testSection?.querySelector('button')
    if (testSendBtn) {
      await userEvent.click(testSendBtn)
    }

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/voice/command',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('list my workflows'),
        })
      )
    })
  })

  it('should show language selector', () => {
    render(<Voice />)
    expect(screen.getByText('Language')).toBeInTheDocument()
  })
})
