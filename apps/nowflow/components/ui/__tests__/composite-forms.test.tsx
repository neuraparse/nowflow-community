/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

// Stub jsdom gaps used by Radix primitives (Select, RadioGroup, etc.)
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

const schema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  country: z.string().min(1, { message: 'Country is required' }),
  acceptTerms: z.boolean().refine((v) => v === true, { message: 'You must accept terms' }),
  plan: z.enum(['basic', 'pro'], { message: 'Pick a plan' }),
  notes: z.string().min(5, { message: 'Please add more notes' }),
})

type FormValues = z.infer<typeof schema>

type HarnessProps = {
  onSubmit?: (values: FormValues) => void
}

const CompositeHarness = ({ onSubmit = () => {} }: HarnessProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      country: '',
      acceptTerms: false,
      plan: undefined as unknown as 'basic',
      notes: '',
    },
    mode: 'onSubmit',
  })

  // Watch the acceptTerms value to conditionally disable the name input
  const accept = useWatch({ control: form.control, name: 'acceptTerms' })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="name" disabled={!accept} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="ca">Canada</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Accept</FormLabel>
              <FormControl>
                <Checkbox
                  aria-label="Accept terms"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan</FormLabel>
              <FormControl>
                <RadioGroup value={field.value} onValueChange={field.onChange}>
                  <RadioGroupItem value="basic" aria-label="basic" />
                  <RadioGroupItem value="pro" aria-label="pro" />
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <button type="submit">Submit</button>
        <button type="button" onClick={() => form.reset()}>
          Reset
        </button>
      </form>
    </Form>
  )
}

describe('Composite form (Input + Select + Checkbox + RadioGroup + Textarea)', () => {
  it('surfaces per-field zod errors on submit when empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CompositeHarness onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument()
    })
    expect(screen.getByText('Country is required')).toBeInTheDocument()
    expect(screen.getByText('You must accept terms')).toBeInTheDocument()
    expect(screen.getByText('Pick a plan')).toBeInTheDocument()
    expect(screen.getByText('Please add more notes')).toBeInTheDocument()

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('conditional disabling: name input is disabled until checkbox is checked', async () => {
    const user = userEvent.setup()
    render(<CompositeHarness />)

    const name = screen.getByPlaceholderText('name') as HTMLInputElement
    expect(name).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Accept terms' }))

    await waitFor(() => {
      expect(name).not.toBeDisabled()
    })
  })

  it('fills + submits valid form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CompositeHarness onSubmit={onSubmit} />)

    // Enable the name input first
    await user.click(screen.getByRole('checkbox', { name: 'Accept terms' }))

    const name = screen.getByPlaceholderText('name')
    await user.clear(name)
    await user.type(name, 'Bayram')

    // Open Select and pick
    await user.click(screen.getByRole('combobox', { name: 'Country' }))
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    await user.click(screen.getByRole('option', { name: 'United States' }))

    // RadioGroup
    await user.click(screen.getByRole('radio', { name: 'pro' }))

    // Textarea
    await user.type(screen.getByPlaceholderText('notes'), 'some helpful notes')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    const values = onSubmit.mock.calls[0][0]
    expect(values).toMatchObject({
      name: 'Bayram',
      country: 'us',
      acceptTerms: true,
      plan: 'pro',
      notes: 'some helpful notes',
    })
  })

  it('reset clears all values back to defaults', async () => {
    const user = userEvent.setup()
    render(<CompositeHarness />)

    // Enable name first via checkbox
    await user.click(screen.getByRole('checkbox', { name: 'Accept terms' }))

    const name = screen.getByPlaceholderText('name') as HTMLInputElement
    await user.type(name, 'Something')
    expect(name.value).toBe('Something')

    const notes = screen.getByPlaceholderText('notes') as HTMLTextAreaElement
    await user.type(notes, 'hello world text')
    expect(notes.value).toBe('hello world text')

    // Checkbox currently checked
    const cb = screen.getByRole('checkbox', { name: 'Accept terms' })
    expect(cb).toHaveAttribute('data-state', 'checked')

    await user.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => {
      expect((screen.getByPlaceholderText('name') as HTMLInputElement).value).toBe('')
    })
    expect((screen.getByPlaceholderText('notes') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toHaveAttribute(
      'data-state',
      'unchecked'
    )
  })
})
