import { CalculatorIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface MathResponse extends ToolResponse {
  output: {
    content: string
    operation: string
    result: number
    inputs: number[]
    expression?: string
    unit?: string
    precision: number
  }
}

export const MathBlock: BlockConfig<MathResponse> = {
  type: 'math',
  name: 'Math',
  description: 'Perform mathematical operations',
  longDescription:
    'Perform various mathematical operations including basic arithmetic, trigonometry, statistics, and custom expressions. Supports multiple number formats and precision control.',
  category: 'blocks',
  bgColor: '#3B82F6',
  icon: CalculatorIcon,
  isUtility: true,
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Add', id: 'add' },
        { label: 'Subtract', id: 'subtract' },
        { label: 'Multiply', id: 'multiply' },
        { label: 'Divide', id: 'divide' },
        { label: 'Power', id: 'power' },
        { label: 'Square Root', id: 'sqrt' },
        { label: 'Absolute Value', id: 'abs' },
        { label: 'Round', id: 'round' },
        { label: 'Floor', id: 'floor' },
        { label: 'Ceiling', id: 'ceil' },
        { label: 'Modulo', id: 'mod' },
        { label: 'Min', id: 'min' },
        { label: 'Max', id: 'max' },
        { label: 'Average', id: 'avg' },
        { label: 'Sum', id: 'sum' },
        { label: 'Sin', id: 'sin' },
        { label: 'Cos', id: 'cos' },
        { label: 'Tan', id: 'tan' },
        { label: 'Log', id: 'log' },
        { label: 'Random', id: 'random' },
        { label: 'Custom Expression', id: 'expression' },
      ],
    },
    {
      id: 'precision',
      title: 'Decimal Precision',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Number of decimal places (default: 2)',
    },
    {
      id: 'inputA',
      title: 'Input A',
      type: 'short-input',
      layout: 'half',
      placeholder: 'First number',
      condition: {
        field: 'operation',
        value: ['add', 'subtract', 'multiply', 'divide', 'power', 'mod'],
      },
    },
    {
      id: 'inputB',
      title: 'Input B',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Second number',
      condition: {
        field: 'operation',
        value: ['add', 'subtract', 'multiply', 'divide', 'power', 'mod'],
      },
    },
    {
      id: 'inputValue',
      title: 'Input Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Number to process',
      condition: {
        field: 'operation',
        value: ['sqrt', 'abs', 'round', 'floor', 'ceil', 'sin', 'cos', 'tan', 'log'],
      },
    },
    {
      id: 'inputArray',
      title: 'Input Numbers',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter numbers separated by commas: 1, 2, 3, 4, 5',
      rows: 2,
      condition: {
        field: 'operation',
        value: ['min', 'max', 'avg', 'sum'],
      },
    },
    {
      id: 'expression',
      title: 'Mathematical Expression',
      type: 'long-input',
      layout: 'full',
      placeholder: 'e.g., (a + b) * c / 2',
      rows: 2,
      condition: {
        field: 'operation',
        value: ['expression'],
      },
    },
    {
      id: 'variables',
      title: 'Variables',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"a": 10, "b": 20, "c": 5}',
      rows: 3,
      condition: {
        field: 'operation',
        value: ['expression'],
      },
    },
    {
      id: 'minValue',
      title: 'Min Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Minimum random value',
      condition: {
        field: 'operation',
        value: ['random'],
      },
    },
    {
      id: 'maxValue',
      title: 'Max Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Maximum random value',
      condition: {
        field: 'operation',
        value: ['random'],
      },
    },
    {
      id: 'angleUnit',
      title: 'Angle Unit',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Radians', id: 'rad' },
        { label: 'Degrees', id: 'deg' },
      ],
      condition: {
        field: 'operation',
        value: ['sin', 'cos', 'tan'],
      },
    },
    {
      id: 'outputFormat',
      title: 'Output Format',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Number', id: 'number' },
        { label: 'String', id: 'string' },
        { label: 'Scientific', id: 'scientific' },
        { label: 'Percentage', id: 'percentage' },
      ],
    },
  ],
  tools: {
    access: ['math_processor'],
    config: {
      tool: () => 'math_processor',
      params: (params) => params,
    },
  },
  inputs: {
    operation: { type: 'string', required: false },
    precision: { type: 'number', required: false },
    inputA: { type: 'number', required: false },
    inputB: { type: 'number', required: false },
    inputValue: { type: 'number', required: false },
    inputArray: { type: 'string', required: false },
    expression: { type: 'string', required: false },
    variables: { type: 'json', required: false },
    minValue: { type: 'number', required: false },
    maxValue: { type: 'number', required: false },
    angleUnit: { type: 'string', required: false },
    outputFormat: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        operation: 'string',
        result: 'number',
        inputs: 'json',
        expression: 'string',
        unit: 'string',
        precision: 'number',
      },
    },
  },
}
