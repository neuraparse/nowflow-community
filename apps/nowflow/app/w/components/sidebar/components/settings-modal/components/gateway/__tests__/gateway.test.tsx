/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Gateway } from '../gateway'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('Gateway Settings UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show empty state when no channels exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channels: [], total: 0 }),
    })

    render(<Gateway />)

    await waitFor(() => {
      expect(screen.getByText('No channels connected')).toBeInTheDocument()
    })
  })

  it('should render channel list when channels exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          {
            id: 'ch-1',
            type: 'telegram',
            name: 'My Telegram Bot',
            status: 'connected',
            settings: { autoReply: false },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
      }),
    })

    render(<Gateway />)

    await waitFor(() => {
      expect(screen.getByText('My Telegram Bot')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  it('should show header with correct title', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channels: [], total: 0 }),
    })

    render(<Gateway />)

    expect(screen.getByText('Messaging Channels')).toBeInTheDocument()
  })

  it('should have Add Channel button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channels: [], total: 0 }),
    })

    render(<Gateway />)

    expect(screen.getByText('Add Channel')).toBeInTheDocument()
  })

  it('should open Add Channel dialog when button clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channels: [], total: 0 }),
    })

    render(<Gateway />)

    await waitFor(() => {
      expect(screen.getByText('Add Channel')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(screen.getByText('Connect Channel')).toBeInTheDocument()
      expect(screen.getByText('Channel Type')).toBeInTheDocument()
      expect(screen.getByText('Display Name')).toBeInTheDocument()
    })
  })

  it('should show loading skeleton while fetching', () => {
    // Never resolve the fetch
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    render(<Gateway />)

    // Should show skeleton elements (animated divs)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should show status badges with correct styles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          {
            id: '1',
            type: 'telegram',
            name: 'Bot 1',
            status: 'connected',
            settings: {},
            createdAt: '',
            updatedAt: '',
          },
          {
            id: '2',
            type: 'slack',
            name: 'Slack Bot',
            status: 'error',
            settings: {},
            createdAt: '',
            updatedAt: '',
          },
          {
            id: '3',
            type: 'discord',
            name: 'Discord',
            status: 'disconnected',
            settings: {},
            createdAt: '',
            updatedAt: '',
          },
        ],
        total: 3,
      }),
    })

    render(<Gateway />)

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })
  })

  it('should show channel count in footer', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          {
            id: '1',
            type: 'telegram',
            name: 'Bot',
            status: 'connected',
            settings: {},
            createdAt: '',
            updatedAt: '',
          },
          {
            id: '2',
            type: 'slack',
            name: 'Slack',
            status: 'disconnected',
            settings: {},
            createdAt: '',
            updatedAt: '',
          },
        ],
        total: 2,
      }),
    })

    render(<Gateway />)

    await waitFor(() => {
      expect(screen.getByText(/1 of 2 channels active/)).toBeInTheDocument()
    })
  })
})
