import { VariableIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig, ParamType } from '../types'

interface VariableResponse extends ToolResponse {
  output: {
    content: string
    variableName: string
    variableValue: any
    variableType: string
    operation: string
    previousValue?: any
  }
}

export const VariableBlock: BlockConfig<VariableResponse> = {
  type: 'variable',
  name: 'Variable',
  description: 'Store and manage variables',
  longDescription:
    'Store, retrieve, and manipulate variables within your workflow. Supports different data types, operations like increment/decrement, and variable scoping for complex workflows.',
  category: 'blocks',
  bgColor: '#10B981',
  icon: VariableIcon,
  isUtility: true,
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Set Variable', id: 'set' },
        { label: 'Get Variable', id: 'get' },
        { label: 'Increment', id: 'increment' },
        { label: 'Decrement', id: 'decrement' },
        { label: 'Append', id: 'append' },
        { label: 'Prepend', id: 'prepend' },
        { label: 'Clear Variable', id: 'clear' },
        { label: 'Check Exists', id: 'exists' },
      ],
    },
    {
      id: 'variableName',
      title: 'Variable Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'userCount, totalSales, currentUser',
    },
    {
      id: 'variableValue',
      title: 'Variable Value',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Hello World, 42, {"name": "John", "age": 30}, [1, 2, 3]',
      rows: 3,
      condition: {
        field: 'operation',
        value: ['set', 'append', 'prepend'],
      },
    },
    {
      id: 'dataType',
      title: 'Data Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Auto Detect', id: 'auto' },
        { label: 'String', id: 'string' },
        { label: 'Number', id: 'number' },
        { label: 'Boolean', id: 'boolean' },
        { label: 'JSON Object', id: 'object' },
        { label: 'Array', id: 'array' },
      ],
      condition: {
        field: 'operation',
        value: ['set'],
      },
    },
    {
      id: 'incrementValue',
      title: 'Increment By',
      type: 'short-input',
      layout: 'half',
      placeholder: '1',
      condition: {
        field: 'operation',
        value: ['increment', 'decrement'],
      },
    },
    {
      id: 'scope',
      title: 'Variable Scope',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Workflow', id: 'workflow' },
        { label: 'Global', id: 'global' },
        { label: 'Session', id: 'session' },
        { label: 'Temporary', id: 'temp' },
      ],
    },
    {
      id: 'defaultValue',
      title: 'Default Value',
      type: 'short-input',
      layout: 'half',
      placeholder: '0, "", null, []',
      condition: {
        field: 'operation',
        value: ['get', 'increment', 'decrement'],
      },
    },
    {
      id: 'persistent',
      title: 'Persistent',
      type: 'switch',
      layout: 'half',
      description: 'Save variable across workflow runs',
    },
    {
      id: 'encrypted',
      title: 'Encrypted',
      type: 'switch',
      layout: 'half',
      description: 'Encrypt sensitive variable data',
    },
  ],
  tools: {
    access: ['variable_manager'],
    config: {
      tool: () => 'variable_manager',
      params: (params) => params,
    },
  },
  inputs: {
    operation: { type: 'string', required: false },
    variableName: { type: 'string', required: false },
    variableValue: { type: 'string' as ParamType, required: false },
    dataType: { type: 'string', required: false },
    incrementValue: { type: 'number', required: false },
    scope: { type: 'string', required: false },
    defaultValue: { type: 'string' as ParamType, required: false },
    persistent: { type: 'boolean', required: false },
    encrypted: { type: 'boolean', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        variableName: 'string',
        variableValue: 'json',
        variableType: 'string',
        operation: 'string',
        previousValue: 'json',
      },
    },
  },
}
