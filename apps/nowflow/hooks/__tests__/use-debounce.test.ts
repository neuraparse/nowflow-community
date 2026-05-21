/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebounce } from '@/hooks/use-debounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately on first render', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('does not update the debounced value before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'first', delay: 500 },
    })

    expect(result.current).toBe('first')

    rerender({ value: 'second', delay: 500 })
    expect(result.current).toBe('first')

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current).toBe('first')
  })

  it('updates the debounced value after the delay elapses', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'first', delay: 500 },
    })

    rerender({ value: 'second', delay: 500 })

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe('second')
  })

  it('resets the debounce timer when the value changes before delay elapses', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'a', delay: 300 },
    })

    rerender({ value: 'b', delay: 300 })

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    rerender({ value: 'c', delay: 300 })

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('c')
  })

  it('supports non-string values like numbers and objects', () => {
    const firstObj = { count: 1 }
    const secondObj = { count: 2 }

    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 250), {
      initialProps: { value: firstObj },
    })

    expect(result.current).toBe(firstObj)

    rerender({ value: secondObj })

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current).toBe(secondObj)
  })

  it('respects a changed delay on subsequent renders', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'x', delay: 500 },
    })

    rerender({ value: 'y', delay: 1000 })

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe('x')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe('y')
  })
})
