/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendCompletionNotification, sendFailureNotification } from '../notifications'

const { loggerErrorMock, sendWorkflowCompletionMock, sendWorkflowFailureMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  sendWorkflowCompletionMock: vi.fn(),
  sendWorkflowFailureMock: vi.fn(),
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
  })),
}))

vi.mock('@/lib/notifications/notification-service', () => ({
  sendWorkflowCompletionNotification: (...args: any[]) => sendWorkflowCompletionMock(...args),
  sendWorkflowFailureNotification: (...args: any[]) => sendWorkflowFailureMock(...args),
}))

/**
 * Wait for all microtasks (including chained Promises for dynamic imports) to flush.
 * Dynamic import() resolution needs a real tick of the event loop.
 */
const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
  }
}

describe('notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loggerErrorMock.mockReset()
    sendWorkflowCompletionMock.mockReset()
    sendWorkflowFailureMock.mockReset()
    // Ensure we are in a server-side context (no window)
    // `window` is not defined in node env already, but be explicit.
    delete globalThis.window
  })

  describe('sendCompletionNotification', () => {
    it('dispatches completion notification on success path (non-blocking)', async () => {
      sendWorkflowCompletionMock.mockResolvedValue(undefined)

      sendCompletionNotification({
        workflowId: 'wf-1',
        executionId: 'exec-1',
        executionTime: 1234,
        result: { response: { content: 'done' } },
      })

      await flushMicrotasks()

      expect(sendWorkflowCompletionMock).toHaveBeenCalledWith({
        workflowId: 'wf-1',
        executionId: 'exec-1',
        executionTime: 1234,
        result: { response: { content: 'done' } },
      })
      expect(loggerErrorMock).not.toHaveBeenCalled()
    })

    it('swallows rejection from the notification service and logs', async () => {
      sendWorkflowCompletionMock.mockRejectedValue(new Error('boom'))

      expect(() =>
        sendCompletionNotification({
          workflowId: 'wf-1',
          executionTime: 0,
          result: { response: {} },
        })
      ).not.toThrow()

      await flushMicrotasks()

      expect(sendWorkflowCompletionMock).toHaveBeenCalled()
      expect(loggerErrorMock).toHaveBeenCalledTimes(1)
      const [msg, meta] = loggerErrorMock.mock.calls[0]
      expect(msg).toContain('Failed to send workflow completion notification')
      expect(meta).toEqual(
        expect.objectContaining({
          workflowId: 'wf-1',
          error: expect.any(Error),
        })
      )
    })

    it('annotates the log message with debug mode tag', async () => {
      sendWorkflowCompletionMock.mockRejectedValue(new Error('fail'))

      sendCompletionNotification({
        workflowId: 'wf-1',
        executionTime: 0,
        result: { response: {} },
        debugMode: true,
      })

      await flushMicrotasks()

      expect(loggerErrorMock).toHaveBeenCalled()
      const [msg] = loggerErrorMock.mock.calls[0]
      expect(msg).toContain('(debug mode)')
    })

    it('is a no-op in a browser-like environment', async () => {
      globalThis.window = {} as Window & typeof globalThis
      sendCompletionNotification({
        workflowId: 'wf-1',
        executionTime: 0,
        result: { response: {} },
      })

      await flushMicrotasks()

      expect(sendWorkflowCompletionMock).not.toHaveBeenCalled()
      expect(loggerErrorMock).not.toHaveBeenCalled()

      delete globalThis.window
    })

    it('never throws even when synchronous execution paths blow up', () => {
      // Simulate a thrown error when constructing params handling — the function
      // itself is wrapped in try/catch, so the call must not throw.
      expect(() =>
        sendCompletionNotification({
          workflowId: 'wf-1',
          executionTime: 0,
          result: null as any,
        })
      ).not.toThrow()
    })
  })

  describe('sendFailureNotification', () => {
    it('dispatches failure notification with expected payload', async () => {
      sendWorkflowFailureMock.mockResolvedValue(undefined)

      sendFailureNotification({
        workflowId: 'wf-1',
        executionId: 'exec-1',
        error: 'something broke',
        executionTime: 42,
        failedBlockId: 'block-7',
      })

      await flushMicrotasks()

      expect(sendWorkflowFailureMock).toHaveBeenCalledWith({
        workflowId: 'wf-1',
        executionId: 'exec-1',
        error: 'something broke',
        executionTime: 42,
        failedBlockId: 'block-7',
      })
      expect(loggerErrorMock).not.toHaveBeenCalled()
    })

    it('logs and swallows rejection from the service', async () => {
      sendWorkflowFailureMock.mockRejectedValue(new Error('boom'))

      expect(() =>
        sendFailureNotification({
          workflowId: 'wf-1',
          error: 'err',
          executionTime: 0,
        })
      ).not.toThrow()

      await flushMicrotasks()

      expect(sendWorkflowFailureMock).toHaveBeenCalled()
      expect(loggerErrorMock).toHaveBeenCalledTimes(1)
      const [msg, meta] = loggerErrorMock.mock.calls[0]
      expect(msg).toContain('Failed to send workflow failure notification')
      expect(meta).toEqual(
        expect.objectContaining({ workflowId: 'wf-1', error: expect.any(Error) })
      )
    })

    it('tags the error log with debug mode when enabled', async () => {
      sendWorkflowFailureMock.mockRejectedValue(new Error('nope'))

      sendFailureNotification({
        workflowId: 'wf-1',
        error: 'x',
        executionTime: 1,
        debugMode: true,
      })

      await flushMicrotasks()

      expect(loggerErrorMock).toHaveBeenCalled()
      const [msg] = loggerErrorMock.mock.calls[0]
      expect(msg).toContain('(debug mode)')
    })

    it('is a no-op in a browser-like environment', async () => {
      globalThis.window = {} as Window & typeof globalThis
      sendFailureNotification({
        workflowId: 'wf-1',
        error: 'x',
        executionTime: 0,
      })

      await flushMicrotasks()

      expect(sendWorkflowFailureMock).not.toHaveBeenCalled()
      expect(loggerErrorMock).not.toHaveBeenCalled()

      delete globalThis.window
    })
  })
})
