/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { QuotaDisplay } from '@/components/billing/quota-display'

const originalFetch = global.fetch

describe('QuotaDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shows skeleton loaders while fetching', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    const { container } = render(<QuotaDisplay />)
    // Skeleton cards render with the workflow-editor-card-surface class
    expect(container.querySelectorAll('.workflow-editor-card-surface').length).toBeGreaterThan(0)
    // API Calls label is not rendered while loading
    expect(container.textContent).not.toContain('API Calls')
  })

  it('renders quota cards when data loads successfully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                quotaType: 'api_calls',
                baseQuota: 1000,
                rolloverAmount: 0,
                totalAvailable: 1000,
                usage: 250,
                remaining: 750,
                planName: 'Pro',
              },
              {
                quotaType: 'ai_credits',
                baseQuota: 10,
                rolloverAmount: 5,
                totalAvailable: 15,
                usage: 7.5,
                remaining: 7.5,
                planName: 'Pro',
              },
            ],
          }),
      })
    ) as any

    render(<QuotaDisplay />)

    await waitFor(() => {
      expect(screen.getByText('API Calls')).toBeInTheDocument()
    })
    expect(screen.getByText('AI Credits')).toBeInTheDocument()
    // Formatted usage string (API Calls: localeString 250 of 1,000)
    expect(screen.getByText(/Used 250 of 1,000/)).toBeInTheDocument()
    // Rollover bonus annotation appears for ai_credits
    expect(screen.getByText(/rollover bonus/)).toBeInTheDocument()
  })

  it('renders an accessible error message when fetch fails with ok=false', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    ) as any

    render(<QuotaDisplay />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load quota data')).toBeInTheDocument()
    })
  })

  it('renders an error message when fetch throws', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network down'))) as any

    render(<QuotaDisplay />)

    await waitFor(() => {
      expect(screen.getByText('Network down')).toBeInTheDocument()
    })
  })

  it('skips rendering when quota type has no config mapping', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                quotaType: 'unknown_type',
                baseQuota: 1,
                rolloverAmount: 0,
                totalAvailable: 1,
                usage: 0,
                remaining: 1,
                planName: 'Free',
              },
            ],
          }),
      })
    ) as any

    render(<QuotaDisplay />)
    await waitFor(() => {
      expect(screen.queryByText('API Calls')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('AI Credits')).not.toBeInTheDocument()
  })
})
