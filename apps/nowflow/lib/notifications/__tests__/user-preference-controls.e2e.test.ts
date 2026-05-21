/**
 * End-to-end test for user preference controls
 *
 * This test verifies the complete flow:
 * 1. GET /api/user/notification-preferences - returns preferences
 * 2. POST to disable workflowCompletion
 * 3. Execute workflow successfully - NO email sent
 * 4. Re-enable preference via POST
 * 5. Execute workflow again - email IS sent
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('UserPreferenceControlsE2E')

describe('User Preference Controls E2E', () => {
  let mockDb: any
  let mockSendEmail: any
  let mockRenderAsync: any
  let mockGetSession: any

  beforeEach(() => {
    vi.resetModules()

    // Mock the email rendering function
    mockRenderAsync = vi.fn().mockResolvedValue('<html>Mocked email content</html>')
    vi.doMock('@react-email/components', () => ({
      render: mockRenderAsync,
    }))

    // Mock the sendEmail function to track email sending
    mockSendEmail = vi.fn().mockResolvedValue({ success: true })
    vi.doMock('@/lib/mailer', () => ({
      sendEmail: mockSendEmail,
    }))

    // Mock session authentication
    mockGetSession = vi.fn().mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
    })
    vi.doMock('@/lib/auth', () => ({
      getSession: mockGetSession,
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
    // by the chainable mock's where/limit via `table._.name`.
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

    // Mock email component factories
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

  it('should complete full preference control flow: GET, disable, test, enable, test', async () => {
    // Initial preferences state - workflowCompletion is enabled
    let currentPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: true, // Initially enabled
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

    // Setup database mocks that return current preferences state
    const setupDbMocks = () => {
      mockDb.select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table: any) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              if (table._.name === 'user_notification_preferences') {
                return [currentPreferences]
              } else if (table._.name === 'workflow') {
                return [mockWorkflow]
              } else if (table._.name === 'user') {
                return [mockUser]
              }
              return []
            }),
          })),
        })),
      }))

      mockDb.update = vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((data: any) => ({
          where: vi.fn().mockImplementation(async () => {
            // Simulate updating the preferences
            currentPreferences = {
              ...currentPreferences,
              ...data,
              updatedAt: new Date(),
            }
            return undefined
          }),
        })),
      }))
    }

    setupDbMocks()

    // Import modules after mocks are set up
    const {
      getUserNotificationPreferences,
      updatePreferences,
      sendWorkflowCompletionNotification,
    } = await import('@/lib/notifications/notification-service')

    // Step 1: GET notification preferences - verify returns preferences
    logger.info('Step 1: Getting initial notification preferences')
    const initialPreferences = await getUserNotificationPreferences('user-123')
    expect(initialPreferences).toBeDefined()
    expect(initialPreferences?.workflowCompletion).toBe(true)
    logger.info('✓ Initial preferences retrieved successfully', { initialPreferences })

    // Step 2: POST to disable workflowCompletion
    logger.info('Step 2: Disabling workflowCompletion preference')
    setupDbMocks() // Reset mocks
    const updatedPreferences = await updatePreferences('user-123', {
      workflowCompletion: false,
    })
    expect(updatedPreferences.workflowCompletion).toBe(false)
    logger.info('✓ workflowCompletion disabled successfully', { updatedPreferences })

    // Step 3: Execute workflow successfully and verify NO email is sent
    logger.info('Step 3: Executing workflow with disabled preference')
    setupDbMocks() // Reset mocks to use updated preferences
    mockSendEmail.mockClear() // Clear previous email calls

    await sendWorkflowCompletionNotification({
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 60000,
      result: { success: true },
    })

    // Verify NO email was sent (respecting disabled preference)
    expect(mockSendEmail).not.toHaveBeenCalled()
    logger.info('✓ NO email sent (preference disabled)')

    // Step 4: Re-enable preference via POST
    logger.info('Step 4: Re-enabling workflowCompletion preference')
    setupDbMocks() // Reset mocks
    const reenabledPreferences = await updatePreferences('user-123', {
      workflowCompletion: true,
    })
    expect(reenabledPreferences.workflowCompletion).toBe(true)
    logger.info('✓ workflowCompletion re-enabled successfully', { reenabledPreferences })

    // Step 5: Execute workflow again and verify email IS sent
    logger.info('Step 5: Executing workflow with enabled preference')
    setupDbMocks() // Reset mocks to use re-enabled preferences
    mockSendEmail.mockClear() // Clear previous email calls
    mockRenderAsync.mockClear() // Clear previous render calls

    await sendWorkflowCompletionNotification({
      workflowId: 'workflow-123',
      executionId: 'exec-456',
      executionTime: 90000,
      result: { success: true },
    })

    // Verify email WAS sent (preference is now enabled)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Test Workflow'),
        html: expect.any(String),
      })
    )
    logger.info('✓ Email sent successfully (preference enabled)')

    // Verify email template was rendered
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          userName: 'Test User',
          workflowName: 'Test Workflow',
          executionTime: '1m 30s',
        }),
      })
    )
    logger.info('✓ Email template rendered with correct data')
  })

  it('should respect workflowFailure preference independently', async () => {
    // Test that disabling workflowCompletion does NOT affect workflowFailure notifications
    let currentPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: false, // Completion disabled
      workflowFailure: true, // Failure enabled
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
            if (table._.name === 'user_notification_preferences') {
              return [currentPreferences]
            } else if (table._.name === 'workflow') {
              return [mockWorkflow]
            } else if (table._.name === 'user') {
              return [mockUser]
            }
            return []
          }),
        })),
      })),
    }))

    const { sendWorkflowCompletionNotification, sendWorkflowFailureNotification } =
      await import('@/lib/notifications/notification-service')

    // Send completion notification - should NOT send email
    mockSendEmail.mockClear()
    await sendWorkflowCompletionNotification({
      workflowId: 'workflow-123',
      executionId: 'exec-123',
      executionTime: 60000,
      result: { success: true },
    })
    expect(mockSendEmail).not.toHaveBeenCalled()

    // Send failure notification - SHOULD send email
    mockSendEmail.mockClear()
    await sendWorkflowFailureNotification({
      workflowId: 'workflow-123',
      executionId: 'exec-124',
      error: 'Test error',
      executionTime: 30000,
    })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('failed'),
      })
    )
  })

  it('should handle partial preference updates', async () => {
    // Test that updating one preference does not affect others
    let currentPreferences = {
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

    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => [currentPreferences]),
        })),
      })),
    }))

    mockDb.update = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((data: any) => ({
        where: vi.fn().mockImplementation(async () => {
          // Simulate partial update - only update provided fields
          currentPreferences = {
            ...currentPreferences,
            ...data,
            updatedAt: new Date(),
          }
          return undefined
        }),
      })),
    }))

    const { updatePreferences } = await import('@/lib/notifications/notification-service')

    // Update only workflowCompletion
    const updatedPreferences = await updatePreferences('user-123', {
      workflowCompletion: false,
    })

    // Verify only workflowCompletion changed
    expect(updatedPreferences.workflowCompletion).toBe(false)
    expect(updatedPreferences.workflowFailure).toBe(true) // Unchanged
    expect(updatedPreferences.approvalRequests).toBe(true) // Unchanged
    expect(updatedPreferences.digestEnabled).toBe(false) // Unchanged
  })

  it('should handle digestSchedule preference updates', async () => {
    // Test updating digest schedule preference
    let currentPreferences = {
      id: 'pref-id',
      userId: 'user-123',
      workflowCompletion: true,
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: true,
      digestSchedule: 'daily',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => [currentPreferences]),
        })),
      })),
    }))

    mockDb.update = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((data: any) => ({
        where: vi.fn().mockImplementation(async () => {
          currentPreferences = {
            ...currentPreferences,
            ...data,
            updatedAt: new Date(),
          }
          return undefined
        }),
      })),
    }))

    const { updatePreferences } = await import('@/lib/notifications/notification-service')

    // Update digest schedule from daily to weekly
    const updatedPreferences = await updatePreferences('user-123', {
      digestSchedule: 'weekly',
    })

    expect(updatedPreferences.digestSchedule).toBe('weekly')
    expect(updatedPreferences.digestEnabled).toBe(true) // Unchanged
  })

  it('should create default preferences on first access', async () => {
    // Test that preferences are auto-created for new users
    let preferencesCreated = false
    const defaultPreferences = {
      id: 'new-pref-id',
      userId: 'new-user-123',
      workflowCompletion: true,
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: false,
      digestSchedule: 'daily',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            // First call returns empty (no preferences)
            // After insert, return the created preferences
            return preferencesCreated ? [defaultPreferences] : []
          }),
        })),
      })),
    }))

    mockDb.insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(async (data: any) => {
        preferencesCreated = true
        return undefined
      }),
    }))

    const { getUserNotificationPreferences } =
      await import('@/lib/notifications/notification-service')

    // Get preferences for a new user (should create defaults)
    const preferences = await getUserNotificationPreferences('new-user-123')

    // Verify preferences were created
    expect(mockDb.insert).toHaveBeenCalled()
    expect(preferences).toBeDefined()
    expect(preferences?.workflowCompletion).toBe(true) // Default is true
    expect(preferences?.workflowFailure).toBe(true) // Default is true
  })
})
