import '../../../__test-utils__/mock-dependencies'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { recordAgentMetrics } from '@/lib/agents/metrics'
import { SerializedBlock } from '@/serializer/types'
import { ExecutionContext } from '../../../types'
import { HITLPauseError } from '../../approval/index'
import { HumanAgentBlockHandler } from '../human-agent-handler'

// Mock metrics module used by the handler
vi.mock('@/lib/agents/metrics', () => ({
  recordAgentMetrics: vi.fn(),
}))

// Mock the approval handler used internally
const { approvalExecute } = vi.hoisted(() => ({
  approvalExecute: vi.fn(),
}))

vi.mock('../../approval/index', async () => {
  const actual = await vi.importActual<any>('../../approval/index')
  class MockApprovalBlockHandler {
    execute = approvalExecute
    canHandle() {
      return true
    }
  }
  return {
    ...actual,
    ApprovalBlockHandler: MockApprovalBlockHandler,
  }
})

const mockRecordMetrics = recordAgentMetrics as Mock

describe('HumanAgentBlockHandler', () => {
  let handler: HumanAgentBlockHandler
  let mockBlock: SerializedBlock
  let mockContext: ExecutionContext

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new HumanAgentBlockHandler()

    mockBlock = {
      id: 'human-agent-block-1',
      metadata: { id: 'human_agent', name: 'Human Agent Block' },
      position: { x: 0, y: 0 },
      config: { tool: 'human_agent', params: {} },
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
    it('returns true for human_agent blocks', () => {
      expect(handler.canHandle(mockBlock)).toBe(true)
    })

    it('returns false for other block types', () => {
      const other: SerializedBlock = { ...mockBlock, metadata: { id: 'approval' } }
      expect(handler.canHandle(other)).toBe(false)
    })

    it('returns false for undefined metadata', () => {
      const other: SerializedBlock = { ...mockBlock, metadata: undefined }
      expect(handler.canHandle(other)).toBe(false)
    })
  })

  describe('execute - happy path', () => {
    it('maps inputs to approval inputs and records success metrics', async () => {
      const approvalResult = { response: { status: 'approved', response: 'ok' } }
      approvalExecute.mockResolvedValueOnce(approvalResult)

      const inputs = {
        agentName: 'Alice',
        agentRole: 'Reviewer',
        agentProfileId: 'profile-1',
        taskDescription: 'Please review the ticket',
        assignedToEmail: 'alice@example.com',
        notificationChannels: ['email'],
        timeoutMinutes: '30',
        priority: 'high',
        contextData: { foo: 'bar' },
        expectedResponseFormat: 'text',
      }

      const result = await handler.execute(mockBlock, inputs, mockContext)

      expect(result).toBe(approvalResult)
      expect(approvalExecute).toHaveBeenCalledTimes(1)

      const [, passedInputs] = approvalExecute.mock.calls[0]
      expect(passedInputs).toMatchObject({
        title: '[Human Agent: Alice] Please review the ticket',
        description: 'Please review the ticket',
        requestType: 'input',
        assignedToEmail: 'alice@example.com',
        notificationChannels: ['email'],
        timeoutMinutes: 30,
        priority: 'high',
        metadata: {
          isHumanAgent: true,
          agentName: 'Alice',
          agentRole: 'Reviewer',
          agentProfileId: 'profile-1',
          contextData: { foo: 'bar' },
          expectedResponseFormat: 'text',
        },
      })

      expect(mockRecordMetrics).toHaveBeenCalledTimes(1)
      expect(mockRecordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'wf-1',
          executionId: 'exec-1',
          blockId: 'human-agent-block-1',
          agentName: 'Alice',
          agentProfileId: 'profile-1',
          agentType: 'human',
          status: 'success',
        })
      )
    })

    it('uses default values for missing optional inputs', async () => {
      approvalExecute.mockResolvedValueOnce({ response: { ok: true } })

      await handler.execute(mockBlock, {}, mockContext)

      const [, passedInputs] = approvalExecute.mock.calls[0]
      expect(passedInputs.title).toBe('[Human Agent: Unnamed] Task')
      expect(passedInputs.description).toBe('')
      expect(passedInputs.notificationChannels).toEqual(['email', 'in_app'])
      expect(passedInputs.priority).toBe('normal')
      expect(passedInputs.timeoutMinutes).toBeUndefined()

      expect(mockRecordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: null,
          agentProfileId: null,
          status: 'success',
        })
      )
    })

    it('truncates long task descriptions in the title', async () => {
      approvalExecute.mockResolvedValueOnce({ response: { ok: true } })

      const longDesc = 'x'.repeat(250)
      await handler.execute(mockBlock, { agentName: 'Bob', taskDescription: longDesc }, mockContext)

      const [, passedInputs] = approvalExecute.mock.calls[0]
      expect(passedInputs.title).toBe('[Human Agent: Bob] ' + 'x'.repeat(100))
    })
  })

  describe('execute - HITL pause', () => {
    it('re-throws HITLPauseError without recording metrics', async () => {
      const pauseErr = new HITLPauseError('req-1', 'human-agent-block-1')
      approvalExecute.mockRejectedValueOnce(pauseErr)

      await expect(handler.execute(mockBlock, { agentName: 'Alice' }, mockContext)).rejects.toBe(
        pauseErr
      )
      expect(mockRecordMetrics).not.toHaveBeenCalled()
    })
  })

  describe('execute - failure paths', () => {
    it('records failure metrics and re-throws on generic errors', async () => {
      const err = new Error('approval service down')
      approvalExecute.mockRejectedValueOnce(err)

      await expect(
        handler.execute(mockBlock, { agentName: 'Alice', agentProfileId: 'p-1' }, mockContext)
      ).rejects.toThrow('approval service down')

      expect(mockRecordMetrics).toHaveBeenCalledTimes(1)
      expect(mockRecordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'wf-1',
          executionId: 'exec-1',
          blockId: 'human-agent-block-1',
          agentName: 'Alice',
          agentProfileId: 'p-1',
          agentType: 'human',
          status: 'failed',
          error: 'approval service down',
        })
      )
    })

    it('records timeout status when onTimeout is "fail"', async () => {
      approvalExecute.mockRejectedValueOnce(new Error('timed out'))

      await expect(
        handler.execute(mockBlock, { agentName: 'Alice', onTimeout: 'fail' }, mockContext)
      ).rejects.toThrow('timed out')

      expect(mockRecordMetrics).toHaveBeenCalledWith(expect.objectContaining({ status: 'timeout' }))
    })

    it('stringifies non-Error thrown values', async () => {
      approvalExecute.mockRejectedValueOnce('plain-string-error')

      await expect(handler.execute(mockBlock, {}, mockContext)).rejects.toBe('plain-string-error')

      expect(mockRecordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'plain-string-error' })
      )
    })

    it('defaults ids to empty string when context fields missing', async () => {
      approvalExecute.mockRejectedValueOnce(new Error('nope'))

      const ctx = { ...mockContext, workflowId: '', executionId: undefined as any }

      await expect(handler.execute(mockBlock, {}, ctx as ExecutionContext)).rejects.toThrow('nope')

      expect(mockRecordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: '', executionId: '' })
      )
    })
  })
})
