import { describe, expect, it, vi } from 'vitest'
import { DataAnalysisAgentBlock } from '../data_analysis_agent'

vi.mock('@/components/icons', () => ({ BarChartIcon: () => null }))

describe('DataAnalysisAgentBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(DataAnalysisAgentBlock).toBeDefined()
    expect(typeof DataAnalysisAgentBlock.type).toBe('string')
    expect(DataAnalysisAgentBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(DataAnalysisAgentBlock.subBlocks)).toBe(true)
  })

  it('has type data_analysis_agent in agents category', () => {
    expect(DataAnalysisAgentBlock.type).toBe('data_analysis_agent')
    expect(DataAnalysisAgentBlock.category).toBe('agents')
  })

  it('exposes data analysis tools in access', () => {
    expect(DataAnalysisAgentBlock.tools.access).toEqual(
      expect.arrayContaining([
        'function_execute',
        'json_processor',
        'math_processor',
        'text_processor',
      ])
    )
  })

  describe('params transformer', () => {
    const params = DataAnalysisAgentBlock.tools.config!.params!

    it('builds enhanced systemPrompt with analysisType/goal/output detail', () => {
      const result = params({
        dataset: 'a,b\n1,2',
        analysisType: 'trend',
        analysisGoal: 'Find growth',
        outputDetail: 'executive',
        visualizationTypes: 'charts',
      })
      expect(result.systemPrompt).toContain('Analysis Type: trend')
      expect(result.systemPrompt).toContain('Analysis Goal: Find growth')
      expect(result.systemPrompt).toContain('Output Detail Level: executive')
      expect(result.systemPrompt).toContain('Visualization Types: charts')
    })

    it('maps dataset to context', () => {
      const result = params({ dataset: 'csv-here' })
      expect(result.context).toBe('csv-here')
    })

    it('parses analysisParameters JSON string', () => {
      const result = params({
        dataset: 'd',
        analysisParameters: '{"confidenceLevel":0.99}',
      })
      expect(result.analysisParameters).toEqual({ confidenceLevel: 0.99 })
    })

    it('passes through already-parsed analysisParameters object', () => {
      const result = params({
        dataset: 'd',
        analysisParameters: { confidenceLevel: 0.95 },
      })
      expect(result.analysisParameters).toEqual({ confidenceLevel: 0.95 })
    })

    it('defaults missing analysisType to descriptive', () => {
      const result = params({ dataset: 'd' })
      expect(result.analysisType).toBe('descriptive')
    })

    it('transforms tools array, filtering out usageControl=none', () => {
      const result = params({
        dataset: 'd',
        tools: [
          { title: 'A', operation: 'op_a', usageControl: 'auto' },
          { title: 'B', operation: 'op_b', usageControl: 'none' },
          {
            title: 'C',
            type: 'custom-tool',
            schema: { function: { name: 'fn_c', description: 'd', parameters: {} } },
            usageControl: 'force',
          },
        ],
      })
      expect(result.tools).toHaveLength(2)
      const idsAfter = result.tools.map((t: any) => t.id)
      expect(idsAfter).toEqual(['op_a', 'fn_c'])
    })

    it('throws on malformed analysisParameters JSON', () => {
      expect(() => params({ dataset: 'd', analysisParameters: '{not json' })).toThrow()
    })
  })
})
