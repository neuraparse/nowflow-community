/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Stub jsdom gaps used by Radix primitives.
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

describe('Checkbox controlled vs uncontrolled', () => {
  it('controlled: parent owns checked state and onCheckedChange fires', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    const Harness = () => {
      const [checked, setChecked] = React.useState(false)
      return (
        <Checkbox
          aria-label="cb"
          checked={checked}
          onCheckedChange={(next) => {
            onChange(next)
            setChecked(Boolean(next))
          }}
        />
      )
    }

    render(<Harness />)
    const cb = screen.getByRole('checkbox', { name: 'cb' })
    expect(cb).toHaveAttribute('data-state', 'unchecked')

    await user.click(cb)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(cb).toHaveAttribute('data-state', 'checked')
  })

  it('controlled: without parent updating state, internal state does not change', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox aria-label="cb" checked={false} onCheckedChange={onChange} />)
    const cb = screen.getByRole('checkbox', { name: 'cb' })

    await user.click(cb)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(cb).toHaveAttribute('data-state', 'unchecked')
  })

  it('uncontrolled: defaultChecked initializes state and toggles freely', async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label="cb" defaultChecked />)
    const cb = screen.getByRole('checkbox', { name: 'cb' })
    expect(cb).toHaveAttribute('data-state', 'checked')

    await user.click(cb)
    expect(cb).toHaveAttribute('data-state', 'unchecked')
  })
})

describe('Switch controlled vs uncontrolled', () => {
  it('controlled: parent drives checked; onCheckedChange reports intent', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    const Harness = () => {
      const [on, setOn] = React.useState(false)
      return (
        <Switch
          aria-label="sw"
          checked={on}
          onCheckedChange={(next) => {
            onChange(next)
            setOn(next)
          }}
        />
      )
    }

    render(<Harness />)
    const sw = screen.getByRole('switch', { name: 'sw' })
    expect(sw).toHaveAttribute('data-state', 'unchecked')

    await user.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(sw).toHaveAttribute('data-state', 'checked')
  })

  it('uncontrolled: defaultChecked sets initial on-state and can be toggled', async () => {
    const user = userEvent.setup()
    render(<Switch aria-label="sw" defaultChecked />)
    const sw = screen.getByRole('switch', { name: 'sw' })
    expect(sw).toHaveAttribute('data-state', 'checked')

    await user.click(sw)
    expect(sw).toHaveAttribute('data-state', 'unchecked')
  })
})

describe('RadioGroup controlled vs uncontrolled', () => {
  const Items = () => (
    <>
      <RadioGroupItem value="a" aria-label="a" />
      <RadioGroupItem value="b" aria-label="b" />
      <RadioGroupItem value="c" aria-label="c" />
    </>
  )

  it('controlled: onValueChange fires and parent drives selection', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const Harness = () => {
      const [value, setValue] = React.useState('a')
      return (
        <RadioGroup
          value={value}
          onValueChange={(v) => {
            onValueChange(v)
            setValue(v)
          }}
        >
          <Items />
        </RadioGroup>
      )
    }

    render(<Harness />)
    expect(screen.getByRole('radio', { name: 'a' })).toHaveAttribute('data-state', 'checked')

    await user.click(screen.getByRole('radio', { name: 'b' }))
    expect(onValueChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('radio', { name: 'b' })).toHaveAttribute('data-state', 'checked')
    expect(screen.getByRole('radio', { name: 'a' })).toHaveAttribute('data-state', 'unchecked')
  })

  it('uncontrolled: defaultValue sets initial and selection changes freely', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <RadioGroup defaultValue="a" onValueChange={onValueChange}>
        <Items />
      </RadioGroup>
    )

    await user.click(screen.getByRole('radio', { name: 'c' }))
    expect(onValueChange).toHaveBeenCalledWith('c')
    expect(screen.getByRole('radio', { name: 'c' })).toHaveAttribute('data-state', 'checked')
  })
})

