import { ClockIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface TimerResponse extends ToolResponse {
  output: {
    content: string
    delayDuration: number
    delayUnit: string
    startTime: string
    endTime: string
    actualDelay: number
  }
}

export const TimerBlock: BlockConfig<TimerResponse> = {
  type: 'timer',
  name: 'Timer',
  description: 'Add delays and timing control',
  longDescription:
    'Add delays, pauses, and timing control to your workflow. Useful for rate limiting, waiting for external processes, or creating scheduled intervals between actions.',
  category: 'blocks',
  bgColor: '#8B5CF6',
  icon: ClockIcon,
  subBlocks: [
    {
      id: 'delayType',
      title: 'Delay Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Fixed Delay', id: 'fixed' },
        { label: 'Random Delay', id: 'random' },
        { label: 'Wait Until Time', id: 'until_time' },
        { label: 'Wait Until Date', id: 'until_date' },
      ],
    },
    {
      id: 'duration',
      title: 'Duration',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter duration (number)',
      condition: {
        field: 'delayType',
        value: ['fixed', 'random'],
      },
    },
    {
      id: 'unit',
      title: 'Time Unit',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Milliseconds', id: 'ms' },
        { label: 'Seconds', id: 's' },
        { label: 'Minutes', id: 'm' },
        { label: 'Hours', id: 'h' },
        { label: 'Days', id: 'd' },
      ],
      condition: {
        field: 'delayType',
        value: ['fixed', 'random'],
      },
    },
    {
      id: 'maxDuration',
      title: 'Max Duration',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Maximum duration for random delay',
      condition: {
        field: 'delayType',
        value: ['random'],
      },
    },
    {
      id: 'targetTime',
      title: 'Target Time',
      type: 'short-input',
      layout: 'half',
      placeholder: 'HH:MM (e.g., 14:30)',
      condition: {
        field: 'delayType',
        value: ['until_time'],
      },
    },
    {
      id: 'targetDate',
      title: 'Target Date',
      type: 'short-input',
      layout: 'half',
      placeholder: 'YYYY-MM-DD (e.g., 2024-12-25)',
      condition: {
        field: 'delayType',
        value: ['until_date'],
      },
    },
    {
      id: 'timezone',
      title: 'Timezone',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'UTC', id: 'UTC' },
        { label: 'Local', id: 'local' },
        { label: 'America/New_York', id: 'America/New_York' },
        { label: 'America/Los_Angeles', id: 'America/Los_Angeles' },
        { label: 'Europe/London', id: 'Europe/London' },
        { label: 'Europe/Paris', id: 'Europe/Paris' },
        { label: 'Asia/Tokyo', id: 'Asia/Tokyo' },
        { label: 'Asia/Shanghai', id: 'Asia/Shanghai' },
        { label: 'Australia/Sydney', id: 'Australia/Sydney' },
      ],
      condition: {
        field: 'delayType',
        value: ['until_time', 'until_date'],
      },
    },
    {
      id: 'message',
      title: 'Wait Message',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Optional message to display during wait...',
    },
    {
      id: 'skipWeekends',
      title: 'Skip Weekends',
      type: 'switch',
      layout: 'half',
      condition: {
        field: 'delayType',
        value: ['until_date'],
      },
    },
    {
      id: 'skipHolidays',
      title: 'Skip Holidays',
      type: 'switch',
      layout: 'half',
      condition: {
        field: 'delayType',
        value: ['until_date'],
      },
    },
  ],
  tools: {
    access: ['timer'],
    config: {
      tool: () => 'timer',
      params: (params) => params,
    },
  },
  inputs: {
    delayType: { type: 'string', required: false },
    duration: { type: 'number', required: false },
    unit: { type: 'string', required: false },
    maxDuration: { type: 'number', required: false },
    targetTime: { type: 'string', required: false },
    targetDate: { type: 'string', required: false },
    timezone: { type: 'string', required: false },
    message: { type: 'string', required: false },
    skipWeekends: { type: 'boolean', required: false },
    skipHolidays: { type: 'boolean', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        delayDuration: 'number',
        delayUnit: 'string',
        startTime: 'string',
        endTime: 'string',
        actualDelay: 'number',
      },
    },
  },
}
