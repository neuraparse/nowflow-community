/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { cleanup, render } from '@testing-library/react'
import { PointerEventsGuard } from './pointer-events-guard'

// usePathname must be mockable so we can simulate route changes. Each test
// controls the current path via the `__setPath` helper on the mock module.
let currentPath = '/w/1'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

function setPath(next: string) {
  currentPath = next
}

function lockBody(id = 'abc123') {
  document.body.classList.add(`block-interactivity-${id}`)
  document.body.style.pointerEvents = 'none'
}

// Simulate a live Radix dialog in the DOM.
function mountLiveDialog(): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog')
  el.setAttribute('data-state', 'open')
  document.body.appendChild(el)
  return el
}

function flushRAF() {
  return new Promise<void>((resolve) => {
    // The guard defers its sweep by one rAF. Wait two frames to be safe
    // (one for the guard, one buffer in case the callback schedules another).
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

describe('PointerEventsGuard', () => {
  beforeEach(() => {
    currentPath = '/'
    document.body.className = ''
    document.body.removeAttribute('style')
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('clears stray block-interactivity classes after a route change', async () => {
    lockBody('42')
    expect(document.body.classList.contains('block-interactivity-42')).toBe(true)

    setPath('/w/demo')
    render(<PointerEventsGuard />)
    await flushRAF()

    expect(document.body.classList.contains('block-interactivity-42')).toBe(false)
    expect(document.body.style.pointerEvents).toBe('')
  })

  it('clears inline pointer-events: none left behind by a portal', async () => {
    document.body.style.pointerEvents = 'none'

    render(<PointerEventsGuard />)
    await flushRAF()

    expect(document.body.style.pointerEvents).toBe('')
  })

  it('removes multiple stacked lock classes in a single sweep', async () => {
    document.body.classList.add('block-interactivity-1', 'block-interactivity-2', 'keep-me')

    render(<PointerEventsGuard />)
    await flushRAF()

    expect(document.body.classList.contains('block-interactivity-1')).toBe(false)
    expect(document.body.classList.contains('block-interactivity-2')).toBe(false)
    expect(document.body.classList.contains('keep-me')).toBe(true)
  })

  it('does NOT clear locks while a Radix dialog is open', async () => {
    lockBody('99')
    mountLiveDialog()

    render(<PointerEventsGuard />)
    await flushRAF()

    // Dialog is still open → the lock must stay so the modal overlay keeps
    // intercepting background interaction.
    expect(document.body.classList.contains('block-interactivity-99')).toBe(true)
    expect(document.body.style.pointerEvents).toBe('none')
  })

  it('does NOT clear locks while aria-modal element is present', async () => {
    lockBody('7')
    const el = document.createElement('div')
    el.setAttribute('aria-modal', 'true')
    document.body.appendChild(el)

    render(<PointerEventsGuard />)
    await flushRAF()

    expect(document.body.classList.contains('block-interactivity-7')).toBe(true)
  })

  it('does NOT clear locks while an allow-interactivity island exists', async () => {
    lockBody('33')
    const island = document.createElement('div')
    island.classList.add('allow-interactivity-33')
    document.body.appendChild(island)

    render(<PointerEventsGuard />)
    await flushRAF()

    expect(document.body.classList.contains('block-interactivity-33')).toBe(true)
  })

  it('sweeps again when pathname changes', async () => {
    setPath('/first')
    const { rerender } = render(<PointerEventsGuard />)
    await flushRAF()

    // Orphan lock appears while on the same route — no sweep triggered.
    lockBody('late')
    expect(document.body.classList.contains('block-interactivity-late')).toBe(true)

    // Navigate → pathname effect should fire and clean the lock.
    setPath('/second')
    rerender(<PointerEventsGuard />)
    await flushRAF()

    expect(document.body.classList.contains('block-interactivity-late')).toBe(false)
  })

  it('does nothing when the body has no lock at all', async () => {
    document.body.classList.add('some-app-class')

    render(<PointerEventsGuard />)
    await flushRAF()

    expect(document.body.classList.contains('some-app-class')).toBe(true)
    expect(document.body.style.pointerEvents).toBe('')
  })

  it('cancels the pending sweep on unmount (no late DOM writes)', async () => {
    lockBody('cancel-me')
    const { unmount } = render(<PointerEventsGuard />)
    // Unmount before rAF fires so the scheduled sweep is cancelled.
    unmount()
    await flushRAF()

    // Nothing should have touched the body — lock still present.
    expect(document.body.classList.contains('block-interactivity-cancel-me')).toBe(true)
  })
})
