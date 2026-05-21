import { describe, expect, it } from 'vitest'
import {
  type BudgetExhaustedError,
  RedisSessionBudget,
  SessionBudget,
} from '@/lib/rate-limit/session-budget'

describe('SessionBudget', () => {
  describe('consumeToolCall', () => {
    it('allows exactly maxToolCalls consumes and throws on the next', () => {
      const budget = new SessionBudget(20)
      for (let i = 0; i < 20; i++) {
        expect(() => budget.consumeToolCall()).not.toThrow()
      }
      let caught: BudgetExhaustedError | undefined
      try {
        budget.consumeToolCall()
      } catch (e) {
        caught = e as BudgetExhaustedError
      }
      expect(caught).toBeDefined()
      expect(caught?.code).toBe('BUDGET_EXHAUSTED')
      expect(caught?.message).toMatch(/tool call budget exhausted/)
    })

    it('tracks remaining() against the max', () => {
      const budget = new SessionBudget(5)
      expect(budget.remaining()).toBe(5)
      budget.consumeToolCall()
      budget.consumeToolCall()
      expect(budget.remaining()).toBe(3)
    })

    it('respects a custom lower maxToolCalls', () => {
      const budget = new SessionBudget(2)
      budget.consumeToolCall()
      budget.consumeToolCall()
      expect(() => budget.consumeToolCall()).toThrowError(/tool call budget exhausted/)
    })
  })

  describe('enterAgent', () => {
    it('allows nesting up to maxAgentDepth and throws deeper than that', () => {
      const budget = new SessionBudget(20, 3)
      const r1 = budget.enterAgent()
      const r2 = budget.enterAgent()
      const r3 = budget.enterAgent()
      expect(budget.snapshot().agentDepth).toBe(3)

      let caught: BudgetExhaustedError | undefined
      try {
        budget.enterAgent()
      } catch (e) {
        caught = e as BudgetExhaustedError
      }
      expect(caught).toBeDefined()
      expect(caught?.code).toBe('BUDGET_EXHAUSTED')
      expect(caught?.message).toMatch(/agent nesting depth exceeded/)

      r3()
      r2()
      r1()
      expect(budget.snapshot().agentDepth).toBe(0)
    })

    it('allows re-entering an agent frame after the disposer runs', () => {
      const budget = new SessionBudget(20, 3)
      const r = budget.enterAgent()
      r()
      expect(budget.snapshot().agentDepth).toBe(0)
      expect(() => budget.enterAgent()()).not.toThrow()
    })

    it('disposer is idempotent', () => {
      const budget = new SessionBudget(20, 3)
      const r = budget.enterAgent()
      r()
      r()
      expect(budget.snapshot().agentDepth).toBe(0)
    })
  })

  describe('snapshot', () => {
    it('returns current state including maxToolCalls', () => {
      const budget = new SessionBudget(20, 3)
      budget.consumeToolCall()
      budget.consumeToolCall()
      const release = budget.enterAgent()
      expect(budget.snapshot()).toEqual({
        toolCalls: 2,
        agentDepth: 1,
        maxToolCalls: 20,
      })
      release()
      expect(budget.snapshot()).toEqual({
        toolCalls: 2,
        agentDepth: 0,
        maxToolCalls: 20,
      })
    })
  })
})

describe('RedisSessionBudget (scaffold)', () => {
  it('exposes the same public surface as SessionBudget', async () => {
    const budget = new RedisSessionBudget('session-1', null, 2, 2)
    await budget.consumeToolCall()
    await budget.consumeToolCall()
    await expect(budget.consumeToolCall()).rejects.toMatchObject({
      code: 'BUDGET_EXHAUSTED',
    })
    expect(budget.snapshot().toolCalls).toBe(2)
    expect(budget.remaining()).toBe(0)
  })

  it('enterAgent returns an async disposer that decrements depth', async () => {
    const budget = new RedisSessionBudget('session-2', null, 20, 2)
    const r1 = await budget.enterAgent()
    const r2 = await budget.enterAgent()
    expect(budget.snapshot().agentDepth).toBe(2)
    await expect(budget.enterAgent()).rejects.toMatchObject({
      code: 'BUDGET_EXHAUSTED',
    })
    await r2()
    await r1()
    expect(budget.snapshot().agentDepth).toBe(0)
  })
})
