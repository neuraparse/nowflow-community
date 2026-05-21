/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RadioGroup, RadioGroupItem } from '../radio-group'

const renderGroup = (props: React.ComponentProps<typeof RadioGroup> = {}) =>
  render(
    <RadioGroup aria-label="group" {...props}>
      <RadioGroupItem value="a" aria-label="option-a" />
      <RadioGroupItem value="b" aria-label="option-b" />
      <RadioGroupItem value="c" aria-label="option-c" />
    </RadioGroup>
  )

describe('RadioGroup', () => {
  describe('rendering', () => {
    it('renders a radiogroup with radio items', () => {
      renderGroup()
      expect(screen.getByRole('radiogroup', { name: 'group' })).toBeInTheDocument()
      expect(screen.getAllByRole('radio')).toHaveLength(3)
    })

    it('applies the base workflow-editor-radio-group class', () => {
      renderGroup()
      expect(screen.getByRole('radiogroup', { name: 'group' })).toHaveClass(
        'workflow-editor-radio-group'
      )
    })

    it('applies workflow-editor-radio-item class on items', () => {
      renderGroup()
      screen.getAllByRole('radio').forEach((item) => {
        expect(item).toHaveClass('workflow-editor-radio-item')
      })
    })
  })

  describe('default value (uncontrolled)', () => {
    it('respects defaultValue prop', () => {
      renderGroup({ defaultValue: 'b' })
      const radios = screen.getAllByRole('radio')
      expect(radios[0]).toHaveAttribute('data-state', 'unchecked')
      expect(radios[1]).toHaveAttribute('data-state', 'checked')
      expect(radios[2]).toHaveAttribute('data-state', 'unchecked')
    })

    it('changes selection on click when uncontrolled', async () => {
      const user = userEvent.setup()
      renderGroup()
      const optionA = screen.getByRole('radio', { name: 'option-a' })
      const optionB = screen.getByRole('radio', { name: 'option-b' })

      await user.click(optionA)
      expect(optionA).toHaveAttribute('data-state', 'checked')
      expect(optionB).toHaveAttribute('data-state', 'unchecked')

      await user.click(optionB)
      expect(optionA).toHaveAttribute('data-state', 'unchecked')
      expect(optionB).toHaveAttribute('data-state', 'checked')
    })
  })

  describe('keyboard navigation', () => {
    it('selects an item via Space when focused', async () => {
      const user = userEvent.setup()
      renderGroup()
      const optionB = screen.getByRole('radio', { name: 'option-b' })

      optionB.focus()
      expect(optionB).toHaveFocus()

      await user.keyboard(' ')
      expect(optionB).toHaveAttribute('data-state', 'checked')
    })
  })

  describe('controlled mode', () => {
    it('reflects value prop', () => {
      const { rerender } = render(
        <RadioGroup value="a" onValueChange={() => {}} aria-label="g">
          <RadioGroupItem value="a" aria-label="a" />
          <RadioGroupItem value="b" aria-label="b" />
        </RadioGroup>
      )
      expect(screen.getByRole('radio', { name: 'a' })).toHaveAttribute('data-state', 'checked')
      expect(screen.getByRole('radio', { name: 'b' })).toHaveAttribute('data-state', 'unchecked')

      rerender(
        <RadioGroup value="b" onValueChange={() => {}} aria-label="g">
          <RadioGroupItem value="a" aria-label="a" />
          <RadioGroupItem value="b" aria-label="b" />
        </RadioGroup>
      )
      expect(screen.getByRole('radio', { name: 'a' })).toHaveAttribute('data-state', 'unchecked')
      expect(screen.getByRole('radio', { name: 'b' })).toHaveAttribute('data-state', 'checked')
    })

    it('does not update internal state without parent update in controlled mode', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(
        <RadioGroup value="a" onValueChange={onValueChange} aria-label="g">
          <RadioGroupItem value="a" aria-label="a" />
          <RadioGroupItem value="b" aria-label="b" />
        </RadioGroup>
      )

      await user.click(screen.getByRole('radio', { name: 'b' }))
      expect(onValueChange).toHaveBeenCalledWith('b')
      expect(screen.getByRole('radio', { name: 'a' })).toHaveAttribute('data-state', 'checked')
    })
  })

  describe('onValueChange callback', () => {
    it('fires onValueChange when an item is clicked', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      renderGroup({ onValueChange })

      await user.click(screen.getByRole('radio', { name: 'option-b' }))
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenCalledWith('b')
    })
  })

  describe('disabled state', () => {
    it('disables all items when group is disabled', () => {
      renderGroup({ disabled: true })
      screen.getAllByRole('radio').forEach((radio) => {
        expect(radio).toBeDisabled()
      })
    })

    it('disables an individual item', () => {
      render(
        <RadioGroup aria-label="g">
          <RadioGroupItem value="a" aria-label="a" />
          <RadioGroupItem value="b" aria-label="b" disabled />
        </RadioGroup>
      )
      expect(screen.getByRole('radio', { name: 'a' })).not.toBeDisabled()
      expect(screen.getByRole('radio', { name: 'b' })).toBeDisabled()
    })

    it('does not fire onValueChange when disabled', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      renderGroup({ disabled: true, onValueChange })

      await user.click(screen.getByRole('radio', { name: 'option-a' }))
      expect(onValueChange).not.toHaveBeenCalled()
    })
  })

  describe('aria roles/labels', () => {
    it('uses role=radiogroup on root', () => {
      renderGroup()
      expect(screen.getByRole('radiogroup', { name: 'group' })).toBeInTheDocument()
    })

    it('uses role=radio on items', () => {
      renderGroup()
      expect(screen.getAllByRole('radio')).toHaveLength(3)
    })

    it('sets aria-checked when item is selected', () => {
      renderGroup({ defaultValue: 'a' })
      expect(screen.getByRole('radio', { name: 'option-a' })).toHaveAttribute(
        'aria-checked',
        'true'
      )
      expect(screen.getByRole('radio', { name: 'option-b' })).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })
  })

  describe('className passthrough', () => {
    it('merges custom className on RadioGroup', () => {
      render(
        <RadioGroup className="group-custom" aria-label="g">
          <RadioGroupItem value="a" aria-label="a" />
        </RadioGroup>
      )
      const group = screen.getByRole('radiogroup', { name: 'g' })
      expect(group).toHaveClass('group-custom')
      expect(group).toHaveClass('workflow-editor-radio-group')
    })

    it('merges custom className on RadioGroupItem', () => {
      render(
        <RadioGroup aria-label="g">
          <RadioGroupItem value="a" aria-label="a" className="item-custom" />
        </RadioGroup>
      )
      const item = screen.getByRole('radio', { name: 'a' })
      expect(item).toHaveClass('item-custom')
      expect(item).toHaveClass('workflow-editor-radio-item')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref on RadioGroup', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(
        <RadioGroup ref={ref} aria-label="g">
          <RadioGroupItem value="a" aria-label="a" />
        </RadioGroup>
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.getAttribute('role')).toBe('radiogroup')
    })

    it('forwards ref on RadioGroupItem', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(
        <RadioGroup aria-label="g">
          <RadioGroupItem ref={ref} value="a" aria-label="a" />
        </RadioGroup>
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.getAttribute('role')).toBe('radio')
    })
  })
})
