import '../../../__test-utils__/mock-dependencies'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { SerializedBlock } from '@/serializer/types'
import { ExecutionContext } from '../../../types'
import { SubWorkflowBlockHandler } from '../sub-workflow-handler'

const mockFetch = global.fetch as Mock

const okResponse = (data: any) =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })

const notOkResponse = (status: number, text: string) =>
  Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({ error: text }),
    text: () => Promise.resolve(text),
  })

describe('SubWorkflowBlockHandler', () => {
  let handler: SubWorkflowBlockHandler
  let mockBlock: SerializedBlock
  let mockContext: ExecutionContext

  beforeEach(() => {
    handler = new SubWorkflowBlockHandler()
    vi.clearAllMocks()

    mockBlock = {
      id: 'sub-wf-block-1',
      metadata: { id: 'sub-workflow', name: 'Sub Workflow Block' },
      position: { x: 0, y: 0 },
      config: { tool: 'sub-workflow', params: {} },
      inputs: {},
      outputs: {},
      enabled: true,
    }

    mockContext = {
      workflowId: 'parent-wf-1',
      executionId: 'parent-exec-1',
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
    it('returns true for sub-workflow blocks', () => {
      expect(handler.canHandle(mockBlock)).toBe(true)
    })

    it('returns false for non-sub-workflow blocks', () => {
      const other: SerializedBlock = { ...mockBlock, metadata: { id: 'agent' } }
      expect(handler.canHandle(other)).toBe(false)
    })

    it('returns false when metadata is undefined', () => {
      const other: SerializedBlock = { ...mockBlock, metadata: undefined }
      expect(handler.canHandle(other)).toBe(false)
    })
  })

  describe('execute - happy path', () => {
    it('spawns sub-workflow via execute endpoint and returns aggregated result', async () => {
      const responseData = {
        executionId: 'child-exec-1',
        output: { foo: 'bar' },
      }
      mockFetch.mockImplementationOnce(() => okResponse(responseData))

      const inputs = {
        workflowId: 'child-wf',
        inputData: { x: 1 },
      }

      const result = (await handler.execute(mockBlock, inputs, mockContext)) as any

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('http://localhost:3000/api/workflows/child-wf/execute')
      expect(init.method).toBe('POST')
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(init.body)).toEqual({ input: { x: 1 } })

      expect(result).toEqual({
        response: {
          content: responseData,
          status: 'completed',
          executionId: 'child-exec-1',
        },
      })
    })

    it('parses JSON string inputData', async () => {
      mockFetch.mockImplementationOnce(() => okResponse({ executionId: 'c-1' }))

      await handler.execute(
        mockBlock,
        { workflowId: 'child-wf', inputData: '{"foo":"bar"}' },
        mockContext
      )

      const init = mockFetch.mock.calls[0][1]
      expect(JSON.parse(init.body)).toEqual({ input: { foo: 'bar' } })
    })

    it('keeps inputData as a string when JSON parse fails', async () => {
      mockFetch.mockImplementationOnce(() => okResponse({ executionId: 'c-1' }))

      await handler.execute(
        mockBlock,
        { workflowId: 'child-wf', inputData: 'not json' },
        mockContext
      )

      const init = mockFetch.mock.calls[0][1]
      expect(JSON.parse(init.body)).toEqual({ input: 'not json' })
    })

    it('defaults inputData to {} when null or undefined', async () => {
      mockFetch.mockImplementation(() => okResponse({ executionId: 'c-1' }))

      await handler.execute(mockBlock, { workflowId: 'child-wf', inputData: null }, mockContext)
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ input: {} })

      mockFetch.mockClear()
      await handler.execute(mockBlock, { workflowId: 'child-wf' }, mockContext)
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ input: {} })
    })

    it('returns empty executionId when response has none', async () => {
      mockFetch.mockImplementationOnce(() => okResponse({ result: 'ok' }))

      const result = (await handler.execute(
        mockBlock,
        { workflowId: 'child-wf' },
        mockContext
      )) as any

      expect(result.response.executionId).toBe('')
      expect(result.response.status).toBe('completed')
      expect(result.response.content).toEqual({ result: 'ok' })
    })

    it('trims whitespace from workflowId', async () => {
      mockFetch.mockImplementationOnce(() => okResponse({ executionId: 'c-1' }))

      await handler.execute(mockBlock, { workflowId: '  child-wf  ' }, mockContext)

      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://localhost:3000/api/workflows/child-wf/execute'
      )
    })

    it('uses context.apiBaseUrl when provided', async () => {
      mockFetch.mockImplementationOnce(() => okResponse({ executionId: 'c-1' }))

      const ctx = { ...mockContext, apiBaseUrl: 'https://api.example.com' } as ExecutionContext

      await handler.execute(mockBlock, { workflowId: 'child-wf' }, ctx)

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.example.com/api/workflows/child-wf/execute'
      )
    })
  })

  describe('execute - error paths', () => {
    it('throws when workflowId is missing', async () => {
      await expect(handler.execute(mockBlock, {}, mockContext)).rejects.toThrow(
        'Sub-Workflow: Workflow ID is required'
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('throws when workflowId is only whitespace', async () => {
      await expect(handler.execute(mockBlock, { workflowId: '   ' }, mockContext)).rejects.toThrow(
        'Sub-Workflow: Workflow ID is required'
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('throws a descriptive error when the sub-workflow fetch responds non-ok', async () => {
      mockFetch.mockImplementationOnce(() => notOkResponse(500, 'internal boom'))

      await expect(
        handler.execute(mockBlock, { workflowId: 'child-wf' }, mockContext)
      ).rejects.toThrow('Sub-Workflow failed (500): internal boom')
    })

    it('falls back to statusText when body text() rejects', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.reject(new Error('stream read failed')),
          json: () => Promise.resolve({}),
        })
      )

      await expect(
        handler.execute(mockBlock, { workflowId: 'child-wf' }, mockContext)
      ).rejects.toThrow('Sub-Workflow failed (404): Not Found')
    })

    it('bubbles up network errors from fetch', async () => {
      mockFetch.mockImplementationOnce(() => Promise.reject(new Error('network down')))

      await expect(
        handler.execute(mockBlock, { workflowId: 'child-wf' }, mockContext)
      ).rejects.toThrow('network down')
    })
  })
})
