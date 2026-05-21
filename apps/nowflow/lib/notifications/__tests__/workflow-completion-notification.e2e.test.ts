/**
 * End-to-end test for workflow completion notification flow
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('WorkflowCompletionNotificationE2E')

describe('Workflow Completion Notification E2E', () => {
  let mockDb: any
  let mockSendEmail: any
  let mockRenderAsync: any

  beforeEach(() => {
    vi.resetModules()

    // Mock the email rendering function.
    // The source calls `render(WorkflowCompletionEmail(props))` with a single
    // argument. We also mock the email component to return `{ props }` so
    // assertions can inspect `call[0].props.userName` etc.
    mockRenderAsync = vi.fn().mockResolvedValue('<html>Mocked email content</html>')
    vi.doMock('@react-email/components', () => ({
      render: mockRenderAsync,
    }))

    vi.doMock('@/components/emails/workflow-completion-email', () => ({
      WorkflowCompletionEmail: (props: any) => ({ props }),
    }))

    vi.doMock('@/components/emails/workflow-failure-email', () => ({
      WorkflowFailureEmail: (props: any) => ({ props }),
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
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => []),
          })),
        })),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    }

    vi.doMock('@/db', () => ({ db: mockDb }))

    // Mock drizzle schema tables with `_.name` so source can be identified
    // by the chainable mock's where/limit via `table?._?.name`.
    vi.doMock('@/db/schema', () => ({
      userNotificationPreferences: {
        _: { name: 'user_notification_preferences' },
        userId: 'userId',
      },
      workflow: { _: { name: 'workflow' }, id: 'id', userId: 'userId' },
      workflowRun: { _: { name: 'workflow_run' }, id: 'id' },
      user: { _: { name: 'user' }, id: 'id' },
    }))

    // Mock drizzle-orm's `eq` helper so source's call doesn't need real tables
    vi.doMock('drizzle-orm', async () => {
      const actual = await vi.importActual<any>('drizzle-orm')
      return {
        ...actual,
        eq: vi.fn((col, val) => ({ col, val })),
      }
    })

    // Mock the spam-guard so rate limits don't short-circuit between tests
    vi.doMock('@/lib/spam-guard', () => ({
      canSendWorkflowNotification: vi.fn().mockReturnValue(true),
      canSendFailureNotification: vi.fn().mockReturnValue(true),
    }))

    // Mock unsubscribe token helper
    vi.doMock('@/lib/email/unsubscribe-token', () => ({
      buildUnsubscribeHeaders: vi.fn().mockReturnValue({}),
    }))

    // Mock logger to prevent console output during tests
    vi.doMock('@/lib/logs/console-logger', () => ({
      createLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      })),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should send workflow completion notification when user has workflowCompletion=true', async () => {
    // Step 1: Setup - User has workflowCompletion=true in preferences
    const mockUserPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: true, // User wants completion notifications
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: false,
      digestSchedule: 'daily',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockWorkflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      userId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    }

    const mockWorkflowRun = {
      id: 'run-123',
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      status: 'completed',
      startTime: new Date(Date.now() - 120000), // 2 minutes ago
      endTime: new Date(),
    }

    // Mock database responses in order of calls
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            // Return appropriate mock based on which table is being queried
            if (table?._?.name === 'user_notification_preferences') {
              return [mockUserPreferences]
            } else if (table?._?.name === 'workflow') {
              return [mockWorkflow]
            } else if (table?._?.name === 'user') {
              return [mockUser]
            } else if (table?._?.name === 'workflow_run') {
              return [mockWorkflowRun]
            }
            return []
          }),
        })),
      })),
    }))

    // Import notification service after mocks are set up
    const { sendWorkflowCompletionNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Execute a test workflow (simulated by calling the notification function)
    const notificationOptions = {
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 120000, // 2 minutes
      result: { success: true, output: 'Test workflow completed' },
    }

    // Step 3: Send notification (this would be called by the executor after workflow completion)
    await sendWorkflowCompletionNotification(notificationOptions)

    // Step 4: Verify notification service was called and checked user preferences
    expect(mockDb.select).toHaveBeenCalled()

    // Step 5: Verify email was sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Test Workflow'),
        html: expect.any(String),
      })
    )

    // Step 6: Verify email content contains required information.
    // Source calls `render(WorkflowCompletionEmail({...}))`; our mock component
    // returns `{ props }`, so the first (and only) arg of render has `.props`.
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          userName: 'Test User',
          workflowName: 'Test Workflow',
          completionDate: expect.any(Date),
          executionTime: '2m 0s', // Formatted execution time
        }),
      })
    )
  })

  it('should NOT send notification when user has workflowCompletion=false', async () => {
    // Step 1: Setup - User has workflowCompletion=false in preferences
    const mockUserPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: false, // User disabled completion notifications
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: false,
      digestSchedule: 'daily',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Mock database to return user preferences
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => [mockUserPreferences]),
        })),
      })),
    }))

    // Import notification service after mocks are set up
    const { sendWorkflowCompletionNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Execute a test workflow (simulated)
    const notificationOptions = {
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 120000,
      result: { success: true },
    }

    // Step 3: Attempt to send notification
    await sendWorkflowCompletionNotification(notificationOptions)

    // Step 4: Verify NO email was sent (respecting disabled preference)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('should handle missing user preferences by creating defaults', async () => {
    // Step 1: Setup - User has no preferences yet (returns empty array)
    const mockWorkflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      userId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    }

    let preferencesCallCount = 0
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            // First call to get preferences returns empty (user has no preferences)
            if (table?._?.name === 'user_notification_preferences' && preferencesCallCount === 0) {
              preferencesCallCount++
              return []
            }
            // After creating defaults, return the default preferences
            else if (
              table?._?.name === 'user_notification_preferences' &&
              preferencesCallCount > 0
            ) {
              return [
                {
                  id: 'new-pref-id',
                  userId: 'user-123',
                  workflowCompletion: true, // Defaults to true
                  workflowFailure: true,
                  approvalRequests: true,
                  digestEnabled: false,
                  digestSchedule: 'daily',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]
            } else if (table?._?.name === 'workflow') {
              return [mockWorkflow]
            } else if (table?._?.name === 'user') {
              return [mockUser]
            }
            return []
          }),
        })),
      })),
    }))

    // Import notification service after mocks are set up
    const { sendWorkflowCompletionNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send notification for a workflow
    await sendWorkflowCompletionNotification({
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 60000,
      result: { success: true },
    })

    // Step 3: Verify default preferences were created
    expect(mockDb.insert).toHaveBeenCalled()

    // Step 4: Verify email was sent (with default preferences, workflowCompletion=true)
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('should handle notification failures gracefully without throwing', async () => {
    // Step 1: Setup - Email sending fails
    mockSendEmail = vi.fn().mockRejectedValue(new Error('Email service unavailable'))
    vi.doMock('@/lib/mailer', () => ({
      sendEmail: mockSendEmail,
    }))

    const mockUserPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: true,
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: false,
      digestSchedule: 'daily',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockWorkflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      userId: 'user-123',
    }

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    }

    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            if (table?._?.name === 'user_notification_preferences') {
              return [mockUserPreferences]
            } else if (table?._?.name === 'workflow') {
              return [mockWorkflow]
            } else if (table?._?.name === 'user') {
              return [mockUser]
            }
            return []
          }),
        })),
      })),
    }))

    // Import notification service after mocks are set up
    const { sendWorkflowCompletionNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send notification - should NOT throw even if email fails
    await expect(
      sendWorkflowCompletionNotification({
        workflowId: 'workflow-123',
        executionId: 'exec-123',
        executionTime: 60000,
        result: { success: true },
      })
    ).resolves.not.toThrow()

    // Step 3: Verify email sending was attempted
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('should include correct workflow execution metadata in email', async () => {
    // Step 1: Setup with specific execution details
    const mockUserPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: true,
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: false,
      digestSchedule: 'daily',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockWorkflow = {
      id: 'workflow-456',
      name: 'Data Processing Workflow',
      userId: 'user-123',
    }

    const mockUser = {
      id: 'user-123',
      email: 'data-engineer@example.com',
      name: 'Jane Engineer',
    }

    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            if (table?._?.name === 'user_notification_preferences') {
              return [mockUserPreferences]
            } else if (table?._?.name === 'workflow') {
              return [mockWorkflow]
            } else if (table?._?.name === 'user') {
              return [mockUser]
            }
            return []
          }),
        })),
      })),
    }))

    // Import notification service after mocks are set up
    const { sendWorkflowCompletionNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send notification with specific execution metadata
    const executionTime = 154000 // 2m 34s
    await sendWorkflowCompletionNotification({
      workflowId: 'workflow-456',
      executionId: 'exec-456',
      executionTime: executionTime,
      result: { recordsProcessed: 1000, status: 'success' },
    })

    // Step 3: Verify email template was rendered with correct metadata
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          userName: 'Jane Engineer',
          workflowName: 'Data Processing Workflow',
          executionTime: '2m 34s', // Properly formatted execution time
          completionDate: expect.any(Date),
        }),
      })
    )

    // Step 4: Verify email was sent to correct recipient
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'data-engineer@example.com',
        subject: expect.stringContaining('Data Processing Workflow'),
      })
    )
  })
})
