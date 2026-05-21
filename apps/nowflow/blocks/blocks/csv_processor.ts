import { FileTextIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface CSVProcessorResponse extends ToolResponse {
  output: {
    success: boolean
    data?: any[]
    csv?: string
    error?: string
    stats?: {
      rowCount: number
      columnCount: number
      columns: string[]
    }
  }
}

export const CSVProcessorBlock: BlockConfig<CSVProcessorResponse> = {
  type: 'csv_processor',
  name: 'CSV Processor',
  description: 'Process and transform CSV data',
  longDescription:
    'Parse, transform, filter, and generate CSV data with support for various operations like sorting, filtering, and aggregation.',
  category: 'tools',
  isUtility: true,
  bgColor: '#FF6B6B',
  icon: FileTextIcon,
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { label: 'Parse CSV to JSON', id: 'parse' },
        { label: 'Convert JSON to CSV', id: 'stringify' },
        { label: 'Filter CSV Data', id: 'filter' },
        { label: 'Sort CSV Data', id: 'sort' },
        { label: 'Aggregate CSV Data', id: 'aggregate' },
        { label: 'Transform CSV Data', id: 'transform' },
        { label: 'Get CSV Statistics', id: 'stats' },
      ],
    },
    {
      id: 'csvInput',
      title: 'CSV Input',
      type: 'long-input',
      layout: 'full',
      placeholder: 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles',
      condition: {
        field: 'operation',
        value: ['parse', 'filter', 'sort', 'aggregate', 'transform', 'stats'],
      },
      rows: 5,
    },
    {
      id: 'jsonInput',
      title: 'JSON Input (Array of Objects)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder:
        '[\n  {\n    "name": "John",\n    "age": 30,\n    "city": "New York"\n  },\n  {\n    "name": "Jane",\n    "age": 25,\n    "city": "Los Angeles"\n  }\n]',
      condition: {
        field: 'operation',
        value: ['stringify'],
      },
    },
    {
      id: 'delimiter',
      title: 'Delimiter',
      type: 'short-input',
      layout: 'half',
      placeholder: ',',
      condition: {
        field: 'operation',
        value: ['parse', 'stringify'],
      },
    },
    {
      id: 'header',
      title: 'Has Header',
      type: 'switch',
      layout: 'half',
      condition: {
        field: 'operation',
        value: ['parse', 'filter', 'sort', 'aggregate', 'transform'],
      },
    },
    {
      id: 'filterExpression',
      title: 'Filter Expression (JavaScript)',
      type: 'code',
      layout: 'full',
      language: 'javascript',
      placeholder:
        '// Return true to keep the row, false to filter it out\n// Example: Filter rows where age > 25\nrow.age > 25',
      condition: {
        field: 'operation',
        value: ['filter'],
      },
    },
    {
      id: 'sortColumn',
      title: 'Sort Column',
      type: 'short-input',
      layout: 'half',
      placeholder: 'age',
      condition: {
        field: 'operation',
        value: ['sort'],
      },
    },
    {
      id: 'sortDirection',
      title: 'Sort Direction',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Ascending', id: 'asc' },
        { label: 'Descending', id: 'desc' },
      ],
      condition: {
        field: 'operation',
        value: ['sort'],
      },
    },
    {
      id: 'aggregateColumn',
      title: 'Aggregate Column',
      type: 'short-input',
      layout: 'half',
      placeholder: 'age',
      condition: {
        field: 'operation',
        value: ['aggregate'],
      },
    },
    {
      id: 'aggregateFunction',
      title: 'Aggregate Function',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Sum', id: 'sum' },
        { label: 'Average', id: 'avg' },
        { label: 'Min', id: 'min' },
        { label: 'Max', id: 'max' },
        { label: 'Count', id: 'count' },
      ],
      condition: {
        field: 'operation',
        value: ['aggregate'],
      },
    },
    {
      id: 'groupByColumn',
      title: 'Group By Column',
      type: 'short-input',
      layout: 'full',
      placeholder: 'city',
      condition: {
        field: 'operation',
        value: ['aggregate'],
      },
    },
    {
      id: 'transformExpression',
      title: 'Transform Expression (JavaScript)',
      type: 'code',
      layout: 'full',
      language: 'javascript',
      placeholder:
        '// Transform each row\n// Example: Convert age to dog years\nreturn {\n  ...row,\n  age: row.age * 7\n};',
      condition: {
        field: 'operation',
        value: ['transform'],
      },
    },
  ],
  tools: {
    access: ['csv_processor'],
    config: {
      tool: () => 'csv_processor',
      params: (params: Record<string, any>) => {
        // Transform parameters based on operation
        const transformedParams: Record<string, any> = {
          operation: params.operation || 'parse',
        }

        // Add operation-specific parameters
        switch (params.operation) {
          case 'parse':
            transformedParams.csv = params.csvInput
            transformedParams.delimiter = params.delimiter || ','
            transformedParams.header = !!params.header
            break
          case 'stringify':
            transformedParams.data =
              typeof params.jsonInput === 'string' ? JSON.parse(params.jsonInput) : params.jsonInput
            transformedParams.delimiter = params.delimiter || ','
            break
          case 'filter':
            transformedParams.csv = params.csvInput
            transformedParams.header = !!params.header
            transformedParams.filterExpression = params.filterExpression
            break
          case 'sort':
            transformedParams.csv = params.csvInput
            transformedParams.header = !!params.header
            transformedParams.sortColumn = params.sortColumn
            transformedParams.sortDirection = params.sortDirection || 'asc'
            break
          case 'aggregate':
            transformedParams.csv = params.csvInput
            transformedParams.header = !!params.header
            transformedParams.aggregateColumn = params.aggregateColumn
            transformedParams.aggregateFunction = params.aggregateFunction
            transformedParams.groupByColumn = params.groupByColumn
            break
          case 'transform':
            transformedParams.csv = params.csvInput
            transformedParams.header = !!params.header
            transformedParams.transformExpression = params.transformExpression
            break
          case 'stats':
            transformedParams.csv = params.csvInput
            transformedParams.header = !!params.header
            break
        }

        return transformedParams
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    csvInput: { type: 'string', required: false },
    jsonInput: { type: 'json', required: false },
    delimiter: { type: 'string', required: false },
    header: { type: 'boolean', required: false },
    filterExpression: { type: 'string', required: false },
    sortColumn: { type: 'string', required: false },
    sortDirection: { type: 'string', required: false },
    aggregateColumn: { type: 'string', required: false },
    aggregateFunction: { type: 'string', required: false },
    groupByColumn: { type: 'string', required: false },
    transformExpression: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        data: 'json',
        csv: 'string',
        error: 'string',
        stats: 'json',
      },
    },
  },
}
