import { BarChartIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getKnowledgeSourceSubBlocks, knowledgeSourceInputs } from './knowledge-config'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

interface DataAnalysisAgentResponse extends ToolResponse {
  output: {
    content: string
    model: string
    insights: Array<{
      type: 'trend' | 'correlation' | 'anomaly' | 'pattern'
      description: string
      confidence: number
      impact: 'high' | 'medium' | 'low'
    }>
    statistics: Record<string, any>
    visualizations: Array<{
      type: string
      data: any
      description: string
    }>
    recommendations: string[]
    dataQuality: {
      completeness: number
      accuracy: number
      consistency: number
      issues: string[]
    }
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
  }
}

export const DataAnalysisAgentBlock: BlockConfig<DataAnalysisAgentResponse> = {
  type: 'data_analysis_agent',
  name: 'Data Analysis Agent',
  description: 'Advanced data analysis and insights agent',
  longDescription:
    'Create a sophisticated data analysis agent that can process datasets, identify patterns, generate insights, create visualizations, and provide actionable recommendations based on statistical analysis.',
  category: 'agents',
  bgColor: '#3B82F6',
  icon: BarChartIcon,
  subBlocks: [
    {
      id: 'agentProfileId',
      title: 'Agent Profile',
      type: 'agent-profile-selector',
      layout: 'full',
    },
    {
      id: 'systemPrompt',
      title: 'System Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'You are a data scientist and analyst...',
      rows: 4,
      value:
        () => `You are a data scientist and analyst with expertise in statistical analysis and data interpretation. Your role is to:
1. Analyze datasets and identify patterns, trends, and anomalies
2. Generate actionable insights from data
3. Perform statistical analysis and hypothesis testing
4. Assess data quality and identify issues
5. Create meaningful visualizations
6. Provide evidence-based recommendations
7. Explain complex findings in simple terms

Always ensure your analysis is thorough, accurate, and actionable.`,
      condition: {
        field: 'agentProfileId',
        value: '',
      },
    },
    {
      id: 'dataset',
      title: 'Dataset',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter dataset (CSV, JSON) or describe the data to analyze...',
      rows: 6,
    },
    {
      id: 'analysisType',
      title: 'Analysis Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Descriptive Analysis', id: 'descriptive' },
        { label: 'Trend Analysis', id: 'trend' },
        { label: 'Correlation Analysis', id: 'correlation' },
        { label: 'Anomaly Detection', id: 'anomaly' },
        { label: 'Predictive Analysis', id: 'predictive' },
        { label: 'Comparative Analysis', id: 'comparative' },
      ],
    },
    {
      id: 'analysisGoal',
      title: 'Analysis Goal',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., Identify sales trends, Find performance issues...',
    },
    ...getModelSubBlocks(),
    {
      id: 'analysisParameters',
      title: 'Analysis Parameters',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: `{
  "confidenceLevel": 0.95,
  "significanceThreshold": 0.05,
  "outlierMethod": "iqr",
  "correlationThreshold": 0.7,
  "trendPeriod": "monthly",
  "includeSeasonality": true
}`,
    },
    {
      id: 'visualizationTypes',
      title: 'Visualization Types',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Auto-select', id: 'auto' },
        { label: 'Charts & Graphs', id: 'charts' },
        { label: 'Statistical Plots', id: 'statistical' },
        { label: 'Heatmaps', id: 'heatmaps' },
        { label: 'Time Series', id: 'timeseries' },
      ],
    },
    {
      id: 'outputDetail',
      title: 'Output Detail',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Summary', id: 'summary' },
        { label: 'Detailed', id: 'detailed' },
        { label: 'Technical', id: 'technical' },
        { label: 'Executive', id: 'executive' },
      ],
    },
    {
      id: 'includeStatistics',
      title: 'Include Statistics',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'generateVisualizations',
      title: 'Generate Visualizations',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'tools',
      title: 'Tools',
      type: 'tool-input',
      layout: 'full',
    },
    {
      id: 'responseFormat',
      title: 'Response Format',
      type: 'code',
      layout: 'full',
      placeholder: `{
  "type": "object",
  "properties": {
    "insights": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {"type": "string", "enum": ["trend", "correlation", "anomaly", "pattern"]},
          "description": {"type": "string"},
          "confidence": {"type": "number"},
          "impact": {"type": "string", "enum": ["high", "medium", "low"]}
        }
      }
    },
    "statistics": {"type": "object"},
    "visualizations": {"type": "array"},
    "recommendations": {"type": "array", "items": {"type": "string"}},
    "dataQuality": {"type": "object"}
  }
}`,
      language: 'json',
      generationType: 'json-schema',
    },
    // Knowledge Sources Configuration (RAG/Semantic Search)
    ...getKnowledgeSourceSubBlocks(),
    // Memory Configuration (opt-in, works for all agent types)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: [
      'function_execute',
      'json_processor',
      'math_processor',
      'text_processor',
      'vision_tool',
      'file_parser',
    ],
    config: {
      tool: (params: Record<string, any>) => {
        const model = params.model || getDefaultModel('openai')
        if (!model) {
          throw new Error('No model selected')
        }
        const tool = getAllModelProviders()[model]
        if (!tool) {
          throw new Error(`Invalid model selected: ${model}`)
        }
        return tool
      },
      params: (params: Record<string, any>) => {
        // Parse analysis parameters
        const analysisParameters =
          typeof params.analysisParameters === 'string'
            ? JSON.parse(params.analysisParameters)
            : params.analysisParameters || {}

        // Build enhanced system prompt
        const baseSystemPrompt = params.systemPrompt || ''
        const analysisType = params.analysisType || 'descriptive'
        const analysisGoal = params.analysisGoal || ''
        const visualizationTypes = params.visualizationTypes || 'auto'
        const outputDetail = params.outputDetail || 'detailed'
        const includeStatistics = params.includeStatistics || true
        const generateVisualizations = params.generateVisualizations || true

        const instructions: string[] = []

        if (analysisType) {
          instructions.push(`Analysis Type: ${analysisType}`)
        }
        if (analysisGoal) {
          instructions.push(`Analysis Goal: ${analysisGoal}`)
        }
        if (visualizationTypes) {
          instructions.push(`Visualization Types: ${visualizationTypes}`)
        }
        if (outputDetail) {
          instructions.push(`Output Detail Level: ${outputDetail}`)
        }
        if (Object.keys(analysisParameters).length > 0) {
          instructions.push(`Analysis Parameters: ${JSON.stringify(analysisParameters, null, 2)}`)
        }
        if (includeStatistics) {
          instructions.push('Include statistical analysis in your response')
        }
        if (generateVisualizations) {
          instructions.push('Generate visualization recommendations')
        }

        const enhancedSystemPrompt = `${baseSystemPrompt}

Data Analysis Instructions:
${instructions.join('\n')}

The user will provide a dataset. Analyze it based on the above instructions.`

        // Handle tools array for agent execution
        if (params.tools && Array.isArray(params.tools)) {
          const transformedTools = params.tools
            .filter((tool: any) => (tool.usageControl || 'auto') !== 'none')
            .map((tool: any) => ({
              id: tool.type === 'custom-tool' ? tool.schema?.function?.name : tool.operation,
              name: tool.title,
              description: tool.type === 'custom-tool' ? tool.schema?.function?.description : '',
              params: tool.params || {},
              parameters: tool.type === 'custom-tool' ? tool.schema?.function?.parameters : {},
              usageControl: tool.usageControl || 'auto',
            }))

          return {
            ...params,
            systemPrompt: enhancedSystemPrompt,
            context: params.dataset,
            tools: transformedTools,
            analysisParameters,
            analysisType,
            visualizationTypes,
            outputDetail,
            includeStatistics,
            generateVisualizations,
          }
        }

        return {
          ...params,
          systemPrompt: enhancedSystemPrompt,
          context: params.dataset,
          analysisParameters,
          analysisType,
          visualizationTypes,
          outputDetail,
          includeStatistics,
          generateVisualizations,
        }
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    systemPrompt: { type: 'string', required: false },
    dataset: { type: 'string', required: true },
    analysisType: { type: 'string', required: false },
    analysisGoal: { type: 'string', required: false },
    model: { type: 'string', required: true },
    apiKey: { type: 'string', required: false }, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    temperature: { type: 'number', required: false },
    analysisParameters: { type: 'json', required: false },
    visualizationTypes: { type: 'string', required: false },
    outputDetail: { type: 'string', required: false },
    includeStatistics: { type: 'boolean', required: false },
    generateVisualizations: { type: 'boolean', required: false },
    tools: { type: 'json', required: false },
    responseFormat: { type: 'json', required: false },
    // Knowledge Sources Configuration
    ...knowledgeSourceInputs,
    // Memory Configuration (opt-in, works for all agent types)
    ...memoryConfigInputs,
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        model: 'string',
        insights: 'json',
        statistics: 'json',
        visualizations: 'json',
        recommendations: 'json',
        dataQuality: 'json',
        tokens: 'json',
      },
      dependsOn: {
        subBlockId: 'responseFormat',
        condition: {
          whenEmpty: {
            content: 'string',
            model: 'string',
            insights: 'json',
            statistics: 'json',
            visualizations: 'json',
            recommendations: 'json',
            dataQuality: 'json',
            tokens: 'json',
          },
          whenFilled: 'json',
        },
      },
    },
  },
}
