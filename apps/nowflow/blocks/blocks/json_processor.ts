import { CodeIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface JSONProcessorResponse extends ToolResponse {
  output: {
    content: string
    originalData: any
    processedData: any
    operation: string
    dataType: string
    size: number
    metadata: Record<string, any>
  }
}

export const JSONProcessorBlock: BlockConfig<JSONProcessorResponse> = {
  type: 'json_processor',
  name: 'JSON Processor',
  description: 'Process and transform JSON data',
  longDescription:
    'Process, transform, validate, and manipulate JSON data with various operations like filtering, mapping, merging, and extracting specific fields. Supports JSONPath queries and schema validation.',
  category: 'blocks',
  bgColor: '#F59E0B',
  icon: CodeIcon,
  isUtility: true,
  subBlocks: [
    {
      id: 'inputData',
      title: 'Input Data',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter JSON data...',
      rows: 6,
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Validate JSON', id: 'validate' },
        { label: 'Format/Pretty Print', id: 'format' },
        { label: 'Minify JSON', id: 'minify' },
        { label: 'Extract Field', id: 'extract' },
        { label: 'Filter Objects', id: 'filter' },
        { label: 'Map/Transform', id: 'map' },
        { label: 'Merge Objects', id: 'merge' },
        { label: 'JSONPath Query', id: 'jsonpath' },
        { label: 'Convert to CSV', id: 'to_csv' },
        { label: 'Convert to XML', id: 'to_xml' },
        { label: 'Flatten Object', id: 'flatten' },
        { label: 'Unflatten Object', id: 'unflatten' },
      ],
    },
    {
      id: 'outputFormat',
      title: 'Output Format',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'JSON', id: 'json' },
        { label: 'String', id: 'string' },
        { label: 'Array', id: 'array' },
        { label: 'Object', id: 'object' },
      ],
    },
    {
      id: 'fieldPath',
      title: 'Field Path / JSONPath',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., $.users[*].name or data.items',
      condition: {
        field: 'operation',
        value: ['extract', 'jsonpath'],
      },
    },
    {
      id: 'filterCondition',
      title: 'Filter Condition',
      type: 'long-input',
      layout: 'full',
      placeholder: 'item => item.age > 18',
      rows: 3,
      condition: {
        field: 'operation',
        value: ['filter'],
      },
    },
    {
      id: 'mapFunction',
      title: 'Map Function',
      type: 'long-input',
      layout: 'full',
      placeholder: 'item => ({ ...item, fullName: item.firstName + " " + item.lastName })',
      rows: 3,
      condition: {
        field: 'operation',
        value: ['map'],
      },
    },
    {
      id: 'mergeData',
      title: 'Data to Merge',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Additional JSON data to merge...',
      rows: 4,
      condition: {
        field: 'operation',
        value: ['merge'],
      },
    },
    {
      id: 'schema',
      title: 'JSON Schema',
      type: 'long-input',
      layout: 'full',
      placeholder: 'JSON Schema for validation...',
      rows: 4,
      condition: {
        field: 'operation',
        value: ['validate'],
      },
    },
    {
      id: 'preserveTypes',
      title: 'Preserve Data Types',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'sortKeys',
      title: 'Sort Keys',
      type: 'switch',
      layout: 'half',
    },
  ],
  tools: {
    access: ['json_processor'],
    config: {
      tool: () => 'json_processor',
      params: (params) => params,
    },
  },
  inputs: {
    inputData: { type: 'json', required: false },
    operation: { type: 'string', required: false },
    outputFormat: { type: 'string', required: false },
    fieldPath: { type: 'string', required: false },
    filterCondition: { type: 'string', required: false },
    mapFunction: { type: 'string', required: false },
    mergeData: { type: 'json', required: false },
    schema: { type: 'json', required: false },
    preserveTypes: { type: 'boolean', required: false },
    sortKeys: { type: 'boolean', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        originalData: 'json',
        processedData: 'json',
        operation: 'string',
        dataType: 'string',
        size: 'number',
        metadata: 'json',
      },
    },
  },
}