describe('Select controlled', () => {
  it('controlled: value + onValueChange drive selection', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const Harness = () => {
      const [v, setV] = React.useState('apple')
      return (
        <Select
          value={v}
          onValueChange={(next) => {
            onValueChange(next)
            setV(next)
          }}
        >
          <SelectTrigger aria-label="Fruit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveTextContent('Apple')

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }))
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await user.click(screen.getByRole('option', { name: 'Banana' }))

    expect(onValueChange).toHaveBeenCalledWith('banana')
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveTextContent('Banana')
    })
  })
})

describe('Slider controlled', () => {
  it('renders controlled value=[n] and aria-valuenow reflects it', () => {
    const { rerender } = render(<Slider value={[30]} onValueChange={() => {}} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuenow', '30')

    rerender(<Slider value={[70]} onValueChange={() => {}} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '70')
  })

  it('controlled: onValueChange fires on keyboard interaction', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const Harness = () => {
      const [val, setVal] = React.useState<number[]>([50])
      return (
        <Slider
          value={val}
          onValueChange={(next) => {
            onValueChange(next)
            setVal(next)
          }}
          min={0}
          max={100}
          step={1}
        />
      )
    }

    render(<Harness />)
    const slider = screen.getByRole('slider')
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenCalled()
    const last = onValueChange.mock.calls[onValueChange.mock.calls.length - 1][0]
    expect(last[0]).toBeGreaterThan(50)
  })
})

describe('Tabs controlled', () => {
  it('value + onValueChange drive the active tab', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const Harness = () => {
      const [v, setV] = React.useState('one')
      return (
        <Tabs
          value={v}
          onValueChange={(next) => {
            onValueChange(next)
            setV(next)
          }}
        >
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Content One</TabsContent>
          <TabsContent value="two">Content Two</TabsContent>
        </Tabs>
      )
    }

    render(<Harness />)
    expect(screen.getByText('Content One')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Two' }))
    expect(onValueChange).toHaveBeenCalledWith('two')
    await waitFor(() => {
      expect(screen.getByText('Content Two')).toBeInTheDocument()
    })
  })
})

describe('Accordion controlled', () => {
  it('single type: controlled value + onValueChange', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const Harness = () => {
      const [v, setV] = React.useState<string>('')
      return (
        <Accordion
          type="single"
          collapsible
          value={v}
          onValueChange={(next) => {
            onValueChange(next)
            setV(next)
          }}
        >
          <AccordionItem value="a">
            <AccordionTrigger>A</AccordionTrigger>
            <AccordionContent>Content A</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>B</AccordionTrigger>
            <AccordionContent>Content B</AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    }

    render(<Harness />)
    expect(screen.queryByText('Content A')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'A' }))
    expect(onValueChange).toHaveBeenCalledWith('a')
    await waitFor(() => {
      expect(screen.getByText('Content A')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'B' }))
    expect(onValueChange).toHaveBeenCalledWith('b')
    await waitFor(() => {
      expect(screen.getByText('Content B')).toBeInTheDocument()
    })
  })

  it('multiple type: controlled value as string[] + onValueChange', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const Harness = () => {
      const [v, setV] = React.useState<string[]>([])
      return (
        <Accordion
          type="multiple"
          value={v}
          onValueChange={(next) => {
            onValueChange(next)
            setV(next)
          }}
        >
          <AccordionItem value="a">
            <AccordionTrigger>A</AccordionTrigger>
            <AccordionContent>Content A</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>B</AccordionTrigger>
            <AccordionContent>Content B</AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    await user.click(screen.getByRole('button', { name: 'B' }))

    await waitFor(() => {
      expect(screen.getByText('Content A')).toBeInTheDocument()
      expect(screen.getByText('Content B')).toBeInTheDocument()
    })

    const last = onValueChange.mock.calls[onValueChange.mock.calls.length - 1][0]
    expect(Array.isArray(last)).toBe(true)
    expect(last).toEqual(expect.arrayContaining(['a', 'b']))
  })
})
