import { CircleStackIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { parseNumericString } from '../helpers'
import { BlockConfig } from '../types'

interface SharedMemoryResponse extends ToolResponse {
  output: {
    success: boolean
    key: string
    value: any
    version: number
    previousValue: any | null
    scope: string
    expiresAt: string | null
  }
}

export const SharedMemoryBlock: BlockConfig<SharedMemoryResponse> = {
  type: 'shared_memory',
  name: 'Shared Memory',
  description: 'Store and retrieve shared state between agents',
  longDescription:
    'Provides a shared memory store for agents to read and write data. Supports atomic operations, versioning, and scoped access.',
  category: 'data',
  bgColor: '#F59E0B',
  icon: CircleStackIcon,
  isUtility: true,
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Get', id: 'get' },
        { label: 'Set', id: 'set' },
        { label: 'Delete', id: 'delete' },
        { label: 'Increment', id: 'increment' },
        { label: 'Append', id: 'append' },
        { label: 'Compare and Set', id: 'cas' },
      ],
    },
    {
      id: 'scope',
      title: 'Scope',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Execution', id: 'execution' },
        { label: 'Workflow', id: 'workflow' },
        { label: 'Global', id: 'global' },
      ],
    },
    {
      id: 'key',
      title: 'Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'memory.key.name',
    },
    {
      id: 'value',
      title: 'Value',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "data": "value"\n}',
      condition: {
        field: 'operation',
        value: ['set', 'append', 'cas'],
      },
    },
    {
      id: 'incrementBy',
      title: 'Increment By',
      type: 'short-input',
      layout: 'half',
      placeholder: '1',
      condition: {
        field: 'operation',
        value: 'increment',
      },
    },
    {
      id: 'expectedVersion',
      title: 'Expected Version',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Version for CAS operation',
      condition: {
        field: 'operation',
        value: 'cas',
      },
    },
    {
      id: 'ttlSeconds',
      title: 'TTL (seconds)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Time to live (optional)',
      condition: {
        field: 'operation',
        value: ['set', 'append'],
      },
    },
    {
      id: 'defaultValue',
      title: 'Default Value',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: 'Default if key not found',
      condition: {
        field: 'operation',
        value: 'get',
      },
    },
  ],
  tools: {
    access: ['shared_memory'],
    config: {
      tool: () => 'shared_memory',
      params: (params) => ({
        operation: params.operation || 'get',
        scope: params.scope || 'execution',
        key: params.key,
        value: params.value ? JSON.parse(params.value) : undefined,
        incrementBy: parseNumericString(params.incrementBy) ?? 1,
        expectedVersion: parseNumericString(params.expectedVersion),
        ttlSeconds: parseNumericString(params.ttlSeconds),
        defaultValue: params.defaultValue ? JSON.parse(params.defaultValue) : undefined,
      }),
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    scope: { type: 'string', required: false },
    key: { type: 'string', required: true },
    value: { type: 'json', required: false },
    incrementBy: { type: 'number', required: false },
    expectedVersion: { type: 'number', required: false },
    ttlSeconds: { type: 'number', required: false },
    defaultValue: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        key: 'string',
        value: 'json',
        version: 'number',
        previousValue: 'json',
        scope: 'string',
        expiresAt: 'string',
      },
    },
  },
}
