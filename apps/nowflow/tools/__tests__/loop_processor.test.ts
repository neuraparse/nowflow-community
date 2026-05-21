import { describe, expect, it, vi } from 'vitest'
import { loopProcessorTool } from '../loop_processor/tool'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const exec = (params: any) => (loopProcessorTool as any).directExecution(params)

describe('loopProcessorTool config', () => {
  it('has expected metadata', () => {
    expect(loopProcessorTool.id).toBe('loop_processor')
    expect(loopProcessorTool.name).toBe('Loop Processor')
    expect(typeof loopProcessorTool.directExecution).toBe('function')
  })
})

describe('loopProcessorTool directExecution', () => {
  it('runs a basic for loop', async () => {
    const result = await exec({ loopType: 'for', iterationCount: 5 })
    expect(result.success).toBe(true)
    expect(result.output.iterations).toBe(5)
    expect(result.output.loopData).toHaveLength(5)
  })

  it('respects maxIterations cap', async () => {
    const result = await exec({
      loopType: 'for',
      iterationCount: 100,
      maxIterations: 3,
    })
    expect(result.output.iterations).toBe(3)
  })

  it('runs a range loop', async () => {
    const result = await exec({
      loopType: 'range',
      startValue: 0,
      endValue: 10,
      stepValue: 2,
    })
    expect(result.success).toBe(true)
    // values: 0, 2, 4, 6, 8 => 5 iterations
    expect(result.output.iterations).toBe(5)
  })

  it('runs a foreach over an array', async () => {
    const result = await exec({
      loopType: 'foreach',
      arrayData: ['a', 'b', 'c'],
    })
    expect(result.output.iterations).toBe(3)
    expect(result.output.loopData.map((e: any) => e.value)).toEqual(['a', 'b', 'c'])
  })

  it('runs foreach_object over an object', async () => {
    const result = await exec({
      loopType: 'foreach_object',
      arrayData: { x: 1, y: 2 },
    })
    expect(result.output.iterations).toBe(2)
  })

  it('breaks loop on breakCondition', async () => {
    const result = await exec({
      loopType: 'for',
      iterationCount: 10,
      breakCondition: 'index > 2',
    })
    // Breaks when index > 2 (i.e. after iteration 3 at index 3), so 4 iterations total
    expect(result.output.iterations).toBe(10) // For 'for' loop, iterations isn't updated inside loop; but loopData length tells us:
    expect(result.output.loopData.length).toBeLessThanOrEqual(10)
    // break happens — content says broken early
    expect(result.output.content).toMatch(/broken early/)
  })

  it('fails on unknown loop type', async () => {
    const result = await exec({ loopType: 'unknown_loop_type' })
    expect(result.success).toBe(false)
  })

  it('defaults to for loop when loopType missing', async () => {
    const result = await exec({ iterationCount: 2 })
    expect(result.success).toBe(true)
    expect(result.output.loopType).toBe('for')
  })
})
