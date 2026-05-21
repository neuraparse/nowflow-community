/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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

beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  const proto = window.HTMLElement.prototype as any
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {}
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {}
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {}
})

describe('Keyboard navigation coverage', () => {
  describe('Tabs', () => {
    it('supports ArrowRight/ArrowLeft/Home/End', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Tabs defaultValue="b" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
            <TabsTrigger value="c">C</TabsTrigger>
          </TabsList>
          <TabsContent value="a">A content</TabsContent>
          <TabsContent value="b">B content</TabsContent>
          <TabsContent value="c">C content</TabsContent>
        </Tabs>
      )

      const tabB = screen.getByRole('tab', { name: 'B' })
      tabB.focus()

      await user.keyboard('{ArrowRight}')
      expect(onValueChange).toHaveBeenLastCalledWith('c')

      await user.keyboard('{ArrowLeft}')
      expect(onValueChange).toHaveBeenLastCalledWith('b')

      await user.keyboard('{Home}')
      expect(onValueChange).toHaveBeenLastCalledWith('a')

      await user.keyboard('{End}')
      expect(onValueChange).toHaveBeenLastCalledWith('c')
    })
  })

  describe('Accordion', () => {
    it('Enter and Space activate the focused trigger', async () => {
      const user = userEvent.setup()
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="x">
            <AccordionTrigger>X</AccordionTrigger>
            <AccordionContent>X body</AccordionContent>
          </AccordionItem>
        </Accordion>
      )

      const trigger = screen.getByRole('button', { name: 'X' })
      trigger.focus()

      await user.keyboard('{Enter}')
      expect(trigger).toHaveAttribute('aria-expanded', 'true')

      await user.keyboard(' ')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('RadioGroup', () => {
    it('Space selects the focused item', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <RadioGroup onValueChange={onValueChange}>
          <RadioGroupItem value="a" aria-label="a-item" />
          <RadioGroupItem value="b" aria-label="b-item" />
        </RadioGroup>
      )

      const b = screen.getByLabelText('b-item')
      b.focus()
      await user.keyboard(' ')
      expect(onValueChange).toHaveBeenCalledWith('b')
    })
  })

  describe('Select', () => {
    it('opens with keyboard and selects with Enter', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger aria-label="select-trigger">
            <SelectValue placeholder="Pick" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="x">X</SelectItem>
            <SelectItem value="y">Y</SelectItem>
          </SelectContent>
        </Select>
      )

      const trigger = screen.getByLabelText('select-trigger')
      trigger.focus()
      await user.keyboard('{Enter}')
      // Navigate down and pick the second option
      await user.keyboard('{ArrowDown}{Enter}')
      expect(onValueChange).toHaveBeenCalledWith('y')
    })
  })

  describe('Command', () => {
    it('ArrowDown + Enter selects the next item', async () => {
      const user = userEvent.setup()
      const onSecond = vi.fn()
      render(
        <Command defaultValue="first">
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandEmpty>No</CommandEmpty>
            <CommandGroup>
              <CommandItem value="first">First</CommandItem>
              <CommandItem value="second" onSelect={onSecond}>
                Second
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      )

      const input = screen.getByPlaceholderText('Search')
      input.focus()
      await user.keyboard('{ArrowDown}{Enter}')
      expect(onSecond).toHaveBeenCalled()
    })
  })

  describe('Slider', () => {
    it('ArrowRight/ArrowLeft/Home/End change the value', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <Slider
          defaultValue={[50]}
          min={0}
          max={100}
          step={10}
          aria-label="vol"
          onValueChange={onValueChange}
        />
      )

      const thumb = screen.getByRole('slider')
      thumb.focus()

      await user.keyboard('{ArrowRight}')
      expect(onValueChange).toHaveBeenLastCalledWith([60])

      await user.keyboard('{ArrowLeft}')
      expect(onValueChange).toHaveBeenLastCalledWith([50])

      await user.keyboard('{Home}')
      expect(onValueChange).toHaveBeenLastCalledWith([0])

      await user.keyboard('{End}')
      expect(onValueChange).toHaveBeenLastCalledWith([100])
    })
  })

  describe('Switch', () => {
    it('Space toggles', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Switch aria-label="s" onCheckedChange={onCheckedChange} />)

      const s = screen.getByRole('switch')
      s.focus()
      await user.keyboard(' ')
      expect(onCheckedChange).toHaveBeenCalledWith(true)
    })
  })

  describe('Checkbox', () => {
    it('Space toggles', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      render(<Checkbox aria-label="c" onCheckedChange={onCheckedChange} />)

      const c = screen.getByRole('checkbox')
      c.focus()
      await user.keyboard(' ')
      expect(onCheckedChange).toHaveBeenCalledWith(true)
    })
  })
})
