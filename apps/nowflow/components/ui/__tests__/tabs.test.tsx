/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const renderTabs = (overrides: { onValueChange?: (v: string) => void } = {}) =>
  render(
    <Tabs defaultValue="tab-1" onValueChange={overrides.onValueChange}>
      <TabsList className="custom-list-class">
        <TabsTrigger value="tab-1" className="custom-trigger-class">
          Tab One
        </TabsTrigger>
        <TabsTrigger value="tab-2">Tab Two</TabsTrigger>
        <TabsTrigger value="tab-3" disabled>
          Tab Three
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tab-1" className="custom-content-class">
        Panel One
      </TabsContent>
      <TabsContent value="tab-2">Panel Two</TabsContent>
      <TabsContent value="tab-3">Panel Three</TabsContent>
    </Tabs>
  )

describe('Tabs', () => {
  it('renders the default active tab content', () => {
    renderTabs()

    expect(screen.getByRole('tab', { name: 'Tab One' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Panel One')).toBeInTheDocument()
    expect(screen.queryByText('Panel Two')).not.toBeInTheDocument()
  })

  it('switches tabs on click and fires onValueChange with new value', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderTabs({ onValueChange })

    await user.click(screen.getByRole('tab', { name: 'Tab Two' }))

    expect(onValueChange).toHaveBeenCalledWith('tab-2')
    expect(screen.getByRole('tab', { name: 'Tab Two' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Panel Two')).toBeInTheDocument()
  })

  it('supports keyboard arrow navigation and activates tab with focus', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderTabs({ onValueChange })

    const firstTab = screen.getByRole('tab', { name: 'Tab One' })
    firstTab.focus()

    await user.keyboard('{ArrowRight}')

    expect(onValueChange).toHaveBeenCalledWith('tab-2')
    expect(screen.getByRole('tab', { name: 'Tab Two' })).toHaveFocus()
  })

  it('marks disabled triggers as disabled and does not activate them', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderTabs({ onValueChange })

    const disabledTab = screen.getByRole('tab', { name: 'Tab Three' })
    expect(disabledTab).toBeDisabled()

    await user.click(disabledTab)

    expect(onValueChange).not.toHaveBeenCalled()
    expect(disabledTab).not.toHaveAttribute('data-state', 'active')
  })

  it('forwards className to list, trigger, and content', () => {
    renderTabs()

    expect(screen.getByRole('tablist')).toHaveClass('custom-list-class')
    expect(screen.getByRole('tab', { name: 'Tab One' })).toHaveClass('custom-trigger-class')
    expect(screen.getByText('Panel One')).toHaveClass('custom-content-class')
  })
})
