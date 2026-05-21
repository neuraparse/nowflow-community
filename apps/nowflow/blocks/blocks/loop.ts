import { RepeatIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface LoopResponse extends ToolResponse {
  output: {
    content: string
    loopType: string
    iterations: number
    currentIteration: number
    loopData: any[]
    currentItem: any
    breakCondition?: string
    continueCondition?: string
  }
}

export const LoopBlock: BlockConfig<LoopResponse> = {
  type: 'loop',
  name: 'Loop',
  description: 'Iterate and repeat operations',
  longDescription:
    'Create loops to iterate over data, repeat operations, or process arrays. Supports for loops, while loops, and foreach loops with break and continue conditions.',
  category: 'blocks',
  bgColor: '#EF4444',
  icon: RepeatIcon,
  subBlocks: [
    {
      id: 'loopType',
      title: 'Loop Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'For Loop (Count)', id: 'for' },
        { label: 'While Loop', id: 'while' },
        { label: 'For Each (Array)', id: 'foreach' },
        { label: 'For Each (Object)', id: 'foreach_object' },
        { label: 'Range Loop', id: 'range' },
      ],
    },
    {
      id: 'maxIterations',
      title: 'Max Iterations',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Maximum number of iterations',
    },
    {
      id: 'iterationCount',
      title: 'Iteration Count',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Number of iterations',
      condition: {
        field: 'loopType',
        value: ['for'],
      },
    },
    {
      id: 'startValue',
      title: 'Start Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Starting value',
      condition: {
        field: 'loopType',
        value: ['range'],
      },
    },
    {
      id: 'endValue',
      title: 'End Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Ending value',
      condition: {
        field: 'loopType',
        value: ['range'],
      },
    },
    {
      id: 'stepValue',
      title: 'Step Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Step increment (default: 1)',
      condition: {
        field: 'loopType',
        value: ['range'],
      },
    },
    {
      id: 'arrayData',
      title: 'Array Data',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Array or object to iterate over... (JSON format)',
      rows: 4,
      condition: {
        field: 'loopType',
        value: ['foreach', 'foreach_object'],
      },
    },
    {
      id: 'whileCondition',
      title: 'While Condition',
      type: 'long-input',
      layout: 'full',
      placeholder: 'condition => condition.value < 100',
      rows: 2,
      condition: {
        field: 'loopType',
        value: ['while'],
      },
    },
    {
      id: 'breakCondition',
      title: 'Break Condition',
      type: 'long-input',
      layout: 'full',
      placeholder: 'item => item.error === true',
      rows: 2,
    },
    {
      id: 'continueCondition',
      title: 'Continue Condition',
      type: 'long-input',
      layout: 'full',
      placeholder: 'item => item.skip === true',
      rows: 2,
    },
    {
      id: 'itemVariable',
      title: 'Item Variable Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Variable name for current item (default: item)',
      condition: {
        field: 'loopType',
        value: ['foreach', 'foreach_object'],
      },
    },
    {
      id: 'indexVariable',
      title: 'Index Variable Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Variable name for current index (default: index)',
    },
    {
      id: 'parallel',
      title: 'Parallel Execution',
      type: 'switch',
      layout: 'half',
      description: 'Execute iterations in parallel',
    },
    {
      id: 'collectResults',
      title: 'Collect Results',
      type: 'switch',
      layout: 'half',
      description: 'Collect results from each iteration',
    },
  ],
  tools: {
    access: ['loop_processor'],
    config: {
      tool: () => 'loop_processor',
      params: (params) => params,
    },
  },
  inputs: {
    loopType: { type: 'string', required: false },
    maxIterations: { type: 'number', required: false },
    iterationCount: { type: 'number', required: false },
    startValue: { type: 'number', required: false },
    endValue: { type: 'number', required: false },
    stepValue: { type: 'number', required: false },
    arrayData: { type: 'json', required: false },
    whileCondition: { type: 'string', required: false },
    breakCondition: { type: 'string', required: false },
    continueCondition: { type: 'string', required: false },
    itemVariable: { type: 'string', required: false },
    indexVariable: { type: 'string', required: false },
    parallel: { type: 'boolean', required: false },
    collectResults: { type: 'boolean', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        loopType: 'string',
        iterations: 'number',
        currentIteration: 'number',
        loopData: 'json',
        currentItem: 'json',
        breakCondition: 'string',
        continueCondition: 'string',
      },
    },
  },
}
