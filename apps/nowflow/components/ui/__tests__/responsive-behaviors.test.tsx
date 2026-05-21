/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Note: jsdom does not perform real CSS layout. These tests verify that
// components attach the expected Tailwind class fragments / Radix data
// attributes that real CSS would use to render responsive layouts. They do
// not verify actual pixel positioning.
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

const openSheet = async (side: 'top' | 'bottom' | 'left' | 'right') => {
  const user = userEvent.setup()
  render(
    <Sheet>
      <SheetTrigger>Open {side}</SheetTrigger>
      <SheetContent side={side} data-testid={`sheet-${side}`}>
        <SheetTitle>Title</SheetTitle>
        <SheetDescription>Desc</SheetDescription>
      </SheetContent>
    </Sheet>
  )
  await user.click(screen.getByText(`Open ${side}`))
  await waitFor(() => expect(screen.getByTestId(`sheet-${side}`)).toBeInTheDocument())
  return screen.getByTestId(`sheet-${side}`)
}

describe('Sheet side variants', () => {
  it('top: inset-x-0 + top-0 + slide-in-from-top', async () => {
    const content = await openSheet('top')
    expect(content.className).toMatch(/inset-x-0/)
    expect(content.className).toMatch(/top-0/)
    expect(content.className).toMatch(/slide-in-from-top/)
    expect(content.className).toMatch(/border-b/)
  })

  it('bottom: inset-x-0 + bottom-0 + slide-in-from-bottom', async () => {
    const content = await openSheet('bottom')
    expect(content.className).toMatch(/inset-x-0/)
    expect(content.className).toMatch(/bottom-0/)
    expect(content.className).toMatch(/slide-in-from-bottom/)
    expect(content.className).toMatch(/border-t/)
  })

  it('left: inset-y-0 + left-0 + slide-in-from-left', async () => {
    const content = await openSheet('left')
    expect(content.className).toMatch(/inset-y-0/)
    expect(content.className).toMatch(/left-0/)
    expect(content.className).toMatch(/slide-in-from-left/)
    expect(content.className).toMatch(/border-r/)
  })

  it('right: inset-y-0 + right-0 + slide-in-from-right', async () => {
    const content = await openSheet('right')
    expect(content.className).toMatch(/inset-y-0/)
    expect(content.className).toMatch(/right-0/)
    expect(content.className).toMatch(/slide-in-from-right/)
    expect(content.className).toMatch(/border-l/)
  })
})

describe('Tooltip sideOffset & align flow through to Radix content', () => {
  it('forwards data-side attribute from side prop', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>trigger</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} align="start" data-testid="tip">
            Hint
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    await user.tab()

    await waitFor(() => {
      expect(screen.getByTestId('tip')).toBeInTheDocument()
    })

    const tip = screen.getByTestId('tip')
    // Radix sets data-side and data-align from props
    expect(tip).toHaveAttribute('data-side', 'right')
    expect(tip).toHaveAttribute('data-align', 'start')
  })

  it('retains the side-specific slide class fragments for top/bottom/left/right', () => {
    // The class string is static on the component and can be inspected without
    // needing to mount the tooltip in all 4 positions.
    // We render one instance and verify that the utility fragments Radix uses
    // to apply direction-aware animations are attached.
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip defaultOpen>
          <TooltipTrigger>t</TooltipTrigger>
          <TooltipContent side="top" data-testid="tip-top">
            Hi
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    const tip = screen.getByTestId('tip-top')
    expect(tip.className).toMatch(/data-\[side=top\]:slide-in-from-bottom-2/)
    expect(tip.className).toMatch(/data-\[side=bottom\]:slide-in-from-top-2/)
    expect(tip.className).toMatch(/data-\[side=left\]:slide-in-from-right-2/)
    expect(tip.className).toMatch(/data-\[side=right\]:slide-in-from-left-2/)
  })
})

describe('Popover sideOffset & align flow through to Radix content', () => {
  it('forwards data-align attribute from align prop', async () => {
    const user = userEvent.setup()
    render(
      <Popover>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent align="end" sideOffset={16} data-testid="pop">
          body
        </PopoverContent>
      </Popover>
    )

    await user.click(screen.getByText('open'))

    await waitFor(() => {
      expect(screen.getByTestId('pop')).toBeInTheDocument()
    })

    const pop = screen.getByTestId('pop')
    expect(pop).toHaveAttribute('data-align', 'end')
    // Also verify the side-aware animation class fragments are in place
    expect(pop.className).toMatch(/data-\[side=top\]:slide-in-from-bottom-2/)
    expect(pop.className).toMatch(/data-\[side=bottom\]:slide-in-from-top-2/)
  })
})

// NOTE: No component in the scope of these tests reads `window.matchMedia`
// directly at mount/update time. Responsive behavior in this codebase is
// delegated to Tailwind utilities such as `sm:max-w-sm`, which are applied
// statically via class strings and resolved by the browser's CSS engine.
// jsdom does not perform CSS layout, so we verify class inclusion above
// rather than mocking matchMedia and asserting layout.
describe('responsive class inclusion (static Tailwind utilities)', () => {
  it('Sheet left/right include sm:max-w-sm', async () => {
    const left = await openSheet('left')
    expect(left.className).toMatch(/sm:max-w-sm/)
  })
})
