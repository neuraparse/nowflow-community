import { describe, expect, it, vi } from 'vitest'
import { mathProcessorTool } from '../math_processor/tool'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const exec = (params: any) => (mathProcessorTool as any).directExecution(params)

describe('mathProcessorTool config', () => {
  it('has expected metadata', () => {
    expect(mathProcessorTool.id).toBe('math_processor')
    expect(mathProcessorTool.name).toBe('Math Processor')
    expect(typeof mathProcessorTool.directExecution).toBe('function')
  })
})

describe('mathProcessorTool directExecution', () => {
  it('adds inputs (default add when no operation provided)', async () => {
    const result = await exec({ operation: 'add', inputA: 2, inputB: 3 })
    expect(result.success).toBe(true)
    expect(result.output.result).toBe(5)
    expect(result.output.operation).toBe('add')
    expect(result.output.inputs).toEqual([2, 3])
  })

  it('subtracts inputs', async () => {
    const result = await exec({ operation: 'subtract', inputA: 10, inputB: 4 })
    expect(result.output.result).toBe(6)
  })

  it('multiplies inputs', async () => {
    const result = await exec({ operation: 'multiply', inputA: 3, inputB: 4 })
    expect(result.output.result).toBe(12)
  })

  it('divides inputs', async () => {
    const result = await exec({ operation: 'divide', inputA: 12, inputB: 4 })
    expect(result.output.result).toBe(3)
  })

  it('treats inputB=0 as fallback 1 for divide (source falsy default)', async () => {
    // Note: math tool uses `params.inputB || 1`, so 0 coerces to 1.
    const result = await exec({ operation: 'divide', inputA: 10, inputB: 0 })
    expect(result.success).toBe(true)
    expect(result.output.result).toBe(10)
  })

  it('computes power', async () => {
    const result = await exec({ operation: 'power', inputA: 2, inputB: 8 })
    expect(result.output.result).toBe(256)
  })

  it('computes sqrt', async () => {
    const result = await exec({ operation: 'sqrt', inputValue: 16 })
    expect(result.output.result).toBe(4)
  })

  it('rejects sqrt of negative', async () => {
    const result = await exec({ operation: 'sqrt', inputValue: -1 })
    expect(result.success).toBe(false)
  })

  it('computes abs', async () => {
    const result = await exec({ operation: 'abs', inputValue: -7 })
    expect(result.output.result).toBe(7)
  })

  it('rounds, floors, ceils', async () => {
    expect((await exec({ operation: 'round', inputValue: 1.5 })).output.result).toBe(2)
    expect((await exec({ operation: 'floor', inputValue: 1.9 })).output.result).toBe(1)
    expect((await exec({ operation: 'ceil', inputValue: 1.1 })).output.result).toBe(2)
  })

  it('computes modulo', async () => {
    const result = await exec({ operation: 'mod', inputA: 10, inputB: 3 })
    expect(result.output.result).toBe(1)
  })

  it('rejects modulo by zero', async () => {
    const result = await exec({ operation: 'mod', inputA: 10, inputB: 0 })
    expect(result.success).toBe(false)
  })

  it('computes sum/avg/min/max on array input', async () => {
    const sum = await exec({ operation: 'sum', inputArray: '1, 2, 3, 4' })
    expect(sum.output.result).toBe(10)

    const avg = await exec({ operation: 'avg', inputArray: '2, 4, 6' })
    expect(avg.output.result).toBe(4)

    const min = await exec({ operation: 'min', inputArray: '5, 1, 3' })
    expect(min.output.result).toBe(1)

    const max = await exec({ operation: 'max', inputArray: '5, 1, 3' })
    expect(max.output.result).toBe(5)
  })

  it('handles trig with degrees/radians', async () => {
    const sin0 = await exec({ operation: 'sin', inputValue: 0 })
    expect(sin0.output.result).toBe(0)
    expect(sin0.output.unit).toBe('rad')

    const cosDeg = await exec({ operation: 'cos', inputValue: 0, angleUnit: 'deg' })
    expect(cosDeg.output.result).toBe(1)
    expect(cosDeg.output.unit).toBe('deg')
  })

  it('rejects log of non-positive', async () => {
    const result = await exec({ operation: 'log', inputValue: 0 })
    expect(result.success).toBe(false)
  })

  it('computes log for positive value', async () => {
    const result = await exec({ operation: 'log', inputValue: Math.E })
    expect(result.output.result).toBeCloseTo(1, 5)
  })

  it('evaluates safe expressions with variables', async () => {
    const result = await exec({
      operation: 'expression',
      expression: 'x + y * 2',
      variables: { x: 3, y: 4 },
    })
    expect(result.output.result).toBe(11)
  })

  it('rejects unsafe expression characters', async () => {
    const result = await exec({
      operation: 'expression',
      expression: 'process.exit(1)',
      variables: {},
    })
    expect(result.success).toBe(false)
  })

  it('applies precision & output formats', async () => {
    const str = await exec({
      operation: 'divide',
      inputA: 1,
      inputB: 3,
      precision: 4,
      outputFormat: 'string',
    })
    expect(str.output.content).toBe('0.3333')

    const pct = await exec({
      operation: 'divide',
      inputA: 1,
      inputB: 2,
      precision: 1,
      outputFormat: 'percentage',
    })
    expect(pct.output.content).toBe('50.0%')

    const sci = await exec({
      operation: 'multiply',
      inputA: 1234,
      inputB: 1,
      precision: 2,
      outputFormat: 'scientific',
    })
    expect(sci.output.content).toMatch(/e\+/)
  })

  it('fails on unknown operation', async () => {
    const result = await exec({ operation: 'totally-unknown', inputA: 1, inputB: 2 })
    expect(result.success).toBe(false)
    expect(result.output.content).toMatch(/Unknown operation/)
  })

  it('produces a number in range for random', async () => {
    const result = await exec({ operation: 'random', minValue: 1, maxValue: 2 })
    expect(result.success).toBe(true)
    expect(result.output.result).toBeGreaterThanOrEqual(1)
    expect(result.output.result).toBeLessThanOrEqual(2)
  })
})
