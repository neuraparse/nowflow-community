/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

type HarnessProps = {
  defaultValue?: string
  onValueChange?: (v: string) => void
  disableSecond?: boolean
}

const Harness = ({ defaultValue = 'one', onValueChange, disableSecond }: HarnessProps) => (
  <Tabs defaultValue={defaultValue} onValueChange={onValueChange}>
    <TabsList>
      <TabsTrigger value="one">One</TabsTrigger>
      <TabsTrigger value="two" disabled={disableSecond}>
        Two
      </TabsTrigger>
      <TabsTrigger value="three">Three</TabsTrigger>
    </TabsList>
    <TabsContent value="one">Content One</TabsContent>
    <TabsContent value="two">Content Two</TabsContent>
    <TabsContent value="three">Content Three</TabsContent>
  </Tabs>
)

describe('Tabs keyboard + aria flows', () => {
  it('ArrowRight cycles to next trigger and updates selection', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Harness onValueChange={onValueChange} />)

    const first = screen.getByRole('tab', { name: 'One' })
    first.focus()

    await user.keyboard('{ArrowRight}')

    expect(onValueChange).toHaveBeenCalledWith('two')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowLeft cycles to previous trigger', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Harness defaultValue="three" onValueChange={onValueChange} />)

    const third = screen.getByRole('tab', { name: 'Three' })
    third.focus()

    await user.keyboard('{ArrowLeft}')

    expect(onValueChange).toHaveBeenCalledWith('two')
  })

  it('Home jumps to first tab and End jumps to last tab', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Harness defaultValue="two" onValueChange={onValueChange} />)

    const middle = screen.getByRole('tab', { name: 'Two' })
    middle.focus()

    await user.keyboard('{End}')
    expect(onValueChange).toHaveBeenLastCalledWith('three')

    await user.keyboard('{Home}')
    expect(onValueChange).toHaveBeenLastCalledWith('one')
  })

  it('aria-selected is only true for the active tab', () => {
    render(<Harness defaultValue="two" />)
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'false')
  })

  it('disabled tab stays inactive and is skipped in arrow navigation', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Harness disableSecond onValueChange={onValueChange} />)

    const first = screen.getByRole('tab', { name: 'One' })
    first.focus()

    await user.keyboard('{ArrowRight}')

    // Radix Tabs skips disabled triggers — selection lands on 'three'.
    expect(onValueChange).toHaveBeenCalledWith('three')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('data-disabled')
  })

  it('tab panel role and aria-labelledby are wired', () => {
    render(<Harness />)
    const trigger = screen.getByRole('tab', { name: 'One' })
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', trigger.id)
    expect(panel).toHaveTextContent('Content One')
  })
})
