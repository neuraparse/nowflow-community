/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpendControlsPanel } from '@/components/billing/spend-controls-panel'

const originalFetch = global.fetch

function mockFetchOnce(data: any) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data }),
    })
  ) as any
}

describe('SpendControlsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shows a loader while fetching', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    const { container } = render(<SpendControlsPanel />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('renders default empty state when API returns no data', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      })
    ) as any

    render(<SpendControlsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No budget limits configured yet.')).toBeInTheDocument()
    })
    expect(screen.getByText('Budget Limits')).toBeInTheDocument()
    expect(screen.getByText('Alert Thresholds')).toBeInTheDocument()
  })

  it('populates budget inputs with values from API', async () => {
    mockFetchOnce({
      budgetStatus: {
        daily: { limit: 5, currentSpend: 1, remaining: 4, utilizationPct: 20 },
        weekly: { limit: 30, currentSpend: 10, remaining: 20, utilizationPct: 33 },
        monthly: { limit: 100, currentSpend: 25, remaining: 75, utilizationPct: 25 },
      },
      alerts: { thresholds: [75, 100], enabled: true },
      topWorkflows: [],
    })

    render(<SpendControlsPanel />)

    await waitFor(() => {
      const monthlyInput = screen.getByDisplayValue('100')
      expect(monthlyInput).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
    // Monthly budget summary (uses ·)
    expect(screen.getByText(/25.0% of monthly budget used/)).toBeInTheDocument()
  })

  it('renders top spending workflows and anomalies when present', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              budgetStatus: {},
              alerts: {},
              topWorkflows: [
                { workflowId: 'abc12345', name: 'Marketing Pipeline', totalCost: 0.1234 },
              ],
              workflow: {
                anomalies: [{ date: '2026-04-15', spend: 2.5, expected: 1.0, deviationPct: 150 }],
              },
            },
          }),
      })
    ) as any

    render(<SpendControlsPanel />)

    await waitFor(() => {
      expect(screen.getByText('Marketing Pipeline')).toBeInTheDocument()
    })
    expect(screen.getByText('$0.1234')).toBeInTheDocument()
    expect(screen.getByText('Spending Anomalies')).toBeInTheDocument()
    expect(screen.getByText('2026-04-15')).toBeInTheDocument()
  })

  it('updates budget input on user typing', async () => {
    mockFetchOnce({ budgetStatus: {}, alerts: {}, topWorkflows: [] })

    const user = userEvent.setup()
    render(<SpendControlsPanel />)

    await waitFor(() => {
      expect(screen.getByText('Budget Limits')).toBeInTheDocument()
    })

    const inputs = screen.getAllByPlaceholderText('0.00')
    const dailyInput = inputs[0] as HTMLInputElement
    await user.type(dailyInput, '12.5')
    expect(dailyInput.value).toBe('12.5')
  })

  it('submits Save with budgets & thresholds and refetches', async () => {
    const postBody: any[] = []
    let callCount = 0
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      callCount++
      if (init?.method === 'POST') {
        postBody.push(JSON.parse(init.body as string))
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { budgetStatus: {}, alerts: {}, topWorkflows: [] },
          }),
      })
    }) as any

    const user = userEvent.setup()
    render(<SpendControlsPanel />)

    await waitFor(() => {
      expect(screen.getByText('Budget Limits')).toBeInTheDocument()
    })

    const inputs = screen.getAllByPlaceholderText('0.00')
    await user.type(inputs[2] as HTMLInputElement, '50')

    const saveBtn = screen.getByRole('button', { name: /Save Spend Controls/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(postBody.length).toBeGreaterThan(0)
    })
    expect(postBody[0].budgets.monthly).toBe(50)
    expect(postBody[0].alertThresholds).toEqual([50, 75, 90, 100])
    expect(postBody[0].alertsEnabled).toBe(true)
    // Save triggers at least one refetch
    expect(callCount).toBeGreaterThanOrEqual(3)
  })

  it('gracefully handles fetch throwing and still renders defaults', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('down'))) as any
    // Silence expected console.error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<SpendControlsPanel />)

    await waitFor(() => {
      expect(screen.getByText('No budget limits configured yet.')).toBeInTheDocument()
    })
    spy.mockRestore()
  })
})
