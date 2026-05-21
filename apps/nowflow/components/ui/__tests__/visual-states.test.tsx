/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

// jsdom lacks a few APIs used by Radix primitives
beforeAll(() => {
  if (!(window as any).ResizeObserver) {
    ;(window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  const proto = window.Element.prototype as any
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {}
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {}
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {}
})

describe('Button visual states', () => {
  it('applies disabled attribute and pointer-events-none class when disabled', () => {
    render(<Button disabled>Go</Button>)
    const btn = screen.getByRole('button', { name: 'Go' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('disabled')
    expect(btn.className).toMatch(/disabled:pointer-events-none/)
    expect(btn.className).toMatch(/disabled:opacity-50/)
  })

  it('includes focus-visible ring classes so focus state is styled', () => {
    render(<Button>Focus me</Button>)
    const btn = screen.getByRole('button', { name: 'Focus me' })
    expect(btn.className).toMatch(/focus-visible:ring-2/)
    expect(btn.className).toMatch(/focus-visible:ring-ring/)
  })

  it('includes hover classes for default variant', () => {
    render(<Button>Hover</Button>)
    const btn = screen.getByRole('button', { name: 'Hover' })
    expect(btn.className).toMatch(/hover:bg-primary\/90/)
  })

  it('renders default variant classes', () => {
    render(<Button>Default</Button>)
    const btn = screen.getByRole('button', { name: 'Default' })
    expect(btn).toHaveClass('workflow-editor-button-variant-default')
    expect(btn).toHaveClass('bg-primary')
    expect(btn).toHaveClass('text-primary-foreground')
  })

  it('renders destructive variant classes', () => {
    render(<Button variant="destructive">Del</Button>)
    const btn = screen.getByRole('button', { name: 'Del' })
    expect(btn).toHaveClass('workflow-editor-button-variant-destructive')
    expect(btn).toHaveClass('bg-destructive')
  })

  it('renders outline variant classes', () => {
    render(<Button variant="outline">Out</Button>)
    const btn = screen.getByRole('button', { name: 'Out' })
    expect(btn).toHaveClass('workflow-editor-button-variant-outline')
    expect(btn).toHaveClass('border')
    expect(btn).toHaveClass('border-input')
  })

  it('renders secondary variant classes', () => {
    render(<Button variant="secondary">Sec</Button>)
    const btn = screen.getByRole('button', { name: 'Sec' })
    expect(btn).toHaveClass('workflow-editor-button-variant-secondary')
    expect(btn).toHaveClass('bg-secondary')
  })

  it('renders ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button', { name: 'Ghost' })
    expect(btn).toHaveClass('workflow-editor-button-variant-ghost')
    expect(btn.className).toMatch(/hover:bg-accent/)
  })

  it('renders link variant classes', () => {
    render(<Button variant="link">Link</Button>)
    const btn = screen.getByRole('button', { name: 'Link' })
    expect(btn).toHaveClass('workflow-editor-button-variant-link')
    expect(btn).toHaveClass('text-primary')
  })

  it('renders size-specific classes', () => {
    const { rerender } = render(<Button size="sm">S</Button>)
    expect(screen.getByRole('button', { name: 'S' })).toHaveClass('h-9')

    rerender(<Button size="lg">L</Button>)
    expect(screen.getByRole('button', { name: 'L' })).toHaveClass('h-11')

    rerender(<Button size="icon">I</Button>)
    expect(screen.getByRole('button', { name: 'I' })).toHaveClass('w-10')
  })
})

describe('Input visual states', () => {
  it('is editable when readOnly is false and not disabled', () => {
    render(<Input defaultValue="hello" aria-label="field" />)
    const input = screen.getByLabelText('field') as HTMLInputElement
    expect(input).not.toBeDisabled()
    expect(input).not.toHaveAttribute('readOnly')
    fireEvent.change(input, { target: { value: 'world' } })
    expect(input.value).toBe('world')
  })

  it('readOnly: allows focus but blocks native value changes', () => {
    render(<Input defaultValue="hello" readOnly aria-label="ro" />)
    const input = screen.getByLabelText('ro') as HTMLInputElement
    expect(input).toHaveAttribute('readOnly')
    expect(input).not.toBeDisabled()
    // readOnly inputs can still receive focus
    input.focus()
    expect(input).toHaveFocus()
  })

  it('disabled: blocks focus and is reported as disabled', () => {
    render(<Input defaultValue="x" disabled aria-label="dis" />)
    const input = screen.getByLabelText('dis') as HTMLInputElement
    expect(input).toBeDisabled()
    input.focus()
    // Disabled inputs should not receive focus in jsdom
    expect(input).not.toHaveFocus()
    expect(input.className).toMatch(/disabled:cursor-not-allowed/)
    expect(input.className).toMatch(/disabled:opacity-50/)
  })
})

describe('Badge variants', () => {
  it('renders default variant classes', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toHaveClass('workflow-editor-badge')
    expect(badge).toHaveClass('workflow-editor-badge-variant-default')
    expect(badge).toHaveClass('bg-primary')
  })

  it('renders secondary variant classes', () => {
    render(<Badge variant="secondary">Sec</Badge>)
    const badge = screen.getByText('Sec')
    expect(badge).toHaveClass('workflow-editor-badge-variant-secondary')
    expect(badge).toHaveClass('bg-secondary')
  })

  it('renders destructive variant classes', () => {
    render(<Badge variant="destructive">Del</Badge>)
    const badge = screen.getByText('Del')
    expect(badge).toHaveClass('workflow-editor-badge-variant-destructive')
    expect(badge).toHaveClass('bg-destructive')
  })

  it('renders outline variant classes', () => {
    render(<Badge variant="outline">Out</Badge>)
    const badge = screen.getByText('Out')
    expect(badge).toHaveClass('workflow-editor-badge-variant-outline')
    expect(badge).toHaveClass('text-foreground')
  })
})

describe('Avatar fallback', () => {
  // Radix Avatar preloads the image via `new Image()` then reacts to load/error.
  // In jsdom, the image never loads a real URL, so the fallback is shown after
  // the loading status transitions. We simulate an explicit error event where
  // possible and otherwise wait for the fallback to appear.
  it('renders the fallback text when no image is provided', async () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(await screen.findByText('AB')).toBeInTheDocument()
  })

  it('shows fallback after simulated image onError', async () => {
    render(
      <Avatar>
        <AvatarImage src="http://invalid.example/nope.png" alt="user" />
        <AvatarFallback>CD</AvatarFallback>
      </Avatar>
    )

    // jsdom never actually loads the image; dispatching an error on any
    // queryable img (if present) should flip state. Either way, the fallback
    // should become visible.
    const img = document.querySelector('img')
    if (img) {
      fireEvent.error(img)
    }
    expect(await screen.findByText('CD')).toBeInTheDocument()
  })
})

describe('Progress indicator transform', () => {
  const getIndicator = (root: HTMLElement): HTMLElement | null =>
    root.querySelector('.workflow-editor-progress-indicator')

  it('reflects value changes across re-renders', () => {
    const { rerender } = render(<Progress data-testid="p" value={0} />)
    const indicator = () => getIndicator(screen.getByTestId('p'))
    expect(indicator()?.style.transform).toBe('translateX(-100%)')

    rerender(<Progress data-testid="p" value={25} />)
    expect(indicator()?.style.transform).toBe('translateX(-75%)')

    rerender(<Progress data-testid="p" value={50} />)
    expect(indicator()?.style.transform).toBe('translateX(-50%)')

    rerender(<Progress data-testid="p" value={100} />)
    expect(indicator()?.style.transform).toBe('translateX(-0%)')
  })
})
