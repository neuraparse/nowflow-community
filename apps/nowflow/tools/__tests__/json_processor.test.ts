import { describe, expect, it, vi } from 'vitest'
import { jsonProcessorTool } from '../json_processor/tool'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const exec = (params: any) => (jsonProcessorTool as any).directExecution(params)

describe('jsonProcessorTool config', () => {
  it('has expected metadata', () => {
    expect(jsonProcessorTool.id).toBe('json_processor')
    expect(jsonProcessorTool.name).toBe('JSON Processor')
    expect(typeof jsonProcessorTool.directExecution).toBe('function')
  })
})

describe('jsonProcessorTool directExecution', () => {
  it('validates a JSON object via string input', async () => {
    const result = await exec({ inputData: '{"a":1}', operation: 'validate' })
    expect(result.success).toBe(true)
    expect(result.output.dataType).toBe('object')
  })

  it('reports invalid JSON string', async () => {
    const result = await exec({ inputData: 'not-json', operation: 'validate' })
    expect(result.success).toBe(false)
    expect(result.output.metadata.error).toBeDefined()
  })

  it('extracts nested field', async () => {
    const result = await exec({
      inputData: { user: { name: 'Jane', age: 30 } },
      operation: 'extract',
      fieldPath: 'user.name',
    })
    expect(result.output.processedData).toBe('Jane')
  })

  it('filters arrays', async () => {
    const result = await exec({
      inputData: [1, 2, 3, 4, 5],
      operation: 'filter',
      filterCondition: 'item > 2',
    })
    expect(result.output.processedData).toEqual([3, 4, 5])
  })

  it('maps arrays', async () => {
    const result = await exec({
      inputData: [1, 2, 3],
      operation: 'map',
      mapFunction: 'item * 2',
    })
    expect(result.output.processedData).toEqual([2, 4, 6])
  })

  it('merges objects', async () => {
    const result = await exec({
      inputData: { a: 1, b: 2 },
      operation: 'merge',
      mergeData: { b: 20, c: 3 },
    })
    expect(result.output.processedData).toEqual({ a: 1, b: 20, c: 3 })
  })

  it('merges arrays', async () => {
    const result = await exec({
      inputData: [1, 2],
      operation: 'merge',
      mergeData: [3, 4],
    })
    expect(result.output.processedData).toEqual([1, 2, 3, 4])
  })

  it('flattens nested objects', async () => {
    const result = await exec({
      inputData: { a: { b: { c: 1 } }, d: 2 },
      operation: 'flatten',
    })
    expect(result.output.processedData).toEqual({ 'a.b.c': 1, d: 2 })
  })

  it('unflattens flat keys', async () => {
    const result = await exec({
      inputData: { 'a.b': 1, c: 2 },
      operation: 'unflatten',
    })
    expect(result.output.processedData).toEqual({ a: { b: 1 }, c: 2 })
  })

  it('converts array of objects to CSV', async () => {
    const result = await exec({
      inputData: [
        { name: 'a', value: 1 },
        { name: 'b', value: 2 },
      ],
      operation: 'to_csv',
      outputFormat: 'string',
    })
    const csv = result.output.processedData as string
    expect(csv).toContain('name,value')
    expect(csv).toContain('"a",1')
  })

  it('converts object to XML', async () => {
    const result = await exec({
      inputData: { greeting: 'hi' },
      operation: 'to_xml',
      outputFormat: 'string',
    })
    expect(result.output.processedData).toContain('<greeting>hi</greeting>')
  })

  it('sorts object keys when sortKeys is true', async () => {
    const result = await exec({
      inputData: { b: 2, a: 1, c: 3 },
      operation: 'format',
      sortKeys: true,
    })
    expect(Object.keys(result.output.processedData)).toEqual(['a', 'b', 'c'])
  })

  it('returns JSON content output for pretty format', async () => {
    const result = await exec({
      inputData: { x: 1 },
      operation: 'format',
      outputFormat: 'json',
    })
    expect(result.output.content).toContain('"x": 1')
  })
})
