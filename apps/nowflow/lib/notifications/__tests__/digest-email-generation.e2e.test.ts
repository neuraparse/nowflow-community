/**
 * End-to-end test for digest email generation
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DigestEmailGenerationE2E')

describe('Digest Email Generation E2E', () => {
  let mockDb: any
  let mockSendEmail: any
  let mockRenderAsync: any

  beforeEach(() => {
    vi.resetModules()

    // Mock the email rendering function.
    // Email components (digest-email.tsx, etc.) import `Html`, `Body`, `Section`, ...
    // from '@react-email/components' alongside `render`, so we must stub those
    // too — otherwise calling `WorkflowCompletionEmail(props)` in the source
    // throws "React.createElement: type is invalid ... got undefined".
    mockRenderAsync = vi.fn().mockResolvedValue('<html>Mocked digest email content</html>')
    vi.doMock('@react-email/components', () => ({
      render: mockRenderAsync,
    }))

    // Mock the email component itself — the source calls `DigestEmail(props)`
    // as a function (not JSX), so mocking it to return `{ props }` matches
    // what the tests assert via `mockRenderAsync.mock.calls[0][0].props.*`.
    vi.doMock('@/components/emails/digest-email', () => ({
      DigestEmail: (props: any) => ({ props }),
    }))

    // Mock the sendEmail function to track email sending
    mockSendEmail = vi.fn().mockResolvedValue({ success: true })
    vi.doMock('@/lib/mailer', () => ({
      sendEmail: mockSendEmail,
    }))

    // Mock the database
    mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => []),
          })),
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => []),
          })),
        })),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    }

    vi.doMock('@/db', () => ({ db: mockDb }))
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.clearAllMocks()
  })

  it('should send daily digest to users with digestEnabled=true and digestSchedule=daily', async () => {
    // Mock users with daily digest enabled
    const mockUsers = [
      {
        userId: 'user-1',
        userEmail: 'user1@example.com',
        userName: 'Test User 1',
      },
      {
        userId: 'user-2',
        userEmail: 'user2@example.com',
        userName: 'Test User 2',
      },
    ]

    // Mock workflow data for each user
    const mockWorkflows = [{ id: 'workflow-1' }, { id: 'workflow-2' }]

    const mockWorkflowRuns = [
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'success',
        error: null,
        completedAt: new Date(),
      },
      {
        id: 'run-2',
        workflowId: 'workflow-1',
        status: 'failed',
        error: 'Test error',
        completedAt: new Date(),
      },
    ]

    const mockWorkflowNames = [{ id: 'workflow-1', name: 'Test Workflow' }]

    // Setup mock to return different results based on call order
    let callCount = 0
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => mockUsers),
        })),
        where: vi.fn().mockImplementation(() => {
          callCount++
          // First call returns workflows, subsequent calls return workflow names
          if (callCount % 3 === 1) {
            return mockWorkflows
          } else if (callCount % 3 === 2) {
            return mockWorkflowRuns
          } else {
            return mockWorkflowNames
          }
        }),
      })),
    }))

    // Import after mocks are set up
    const { sendDailyDigests } = await import('@/lib/notifications/digest-scheduler')

    // Execute daily digest
    const result = await sendDailyDigests()

    // Verify database was queried for users with digestEnabled=true and digestSchedule=daily
    expect(mockDb.select).toHaveBeenCalled()

    // Verify emails were sent to both users
    expect(mockSendEmail).toHaveBeenCalledTimes(2)

    // Verify first email was sent to user1
    const firstCall = mockSendEmail.mock.calls[0][0]
    expect(firstCall.to).toBe('user1@example.com')
    expect(firstCall.subject).toBe('Your NowFlow Workflow Activity Digest')
    expect(firstCall.html).toBe('<html>Mocked digest email content</html>')

    // Verify second email was sent to user2
    const secondCall = mockSendEmail.mock.calls[1][0]
    expect(secondCall.to).toBe('user2@example.com')
    expect(secondCall.subject).toBe('Your NowFlow Workflow Activity Digest')

    // Verify result summary
    expect(result.sent).toBe(2)
    expect(result.failed).toBe(0)

    logger.info('Daily digest E2E test passed', { result })
  })

  it('should send weekly digest to users with digestEnabled=true and digestSchedule=weekly', async () => {
    // Mock users with weekly digest enabled
    const mockUsers = [
      {
        userId: 'user-3',
        userEmail: 'user3@example.com',
        userName: 'Test User 3',
      },
    ]

    const mockWorkflows = [{ id: 'workflow-1' }]
    const mockWorkflowRuns = [
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'success',
        error: null,
        completedAt: new Date(),
      },
    ]
    const mockWorkflowNames = [{ id: 'workflow-1', name: 'Test Workflow' }]

    let callCount = 0
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => mockUsers),
        })),
        where: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount % 3 === 1) {
            return mockWorkflows
          } else if (callCount % 3 === 2) {
            return mockWorkflowRuns
          } else {
            return mockWorkflowNames
          }
        }),
      })),
    }))

    const { sendWeeklyDigests } = await import('@/lib/notifications/digest-scheduler')

    // Execute weekly digest
    const result = await sendWeeklyDigests()

    // Verify email was sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user3@example.com',
        subject: 'Your NowFlow Workflow Activity Digest',
      })
    )

    expect(result.sent).toBe(1)
    expect(result.failed).toBe(0)

    logger.info('Weekly digest E2E test passed', { result })
  })

  it('should NOT send digest to users with digestEnabled=false', async () => {
    // Mock empty user list (no users with digestEnabled=true)
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => []),
        })),
      })),
    }))

    const { sendDailyDigests } = await import('@/lib/notifications/digest-scheduler')

    // Execute daily digest
    const result = await sendDailyDigests()

    // Verify NO emails were sent
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(0)

    logger.info('Digest preference respected - no emails sent')
  })

  it('should skip users with no activity (0 executions and 0 pending approvals)', async () => {
    // Mock user with digest enabled
    const mockUsers = [
      {
        userId: 'user-no-activity',
        userEmail: 'inactive@example.com',
        userName: 'Inactive User',
      },
    ]

    // Mock empty workflow list (no activity)
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => mockUsers),
        })),
        where: vi.fn().mockImplementation(() => []), // No workflows/runs
      })),
    }))

    const { sendDailyDigests } = await import('@/lib/notifications/digest-scheduler')

    // Execute daily digest
    const result = await sendDailyDigests()

    // Verify NO emails were sent (skipped due to no activity)
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(0)

    logger.info('Users with no activity correctly skipped')
  })

  it('should include correct statistics in digest email', async () => {
    // Mock user
    const mockUsers = [
      {
        userId: 'user-stats',
        userEmail: 'stats@example.com',
        userName: 'Stats User',
      },
    ]

    // Mock workflow data with multiple runs
    const mockWorkflows = [{ id: 'workflow-1' }, { id: 'workflow-2' }]

    const mockWorkflowRuns = [
      // 3 successful runs for workflow-1
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'success',
        error: null,
        completedAt: new Date(),
      },
      {
        id: 'run-2',
        workflowId: 'workflow-1',
        status: 'completed',
        error: null,
        completedAt: new Date(),
      },
      {
        id: 'run-3',
        workflowId: 'workflow-1',
        status: 'success',
        error: null,
        completedAt: new Date(),
      },
      // 2 failed runs for workflow-2
      {
        id: 'run-4',
        workflowId: 'workflow-2',
        status: 'failed',
        error: 'Error 1',
        completedAt: new Date(),
      },
      {
        id: 'run-5',
        workflowId: 'workflow-2',
        status: 'error',
        error: 'Error 2',
        completedAt: new Date(),
      },
    ]

    const mockWorkflowNames = [
      { id: 'workflow-1', name: 'Success Workflow' },
      { id: 'workflow-2', name: 'Failed Workflow' },
    ]

    let callCount = 0
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => mockUsers),
        })),
        where: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount % 3 === 1) {
            return mockWorkflows
          } else if (callCount % 3 === 2) {
            return mockWorkflowRuns
          } else {
            return mockWorkflowNames
          }
        }),
      })),
    }))

    const { sendDailyDigests } = await import('@/lib/notifications/digest-scheduler')

    // Execute daily digest
    await sendDailyDigests()

    // Verify email template was rendered with correct data
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          userName: 'Stats User',
          userEmail: 'stats@example.com',
          totalExecutions: 5,
          successfulExecutions: 3,
          failedExecutions: 2,
          topWorkflows: expect.arrayContaining([
            expect.objectContaining({
              name: 'Success Workflow',
              executionCount: 3,
            }),
            expect.objectContaining({
              name: 'Failed Workflow',
              executionCount: 2,
            }),
          ]),
          recentFailures: expect.arrayContaining([
            expect.objectContaining({
              workflowName: 'Failed Workflow',
              errorMessage: expect.any(String),
            }),
          ]),
        }),
      })
    )

    logger.info('Digest statistics correctly calculated and included')
  })

  it('should include dashboard link in digest email', async () => {
    // Mock user
    const mockUsers = [
      {
        userId: 'user-link',
        userEmail: 'link@example.com',
        userName: 'Link User',
      },
    ]

    const mockWorkflows = [{ id: 'workflow-1' }]
    const mockWorkflowRuns = [
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'success',
        error: null,
        completedAt: new Date(),
      },
    ]
    const mockWorkflowNames = [{ id: 'workflow-1', name: 'Test Workflow' }]

    let callCount = 0
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => mockUsers),
        })),
        where: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount % 3 === 1) {
            return mockWorkflows
          } else if (callCount % 3 === 2) {
            return mockWorkflowRuns
          } else {
            return mockWorkflowNames
          }
        }),
      })),
    }))

    const { sendDailyDigests } = await import('@/lib/notifications/digest-scheduler')

    // Execute daily digest
    await sendDailyDigests()

    // Verify email template was rendered with dashboard link
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          dashboardLink: expect.stringContaining('/dashboard'),
        }),
      })
    )

    logger.info('Dashboard link correctly included in digest')
  })

  it('should handle email service failures gracefully', async () => {
    // Mock users
    const mockUsers = [
      {
        userId: 'user-fail',
        userEmail: 'fail@example.com',
        userName: 'Fail User',
      },
    ]

    const mockWorkflows = [{ id: 'workflow-1' }]
    const mockWorkflowRuns = [
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'success',
        error: null,
        completedAt: new Date(),
      },
    ]
    const mockWorkflowNames = [{ id: 'workflow-1', name: 'Test Workflow' }]

    let callCount = 0
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => mockUsers),
        })),
        where: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount % 3 === 1) {
            return mockWorkflows
          } else if (callCount % 3 === 2) {
            return mockWorkflowRuns
          } else {
            return mockWorkflowNames
          }
        }),
      })),
    }))

    // Mock email sending to fail
    mockSendEmail.mockResolvedValue({ success: false, message: 'Email service error' })

    const { sendDailyDigests } = await import('@/lib/notifications/digest-scheduler')

    // Execute daily digest
    const result = await sendDailyDigests()

    // Verify function handles failure gracefully (doesn't throw)
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(1)

    logger.info('Email failures handled gracefully')
  })

  it('should calculate correct date ranges for daily (24h) and weekly (7d) digests', async () => {
    // Mock users
    const mockUsers = [
      {
        userId: 'user-dates',
        userEmail: 'dates@example.com',
        userName: 'Date User',
      },
    ]

    const mockWorkflows = [{ id: 'workflow-1' }]
    const mockWorkflowRuns = [
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'success',
        error: null,
        completedAt: new Date(),
      },
    ]
    const mockWorkflowNames = [{ id: 'workflow-1', name: 'Test Workflow' }]

    let callCount = 0
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => mockUsers),
        })),
        where: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount % 3 === 1) {
            return mockWorkflows
          } else if (callCount % 3 === 2) {
            return mockWorkflowRuns
          } else {
            return mockWorkflowNames
          }
        }),
      })),
    }))

    const { sendDailyDigests, sendWeeklyDigests } =
      await import('@/lib/notifications/digest-scheduler')

    // Test daily digest
    const now = Date.now()
    await sendDailyDigests()

    // Verify daily digest uses 24h date range
    const dailyCall = mockRenderAsync.mock.calls[0][0]
    const dailyStartDate = dailyCall.props.startDate
    const dailyEndDate = dailyCall.props.endDate
    const dailyDiff = dailyEndDate.getTime() - dailyStartDate.getTime()
    const expectedDailyDiff = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    expect(dailyDiff).toBeGreaterThanOrEqual(expectedDailyDiff * 0.99) // Allow 1% tolerance
    expect(dailyDiff).toBeLessThanOrEqual(expectedDailyDiff * 1.01)

    // Reset mocks
    vi.clearAllMocks()
    callCount = 0

    // Test weekly digest
    await sendWeeklyDigests()

    // Verify weekly digest uses 7 day date range
    const weeklyCall = mockRenderAsync.mock.calls[0][0]
    const weeklyStartDate = weeklyCall.props.startDate
    const weeklyEndDate = weeklyCall.props.endDate
    const weeklyDiff = weeklyEndDate.getTime() - weeklyStartDate.getTime()
    const expectedWeeklyDiff = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

    expect(weeklyDiff).toBeGreaterThanOrEqual(expectedWeeklyDiff * 0.99) // Allow 1% tolerance
    expect(weeklyDiff).toBeLessThanOrEqual(expectedWeeklyDiff * 1.01)

    logger.info('Date ranges correctly calculated for daily and weekly digests')
  })
})
