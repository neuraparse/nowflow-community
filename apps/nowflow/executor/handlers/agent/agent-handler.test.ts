import '../../__test-utils__/mock-dependencies'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { getAllBlocks } from '@/blocks'
import { executeProviderRequest } from '@/providers'
import { getApiKey, getProviderFromModel, transformBlockTool } from '@/providers/utils'
import { SerializedBlock, SerializedWorkflow } from '@/serializer/types'
import { executeTool } from '@/tools'
import { ExecutionContext, StreamingExecution } from '../../types'
import { AgentBlockHandler } from './agent-handler'

// Mock db to prevent loading the real schema in tests
vi.mock('@/db', () => ({
  db: {},
  sql: vi.fn(),
}))
vi.mock('@/db/schema', () => ({}))

// Additional mocks specific to the agent handler
vi.mock('@/lib/subscription', () => ({
  isProPlan: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/memory', () => {
  const MemoryHelper = {
    initialize: vi.fn().mockResolvedValue({
      service: null,
      history: [],
      sessionContext: null,
      enabled: false,
    }),
    saveConversation: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue(undefined),
    formatForMessages: vi.fn().mockReturnValue([]),
    formatStatsForOutput: vi.fn().mockReturnValue({}),
  }
  return { MemoryHelper }
})

vi.mock('@/lib/agents/metrics', () => ({
  recordAgentMetrics: vi.fn(),
}))

vi.mock('@/lib/ai/provider-config', () => ({
  getDefaultModel: vi.fn().mockReturnValue('gpt-4o'),
}))

vi.mock('@/providers/model-capabilities', () => ({
  supportsTemperature: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/ai/model-router', () => ({
  getModelRouter: vi.fn().mockReturnValue({
    analyzeTask: vi.fn().mockReturnValue({ taskType: 'general', complexity: 'low' }),
    route: vi.fn().mockReturnValue({
      selectedModel: 'gpt-4o',
      tier: 'standard',
      reason: 'default',
      estimatedCost: 0,
    }),
  }),
}))

vi.mock('./profile', () => ({
  resolveAgentProfileForBlock: vi.fn().mockResolvedValue(null),
  buildPersonaSystemPrompt: vi.fn().mockReturnValue(''),
}))

vi.mock('./prompt-composition', () => ({
  detectActiveFeatures: vi.fn().mockReturnValue({
    profile: false,
    knowledge: false,
    webResearch: false,
    webResearchSources: [],
    memory: false,
    tools: false,
    responseFormat: false,
  }),
  composeSystemPrompt: vi.fn((features) => features.systemPrompt || ''),
}))

vi.mock('./knowledge', () => ({
  searchKnowledge: vi.fn().mockResolvedValue({ context: null, resultCount: 0 }),
}))

vi.mock('./web-research-tools', () => ({
  getWebResearchToolsForAgent: vi.fn().mockReturnValue([]),
}))

vi.mock('./context-utils', () => ({
  resolveAgentContextValue: vi.fn((inputs) => inputs.context),
  normalizeContextValue: vi.fn((val) => {
    if (val === undefined || val === null) return val
    if (typeof val === 'string') return val
    return JSON.stringify(val, null, 2)
  }),
}))

vi.mock('@/blocks', () => ({
  getAllBlocks: vi.fn().mockReturnValue([]),
}))

vi.mock('@/tools', () => ({
  executeTool: vi.fn(),
}))

const mockGetAllBlocks = getAllBlocks as Mock
const mockExecuteTool = executeTool as Mock
const mockGetProviderFromModel = getProviderFromModel as Mock
const mockGetApiKey = getApiKey as Mock
const mockTransformBlockTool = transformBlockTool as Mock
const mockExecuteProviderRequest = executeProviderRequest as Mock

describe('AgentBlockHandler', () => {
  let handler: AgentBlockHandler
  let mockBlock: SerializedBlock
  let mockContext: ExecutionContext
  let originalPromiseAll: any

  beforeEach(() => {
    handler = new AgentBlockHandler()
    vi.clearAllMocks()

    originalPromiseAll = Promise.all

    mockBlock = {
      id: 'test-agent-block',
      metadata: { id: 'agent', name: 'Test Agent' },
      type: 'agent',
      position: { x: 0, y: 0 },
      config: {
        tool: 'mock-tool',
        params: {},
      },
      inputs: {},
      outputs: {},
      enabled: true,
    } as SerializedBlock

    mockContext = {
      workflowId: 'test-workflow',
      blockStates: new Map(),
      blockLogs: [],
      metadata: { startTime: new Date().toISOString(), duration: 0 },
      environmentVariables: {},
      decisions: { router: new Map(), condition: new Map() },
      loopIterations: new Map(),
      loopItems: new Map(),
      completedLoops: new Set(),
      executedBlocks: new Set(),
      activeExecutionPath: new Set(),
      workflow: {
        blocks: [],
        connections: [],
        version: '1.0.0',
        loops: {},
      } as SerializedWorkflow,
    }

    mockGetProviderFromModel.mockReturnValue('openai')
    mockGetApiKey.mockReturnValue('resolved-api-key')

    mockExecuteProviderRequest.mockResolvedValue({
      content: 'Mocked response content',
      model: 'mock-model',
      tokens: { prompt: 10, completion: 20, total: 30 },
      toolCalls: [],
      cost: 0.001,
      timing: { total: 100 },
    })

    mockTransformBlockTool.mockImplementation((tool: any) => ({
      id: `transformed_${tool.id}`,
      name: `${tool.id}_${tool.operation}`,
      description: 'Transformed tool',
      parameters: { type: 'object', properties: {} },
    }))
    mockGetAllBlocks.mockReturnValue([])

    mockExecuteTool.mockImplementation((toolId, params) => {
      if (toolId === 'function_execute') {
        return Promise.resolve({
          success: true,
          output: { result: 'Executed successfully', params },
        })
      }
      return Promise.resolve({ success: false, error: 'Unknown tool' })
    })
  })

  afterEach(() => {
    Promise.all = originalPromiseAll
  })

  describe('canHandle', () => {
    it('should return true for blocks with metadata id "agent"', () => {
      expect(handler.canHandle(mockBlock)).toBe(true)
    })

    it('should return false for blocks without metadata id "agent"', () => {
      const nonAgentBlock: SerializedBlock = {
        ...mockBlock,
        metadata: { id: 'other-block' },
      }
      expect(handler.canHandle(nonAgentBlock)).toBe(false)
    })

    it('should return false for blocks without metadata', () => {
      const noMetadataBlock: SerializedBlock = {
        ...mockBlock,
        metadata: undefined,
      }
      expect(handler.canHandle(noMetadataBlock)).toBe(false)
    })
  })

  describe('execute', () => {
    it('should execute a basic agent block request', async () => {
      const inputs = {
        model: 'gpt-4o',
        systemPrompt: 'You are a helpful assistant.',
        context: 'User query: Hello!',
        temperature: 0.7,
        maxTokens: 100,
        apiKey: 'test-api-key',
      }

      const expectedOutput = {
        response: {
          content: 'Mocked response content',
          model: 'mock-model',
          tokens: { prompt: 10, completion: 20, total: 30 },
          toolCalls: { list: [], count: 0 },
          providerTiming: { total: 100 },
          cost: 0.001,
        },
      }

      const result = await handler.execute(mockBlock, inputs, mockContext)

      expect(mockGetProviderFromModel).toHaveBeenCalledWith('gpt-4o')
      expect(mockExecuteProviderRequest).toHaveBeenCalledWith('openai', expect.any(Object))
      expect(result).toEqual(expectedOutput)
    })

    it('should preserve executeFunction for custom tools with different usageControl settings', async () => {
      let capturedTools: any[] = []

      Promise.all = vi.fn().mockImplementation((promises: Promise<any>[]) => {
        const result = originalPromiseAll.call(Promise, promises)
        result.then((items: any[]) => {
          // Only capture arrays that look like tools (have schema.function or name+parameters)
          if (
            items &&
            items.length &&
            items.some((t) => t && typeof t === 'object' && 'parameters' in t)
          ) {
            capturedTools = items.filter((t) => t !== null)
          }
        })
        return result
      })

      mockExecuteProviderRequest.mockResolvedValueOnce({
        content: 'Using tools to respond',
        model: 'mock-model',
        tokens: { prompt: 10, completion: 20, total: 30 },
        toolCalls: [
          { name: 'auto_tool', arguments: { input: 'test input for auto tool' } },
          { name: 'force_tool', arguments: { input: 'test input for force tool' } },
        ],
        timing: { total: 100 },
      })

      const inputs = {
        model: 'gpt-4o',
        context: 'Test custom tools with different usageControl settings',
        apiKey: 'test-api-key',
        tools: [
          {
            type: 'custom-tool',
            title: 'Auto Tool',
            code: 'return { result: "auto tool executed", input }',
            timeout: 1000,
            schema: {
              function: {
                name: 'auto_tool',
                description: 'Custom tool with auto usage control',
                parameters: {
                  type: 'object',
                  properties: { input: { type: 'string' } },
                },
              },
            },
            usageControl: 'auto',
          },
          {
            type: 'custom-tool',
            title: 'Force Tool',
            code: 'return { result: "force tool executed", input }',
            timeout: 1000,
            schema: {
              function: {
                name: 'force_tool',
                description: 'Custom tool with forced usage control',
                parameters: {
                  type: 'object',
                  properties: { input: { type: 'string' } },
                },
              },
            },
            usageControl: 'force',
          },
          {
            type: 'custom-tool',
            title: 'None Tool',
            code: 'return { result: "none tool executed", input }',
            timeout: 1000,
            schema: {
              function: {
                name: 'none_tool',
                description: 'Custom tool that should be filtered out',
                parameters: {
                  type: 'object',
                  properties: { input: { type: 'string' } },
                },
              },
            },
            usageControl: 'none',
          },
        ],
      }

      await handler.execute(mockBlock, inputs, mockContext)

      expect(Promise.all).toHaveBeenCalled()
      expect(capturedTools.length).toBe(2)

      const autoTool = capturedTools.find((t) => t.name === 'auto_tool')
      const forceTool = capturedTools.find((t) => t.name === 'force_tool')
      const noneTool = capturedTools.find((t) => t.name === 'none_tool')

      expect(autoTool).toBeDefined()
      expect(forceTool).toBeDefined()
      expect(noneTool).toBeUndefined()

      expect(autoTool.usageControl).toBe('auto')
      expect(forceTool.usageControl).toBe('force')

      expect(typeof autoTool.executeFunction).toBe('function')
      expect(typeof forceTool.executeFunction).toBe('function')

      await autoTool.executeFunction({ input: 'test input' })
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'function_execute',
        expect.objectContaining({
          code: 'return { result: "auto tool executed", input }',
          input: 'test input',
        })
      )

      await forceTool.executeFunction({ input: 'another test' })
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'function_execute',
        expect.objectContaining({
          code: 'return { result: "force tool executed", input }',
          input: 'another test',
        })
      )

      const callArgs = mockExecuteProviderRequest.mock.calls[0]
      const requestBody = callArgs[1]
      expect(requestBody.tools.length).toBe(2)
    })

    it('should filter out tools with usageControl set to "none"', async () => {
      const inputs = {
        model: 'gpt-4o',
        context: 'Use the tools provided.',
        apiKey: 'test-api-key',
        tools: [
          {
            id: 'tool_1',
            title: 'Tool 1',
            type: 'tool-type-1',
            operation: 'operation1',
            usageControl: 'auto',
          },
          {
            id: 'tool_2',
            title: 'Tool 2',
            type: 'tool-type-2',
            operation: 'operation2',
            usageControl: 'none',
          },
          {
            id: 'tool_3',
            title: 'Tool 3',
            type: 'tool-type-3',
            operation: 'operation3',
            usageControl: 'force',
          },
        ],
      }

      await handler.execute(mockBlock, inputs, mockContext)

      const callArgs = mockExecuteProviderRequest.mock.calls[0]
      const requestBody = callArgs[1]
      expect(requestBody.tools.length).toBe(2)

      const toolIds = requestBody.tools.map((t: any) => t.id)
      expect(toolIds).toContain('transformed_tool_1')
      expect(toolIds).toContain('transformed_tool_3')
      expect(toolIds).not.toContain('transformed_tool_2')
    })

    it('should include usageControl property in transformed tools', async () => {
      const inputs = {
        model: 'gpt-4o',
        context: 'Use the tools with different usage controls.',
        apiKey: 'test-api-key',
        tools: [
          {
            id: 'tool_1',
            title: 'Tool 1',
            type: 'tool-type-1',
            operation: 'operation1',
            usageControl: 'auto',
          },
          {
            id: 'tool_2',
            title: 'Tool 2',
            type: 'tool-type-2',
            operation: 'operation2',
            usageControl: 'force',
          },
        ],
      }

      await handler.execute(mockBlock, inputs, mockContext)

      const callArgs = mockExecuteProviderRequest.mock.calls[0]
      const requestBody = callArgs[1]
      expect(requestBody.tools[0].usageControl).toBe('auto')
      expect(requestBody.tools[1].usageControl).toBe('force')
    })

    it('should handle custom tools with usageControl properties', async () => {
      const inputs = {
        model: 'gpt-4o',
        context: 'Use the custom tools.',
        apiKey: 'test-api-key',
        tools: [
          {
            type: 'custom-tool',
            title: 'Custom Tool - Auto',
            schema: {
              function: {
                name: 'custom_tool_auto',
                description: 'A custom tool with auto usage control',
                parameters: { type: 'object', properties: { input: { type: 'string' } } },
              },
            },
            usageControl: 'auto',
          },
          {
            type: 'custom-tool',
            title: 'Custom Tool - Force',
            schema: {
              function: {
                name: 'custom_tool_force',
                description: 'A custom tool with forced usage',
                parameters: { type: 'object', properties: { input: { type: 'string' } } },
              },
            },
            usageControl: 'force',
          },
          {
            type: 'custom-tool',
            title: 'Custom Tool - None',
            schema: {
              function: {
                name: 'custom_tool_none',
                description: 'A custom tool that should not be used',
                parameters: { type: 'object', properties: { input: { type: 'string' } } },
              },
            },
            usageControl: 'none',
          },
        ],
      }

      await handler.execute(mockBlock, inputs, mockContext)

      const callArgs = mockExecuteProviderRequest.mock.calls[0]
      const requestBody = callArgs[1]
      expect(requestBody.tools.length).toBe(2)

      const toolNames = requestBody.tools.map((t: any) => t.name)
      expect(toolNames).toContain('custom_tool_auto')
      expect(toolNames).toContain('custom_tool_force')
      expect(toolNames).not.toContain('custom_tool_none')

      const autoTool = requestBody.tools.find((t: any) => t.name === 'custom_tool_auto')
      const forceTool = requestBody.tools.find((t: any) => t.name === 'custom_tool_force')

      expect(autoTool.usageControl).toBe('auto')
      expect(forceTool.usageControl).toBe('force')
    })

    it('should execute with standard block tools', async () => {
      const inputs = {
        model: 'gpt-4o',
        context: 'Analyze this data.',
        apiKey: 'test-api-key',
        tools: [
          {
            id: 'block_tool_1',
            title: 'Data Analysis Tool',
            operation: 'analyze',
          },
        ],
      }

      const mockToolDetails = {
        id: 'block_tool_1',
        name: 'data_analysis_analyze',
        description: 'Analyzes data',
        parameters: { type: 'object', properties: { input: { type: 'string' } } },
      }

      mockTransformBlockTool.mockReturnValue(mockToolDetails)

      const expectedOutput = {
        response: {
          content: 'Mocked response content',
          model: 'mock-model',
          tokens: { prompt: 10, completion: 20, total: 30 },
          toolCalls: { list: [], count: 0 },
          providerTiming: { total: 100 },
          cost: 0.001,
        },
      }

      const result = await handler.execute(mockBlock, inputs, mockContext)

      expect(mockTransformBlockTool).toHaveBeenCalledWith(
        inputs.tools[0],
        expect.objectContaining({ selectedOperation: 'analyze' })
      )
      expect(mockExecuteProviderRequest).toHaveBeenCalledWith('openai', expect.any(Object))
      expect(result).toEqual(expectedOutput)
    })

    it('should execute with custom tools (schema only and with code)', async () => {
      const inputs = {
        model: 'gpt-4o',
        context: 'Use the custom tools.',
        apiKey: 'test-api-key',
        tools: [
          {
            type: 'custom-tool',
            title: 'Custom Schema Tool',
            schema: {
              function: {
                name: 'custom_schema_tool',
                description: 'A tool defined only by schema',
                parameters: { type: 'object', properties: { input: { type: 'string' } } },
              },
            },
          },
          {
            type: 'custom-tool',
            title: 'Custom Code Tool',
            code: 'return { result: input * 2 }',
            timeout: 1000,
            schema: {
              function: {
                name: 'custom_code_tool',
                description: 'A tool with code execution',
                parameters: { type: 'object', properties: { input: { type: 'number' } } },
              },
            },
          },
        ],
      }

      await handler.execute(mockBlock, inputs, mockContext)

      expect(mockExecuteProviderRequest).toHaveBeenCalledWith('openai', expect.any(Object))
    })

    it('should handle responseFormat with valid JSON', async () => {
      mockExecuteProviderRequest.mockResolvedValueOnce({
        content: '{"result": "Success", "score": 0.95}',
        model: 'mock-model',
        tokens: { prompt: 10, completion: 20, total: 30 },
        timing: { total: 100 },
      })

      const inputs = {
        model: 'gpt-4o',
        context: 'Test context',
        apiKey: 'test-api-key',
        responseFormat:
          '{"type":"object","properties":{"result":{"type":"string"},"score":{"type":"number"}}}',
      }

      const result = await handler.execute(mockBlock, inputs, mockContext)

      expect(result).toEqual({
        response: {
          result: 'Success',
          score: 0.95,
          tokens: { prompt: 10, completion: 20, total: 30 },
          providerTiming: { total: 100 },
        },
      })
    })

    it('should handle responseFormat when it is an empty string', async () => {
      mockExecuteProviderRequest.mockResolvedValueOnce({
        content: 'Regular text response',
        model: 'mock-model',
        tokens: { prompt: 10, completion: 20, total: 30 },
        timing: { total: 100 },
      })

      const inputs = {
        model: 'gpt-4o',
        context: 'Test context',
        apiKey: 'test-api-key',
        responseFormat: '',
      }

      const result = await handler.execute(mockBlock, inputs, mockContext)

      expect(result).toEqual({
        response: {
          content: 'Regular text response',
          model: 'mock-model',
          tokens: { prompt: 10, completion: 20, total: 30 },
          toolCalls: { list: [], count: 0 },
          providerTiming: { total: 100 },
        },
      })
    })

    it('should ignore invalid JSON in responseFormat and still execute', async () => {
      const inputs = {
        model: 'gpt-4o',
        context: 'Format this output.',
        apiKey: 'test-api-key',
        responseFormat: '{invalid-json',
      }

      const result = await handler.execute(mockBlock, inputs, mockContext)
      expect(result).toHaveProperty('response')
    })

    it('should handle errors from the provider request', async () => {
      const inputs = {
        model: 'gpt-4o',
        context: 'This will fail.',
        apiKey: 'test-api-key',
      }

      mockExecuteProviderRequest.mockRejectedValueOnce(new Error('Provider API Error'))

      await expect(handler.execute(mockBlock, inputs, mockContext)).rejects.toThrow(
        'Provider API Error'
      )
    })

    it('should handle streaming responses when provider returns StreamingExecution', async () => {
      const mockStreamObj = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      mockExecuteProviderRequest.mockResolvedValueOnce({
        stream: mockStreamObj,
        execution: {
          success: true,
          output: {
            response: {
              content: 'Test streaming content',
              model: 'gpt-4o',
              tokens: { prompt: 10, completion: 5, total: 15 },
            },
          },
          logs: [],
          metadata: {
            startTime: new Date().toISOString(),
            duration: 150,
          },
        },
      })

      const inputs = {
        model: 'gpt-4o',
        context: 'Return a combined response.',
        apiKey: 'test-api-key',
        stream: true,
      }

      mockContext.stream = true
      mockContext.selectedOutputIds = [mockBlock.id]

      const result = await handler.execute(mockBlock, inputs, mockContext)

      expect(result).toHaveProperty('stream')
      expect(result).toHaveProperty('execution')

      expect((result as StreamingExecution).execution.success).toBe(true)
      expect((result as StreamingExecution).execution.output.response.content).toBe(
        'Test streaming content'
      )
      expect((result as StreamingExecution).execution.output.response.model).toBe('gpt-4o')
    })

    it('should handle ReadableStream directly from provider', async () => {
      const mockStreamObj = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      mockExecuteProviderRequest.mockResolvedValueOnce(mockStreamObj)

      const inputs = {
        model: 'gpt-4o',
        context: 'Stream this response.',
        apiKey: 'test-api-key',
        stream: true,
      }

      mockContext.stream = true
      mockContext.selectedOutputIds = [mockBlock.id]

      const result = await handler.execute(mockBlock, inputs, mockContext)

      expect(result).toHaveProperty('stream')
      expect(result).toHaveProperty('execution')
      expect((result as StreamingExecution).execution).toHaveProperty('success', true)
    })
  })
})
