import { describe, expect, it, vi } from 'vitest'
import { variableManagerTool } from '../variable_manager/tool'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const exec = (params: any) => (variableManagerTool as any).directExecution(params)

describe('variableManagerTool config', () => {
  it('has expected metadata', () => {
    expect(variableManagerTool.id).toBe('variable_manager')
    expect(variableManagerTool.name).toBe('Variable Manager')
    expect(typeof variableManagerTool.directExecution).toBe('function')
  })
})

describe('variableManagerTool directExecution', () => {
  it('sets and gets a variable within a scope', async () => {
    const scope = 'test-scope-' + Math.random()
    const setResult = await exec({
      operation: 'set',
      variableName: 'myVar',
      variableValue: 'hello',
      scope,
    })
    expect(setResult.success).toBe(true)
    expect(setResult.output.variableValue).toBe('hello')

    const getResult = await exec({ operation: 'get', variableName: 'myVar', scope })
    expect(getResult.output.variableValue).toBe('hello')
  })

  it('returns defaultValue when variable not set', async () => {
    const scope = 'test-scope-' + Math.random()
    const result = await exec({
      operation: 'get',
      variableName: 'absent',
      defaultValue: 42,
      scope,
    })
    expect(result.output.variableValue).toBe(42)
  })

  it('increments numeric variables', async () => {
    const scope = 'inc-scope-' + Math.random()
    await exec({
      operation: 'set',
      variableName: 'counter',
      variableValue: 10,
      scope,
    })
    const result = await exec({
      operation: 'increment',
      variableName: 'counter',
      incrementValue: 5,
      scope,
    })
    expect(result.output.variableValue).toBe(15)
    expect(result.output.previousValue).toBe(10)
  })

  it('decrements numeric variables', async () => {
    const scope = 'dec-scope-' + Math.random()
    await exec({
      operation: 'set',
      variableName: 'counter',
      variableValue: 10,
      scope,
    })
    const result = await exec({
      operation: 'decrement',
      variableName: 'counter',
      incrementValue: 3,
      scope,
    })
    expect(result.output.variableValue).toBe(7)
  })

  it('fails to increment non-numeric value', async () => {
    const scope = 'non-num-' + Math.random()
    await exec({
      operation: 'set',
      variableName: 'v',
      variableValue: 'abc',
      scope,
    })
    const result = await exec({ operation: 'increment', variableName: 'v', scope })
    expect(result.success).toBe(false)
  })

  it('appends to a string', async () => {
    const scope = 'append-scope-' + Math.random()
    await exec({
      operation: 'set',
      variableName: 's',
      variableValue: 'foo',
      scope,
    })
    const result = await exec({
      operation: 'append',
      variableName: 's',
      variableValue: 'bar',
      scope,
    })
    expect(result.output.variableValue).toBe('foobar')
  })

  it('prepends to an array', async () => {
    const scope = 'prepend-' + Math.random()
    await exec({
      operation: 'set',
      variableName: 'arr',
      variableValue: [2, 3],
      scope,
    })
    const result = await exec({
      operation: 'prepend',
      variableName: 'arr',
      variableValue: 1,
      scope,
    })
    expect(result.output.variableValue).toEqual([1, 2, 3])
  })

  it('clears a variable', async () => {
    const scope = 'clear-scope-' + Math.random()
    await exec({
      operation: 'set',
      variableName: 'c',
      variableValue: 'x',
      scope,
    })
    const result = await exec({ operation: 'clear', variableName: 'c', scope })
    expect(result.output.variableValue).toBeNull()

    const exists = await exec({ operation: 'exists', variableName: 'c', scope })
    expect(exists.output.variableValue).toBe(false)
  })

  it('exists returns boolean indicator', async () => {
    const scope = 'exists-scope-' + Math.random()
    const before = await exec({ operation: 'exists', variableName: 'nothing', scope })
    expect(before.output.variableValue).toBe(false)

    await exec({
      operation: 'set',
      variableName: 'x',
      variableValue: 1,
      scope,
    })
    const after = await exec({ operation: 'exists', variableName: 'x', scope })
    expect(after.output.variableValue).toBe(true)
  })

  it('converts dataType on set', async () => {
    const scope = 'convert-' + Math.random()
    const num = await exec({
      operation: 'set',
      variableName: 'n',
      variableValue: '42',
      dataType: 'number',
      scope,
    })
    expect(num.output.variableValue).toBe(42)

    const bool = await exec({
      operation: 'set',
      variableName: 'b',
      variableValue: 'true',
      dataType: 'boolean',
      scope,
    })
    expect(bool.output.variableValue).toBe(true)

    const obj = await exec({
      operation: 'set',
      variableName: 'o',
      variableValue: '{"a":1}',
      dataType: 'object',
      scope,
    })
    expect(obj.output.variableValue).toEqual({ a: 1 })
  })

  it('fails on unknown operation', async () => {
    const result = await exec({
      operation: 'nope',
      variableName: 'x',
      scope: 'unk-' + Math.random(),
    })
    expect(result.success).toBe(false)
  })
})
