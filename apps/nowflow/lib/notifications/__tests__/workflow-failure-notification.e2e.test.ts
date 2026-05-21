/**
 * End-to-end test for workflow failure notification flow
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_DOMAIN } from '@/lib/config/app-urls'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('WorkflowFailureNotificationE2E')

describe('Workflow Failure Notification E2E', () => {
  let mockDb: any
  let mockSendEmail: any
  let mockRenderAsync: any

  beforeEach(() => {
    vi.resetModules()

    // Mock the email rendering function
    mockRenderAsync = vi.fn().mockResolvedValue('<html>Mocked failure email content</html>')
    vi.doMock('@react-email/components', () => ({
      render: mockRenderAsync,
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

    // Mock email component factories used by the failure service
    vi.doMock('@/components/emails/workflow-completion-email', () => ({
      WorkflowCompletionEmail: (props: any) => ({ props }),
    }))
    vi.doMock('@/components/emails/workflow-failure-email', () => ({
      WorkflowFailureEmail: (props: any) => ({ props }),
    }))

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

  it('should send workflow failure notification when user has workflowFailure=true', async () => {
    // Step 1: Setup - User has workflowFailure=true in preferences
    const mockUserPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: true,
      workflowFailure: true, // User wants failure notifications
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
            }
            return []
          }),
        })),
      })),
    }))

    // Import notification service after mocks are set up
    const { sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Execute a workflow that fails (simulated by calling the notification function)
    const notificationOptions = {
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 45000, // 45 seconds
      error: new Error('Failed to connect to external API'),
      failedBlockId: 'block-456',
    }

    // Step 3: Send failure notification (this would be called by the executor after workflow fails)
    await sendWorkflowFailureNotification(notificationOptions)

    // Step 4: Verify notification service was called and checked user preferences
    expect(mockDb.select).toHaveBeenCalled()

    // Step 5: Verify failure email was sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('failed'),
        html: expect.any(String),
      })
    )

    // Step 6: Verify email content contains error details and failed block info
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          userName: 'Test User',
          workflowName: 'Test Workflow',
          failureDate: expect.any(Date),
          errorMessage: 'Failed to connect to external API',
          executionTime: '45s', // Formatted execution time
        }),
      })
    )
  })

  it('should NOT send notification when user has workflowFailure=false', async () => {
    // Step 1: Setup - User has workflowFailure=false in preferences
    const mockUserPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: true,
      workflowFailure: false, // User disabled failure notifications
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
    const { sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Execute a workflow that fails (simulated)
    const notificationOptions = {
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 30000,
      error: 'Database connection timeout',
    }

    // Step 3: Attempt to send notification
    await sendWorkflowFailureNotification(notificationOptions)

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
                  workflowCompletion: true,
                  workflowFailure: true, // Defaults to true
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
    const { sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send failure notification for a workflow
    await sendWorkflowFailureNotification({
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 60000,
      error: 'Workflow execution failed',
    })

    // Step 3: Verify default preferences were created
    expect(mockDb.insert).toHaveBeenCalled()

    // Step 4: Verify email was sent (with default preferences, workflowFailure=true)
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
    const { sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send notification - should NOT throw even if email fails
    await expect(
      sendWorkflowFailureNotification({
        workflowId: 'workflow-123',
        executionId: 'exec-123',
        executionTime: 60000,
        error: 'Workflow execution failed',
      })
    ).resolves.not.toThrow()

    // Step 3: Verify email sending was attempted
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('should include correct error details and execution metadata in email', async () => {
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
    const { sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send notification with specific error details
    const executionTime = 154000 // 2m 34s
    const errorMessage = 'API rate limit exceeded: Too many requests (429)'
    await sendWorkflowFailureNotification({
      workflowId: 'workflow-456',
      executionId: 'exec-456',
      executionTime: executionTime,
      error: new Error(errorMessage),
      failedBlockId: 'block-789',
    })

    // Step 3: Verify email template was rendered with correct metadata
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          userName: 'Jane Engineer',
          workflowName: 'Data Processing Workflow',
          executionTime: '2m 34s', // Properly formatted execution time
          errorMessage: errorMessage,
          failureDate: expect.any(Date),
        }),
      })
    )

    // Step 4: Verify email was sent to correct recipient with failure subject
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'data-engineer@example.com',
        subject: expect.stringContaining('Data Processing Workflow'),
      })
    )
  })

  it('should handle string errors in addition to Error objects', async () => {
    // Step 1: Setup
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
    const { sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send notification with string error (not Error object)
    const errorString = 'Invalid API key provided'
    await sendWorkflowFailureNotification({
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 30000,
      error: errorString, // Plain string error
    })

    // Step 3: Verify email template was rendered with string error converted correctly
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          errorMessage: errorString,
        }),
      })
    )

    // Step 4: Verify email was sent
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('should include detailsLink for viewing full error information', async () => {
    // Step 1: Setup
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
    const { sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Step 2: Send notification
    const workflowId = 'workflow-123'
    const executionId = 'exec-789'
    await sendWorkflowFailureNotification({
      workflowId,
      executionId,
      executionTime: 60000,
      error: 'Execution failed',
    })

    // Step 3: Verify detailsLink is included and properly formatted
    const baseUrl = APP_DOMAIN
    const expectedDetailsLink = `${baseUrl}/workflows/${workflowId}/runs/${executionId}`

    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          detailsLink: expectedDetailsLink,
        }),
      })
    )
  })
})
