import '../../../__test-utils__/mock-dependencies'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { SerializedBlock } from '@/serializer/types'
import { ExecutionContext } from '../../../types'
import { ApprovalBlockHandler, HITLPauseError } from '../index'

const mockFetch = global.fetch as Mock

const okResponse = (data: any) =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })

const notOkResponse = (status: number, body: any) =>
  Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })

const emptyList = { success: true, data: [] }

describe('ApprovalBlockHandler', () => {
  let handler: ApprovalBlockHandler
  let mockBlock: SerializedBlock
  let mockContext: ExecutionContext

  beforeEach(() => {
    handler = new ApprovalBlockHandler()
    vi.clearAllMocks()

    mockBlock = {
      id: 'approval-block-1',
      metadata: { id: 'approval', name: 'Approval Block' },
      position: { x: 0, y: 0 },
      config: { tool: 'approval', params: {} },
      inputs: {},
      outputs: {},
      enabled: true,
    }

    mockContext = {
      workflowId: 'wf-1',
      executionId: 'exec-1',
      blockStates: new Map(),
      blockLogs: [],
      metadata: { duration: 0 },
      environmentVariables: {},
      decisions: { router: new Map(), condition: new Map() },
      loopIterations: new Map(),
      loopItems: new Map(),
      executedBlocks: new Set(),
      activeExecutionPath: new Set(),
      completedLoops: new Set(),
    }
  })

  describe('canHandle', () => {
    it('returns true for approval blocks', () => {
      expect(handler.canHandle(mockBlock)).toBe(true)
    })

    it('returns false for non-approval blocks', () => {
      const otherBlock: SerializedBlock = {
        ...mockBlock,
        metadata: { id: 'agent' },
      }
      expect(handler.canHandle(otherBlock)).toBe(false)
    })

    it('returns false when metadata is missing', () => {
      const noMetaBlock: SerializedBlock = {
        ...mockBlock,
        metadata: undefined,
      }
      expect(handler.canHandle(noMetaBlock)).toBe(false)
    })
  })

  describe('execute - new request', () => {
    it('creates a new HITL request and throws HITLPauseError', async () => {
      // No existing request - all three checks return empty
      mockFetch
        .mockImplementationOnce(() => okResponse(emptyList)) // pending
        .mockImplementationOnce(() => okResponse(emptyList)) // approved
        .mockImplementationOnce(() => okResponse(emptyList)) // rejected
        .mockImplementationOnce(() =>
          okResponse({ success: true, data: { id: 'req-new', status: 'pending' } })
        )

      const inputs = {
        title: 'Approve this',
        description: 'please',
        priority: 'high',
        timeoutMinutes: '15',
        retryCount: '2',
      }

      await expect(handler.execute(mockBlock, inputs, mockContext)).rejects.toBeInstanceOf(
        HITLPauseError
      )

      // fourth call should be POST to create request
      expect(mockFetch).toHaveBeenCalledTimes(4)
      const [createUrl, createInit] = mockFetch.mock.calls[3]
      expect(createUrl).toContain('/api/hitl/requests')
      expect(createInit.method).toBe('POST')
      const body = JSON.parse(createInit.body)
      expect(body).toMatchObject({
        workflowId: 'wf-1',
        executionId: 'exec-1',
        blockId: 'approval-block-1',
        title: 'Approve this',
        description: 'please',
        priority: 'high',
        requestType: 'approval',
        timeoutMinutes: 15,
        notificationChannels: ['email'],
      })
      expect(body.metadata.retryCount).toBe(2)
    })

    it('HITLPauseError carries the new request id and block id', async () => {
      mockFetch
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() =>
          okResponse({ success: true, data: { id: 'req-xyz', status: 'pending' } })
        )

      try {
        await handler.execute(mockBlock, { title: 't' }, mockContext)
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(HITLPauseError)
        expect((err as HITLPauseError).requestId).toBe('req-xyz')
        expect((err as HITLPauseError).blockId).toBe('approval-block-1')
        expect((err as HITLPauseError).status).toBe('pending')
      }
    })

    it('falls back to workflowId when executionId is not set', async () => {
      mockContext.executionId = undefined
      mockFetch
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() =>
          okResponse({ success: true, data: { id: 'req-1', status: 'pending' } })
        )

      await expect(handler.execute(mockBlock, { title: 't' }, mockContext)).rejects.toBeInstanceOf(
        HITLPauseError
      )

      const body = JSON.parse(mockFetch.mock.calls[3][1].body)
      expect(body.executionId).toBe('wf-1')
    })
  })

  describe('execute - existing request', () => {
    it('throws HITLPauseError if existing request is pending', async () => {
      mockFetch.mockImplementationOnce(() =>
        okResponse({ success: true, data: [{ id: 'req-pending', status: 'pending' }] })
      )

      await expect(handler.execute(mockBlock, { title: 't' }, mockContext)).rejects.toBeInstanceOf(
        HITLPauseError
      )

      // Should only call once (pending check short-circuits)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('returns approved response when existing request is approved', async () => {
      mockFetch
        .mockImplementationOnce(() => okResponse(emptyList)) // pending
        .mockImplementationOnce(() =>
          okResponse({
            success: true,
            data: [
              {
                id: 'req-approved',
                status: 'approved',
                response: 'yes',
                responseNote: 'looks good',
                respondedBy: 'user@example.com',
                respondedAt: '2024-01-01',
              },
            ],
          })
        )

      const result = (await handler.execute(mockBlock, { title: 't' }, mockContext)) as any

      expect(result).toEqual({
        response: {
          status: 'approved',
          response: 'yes',
          responseNote: 'looks good',
          respondedBy: 'user@example.com',
          respondedAt: '2024-01-01',
          requestId: 'req-approved',
        },
      })
    })

    it('returns rejected response when existing request is rejected', async () => {
      mockFetch
        .mockImplementationOnce(() => okResponse(emptyList)) // pending
        .mockImplementationOnce(() => okResponse(emptyList)) // approved
        .mockImplementationOnce(() =>
          okResponse({
            success: true,
            data: [
              {
                id: 'req-rejected',
                status: 'rejected',
                response: 'no',
                responseNote: 'not acceptable',
                respondedBy: 'user@example.com',
                respondedAt: '2024-01-02',
              },
            ],
          })
        )

      const result = (await handler.execute(mockBlock, { title: 't' }, mockContext)) as any

      expect(result.response.status).toBe('rejected')
      expect(result.response.error).toBe('Request was rejected')
      expect(result.response.requestId).toBe('req-rejected')
    })
  })

  describe('execute - errors', () => {
    it('ignores check errors and creates a new request (checkExistingRequest returns null)', async () => {
      mockFetch
        .mockImplementationOnce(() => Promise.reject(new Error('boom')))
        .mockImplementationOnce(() =>
          okResponse({ success: true, data: { id: 'req-new', status: 'pending' } })
        )

      await expect(handler.execute(mockBlock, { title: 't' }, mockContext)).rejects.toBeInstanceOf(
        HITLPauseError
      )
    })

    it('throws when HITL request creation fails (non-ok response)', async () => {
      mockFetch
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => notOkResponse(500, { error: 'server exploded' }))

      await expect(handler.execute(mockBlock, { title: 't' }, mockContext)).rejects.toThrow(
        'server exploded'
      )
    })

    it('throws when HITL request creation returns success=false', async () => {
      mockFetch
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse(emptyList))
        .mockImplementationOnce(() => okResponse({ success: false, error: 'validation failed' }))

      await expect(handler.execute(mockBlock, { title: 't' }, mockContext)).rejects.toThrow(
        'validation failed'
      )
    })
  })
})

describe('HITLPauseError', () => {
  it('sets name, message, requestId, blockId, and status', () => {
    const err = new HITLPauseError('req-1', 'block-1')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('HITLPauseError')
    expect(err.requestId).toBe('req-1')
    expect(err.blockId).toBe('block-1')
    expect(err.status).toBe('pending')
    expect(err.message).toContain('req-1')
  })
})
