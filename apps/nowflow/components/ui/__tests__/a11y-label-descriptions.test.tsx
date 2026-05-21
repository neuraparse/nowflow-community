/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest'
import { zodResolver } from '@hookform/resolvers/zod'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!(window.Element.prototype as any).hasPointerCapture) {
    ;(window.Element.prototype as any).hasPointerCapture = () => false
  }
  if (!(window.Element.prototype as any).releasePointerCapture) {
    ;(window.Element.prototype as any).releasePointerCapture = () => {}
  }
  if (!(window.Element.prototype as any).setPointerCapture) {
    ;(window.Element.prototype as any).setPointerCapture = () => {}
  }
  if (!(window.Element.prototype as any).scrollIntoView) {
    ;(window.Element.prototype as any).scrollIntoView = () => {}
  }
})

describe('A11y: labels and descriptions', () => {
  describe('Label + Input (htmlFor)', () => {
    it('clicking the label focuses the associated input', async () => {
      const user = userEvent.setup()
      render(
        <>
          <Label htmlFor="email-input">Email</Label>
          <Input id="email-input" type="email" data-testid="email-input" />
        </>
      )

      const label = screen.getByText('Email')
      expect(label).toHaveAttribute('for', 'email-input')

      await user.click(label)

      expect(screen.getByTestId('email-input')).toHaveFocus()
    })
  })

  describe('FormItem wiring', () => {
    it('wires FormLabel htmlFor, FormControl id, FormDescription and FormMessage via aria-describedby', async () => {
      const schema = z.object({
        email: z.string().email({ message: 'Enter a valid email' }),
      })
      type FormValues = z.infer<typeof schema>

      const TestForm = () => {
        const form = useForm<FormValues>({
          resolver: zodResolver(schema),
          defaultValues: { email: '' },
          mode: 'onSubmit',
        })

        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(() => {})} noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <input placeholder="email" {...field} />
                    </FormControl>
                    <FormDescription>We will never share your email.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit">Submit</button>
            </form>
          </Form>
        )
      }

      const user = userEvent.setup()
      render(<TestForm />)

      const input = screen.getByPlaceholderText('email')
      const label = screen.getByText('Email')
      const description = screen.getByText('We will never share your email.')

      // Label is associated with the control via htmlFor === input.id.
      expect(input.id).toBeTruthy()
      expect(label).toHaveAttribute('for', input.id)

      // Description is linked via aria-describedby when no error is present.
      const describedBy = input.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      expect(description.id).toBeTruthy()
      expect(describedBy!.split(/\s+/)).toContain(description.id)

      // Initially valid → aria-invalid=false.
      expect(input).toHaveAttribute('aria-invalid', 'false')

      // After a failed submit, the error message id joins aria-describedby and aria-invalid=true.
      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
      })
      const message = screen.getByText('Enter a valid email')
      const describedByAfter = input.getAttribute('aria-describedby') || ''
      expect(describedByAfter.split(/\s+/)).toContain(message.id)
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('RadioGroup items labeled', () => {
    it('individual radio items expose an accessible name via aria-label', () => {
      render(
        <RadioGroup aria-label="fruit">
          <RadioGroupItem value="a" aria-label="Apple" />
          <RadioGroupItem value="b" aria-label="Banana" />
        </RadioGroup>
      )

      expect(screen.getByRole('radio', { name: 'Apple' })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Banana' })).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'fruit' })).toBeInTheDocument()
    })

    it('individual radio items can be labeled via aria-labelledby', () => {
      render(
        <RadioGroup aria-label="fruit">
          <span id="lbl-a">Apple</span>
          <RadioGroupItem value="a" aria-labelledby="lbl-a" />
        </RadioGroup>
      )

      expect(screen.getByRole('radio', { name: 'Apple' })).toBeInTheDocument()
    })
  })

  describe('Checkbox labeled', () => {
    it('Checkbox exposes an accessible name via aria-label', () => {
      render(<Checkbox aria-label="Accept terms" />)
      expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeInTheDocument()
    })

    it('Checkbox can be labeled via an external Label via htmlFor and id', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <Label htmlFor="cb-1">Accept terms</Label>
          <Checkbox id="cb-1" />
        </div>
      )

      const label = screen.getByText('Accept terms')
      expect(label).toHaveAttribute('for', 'cb-1')

      // Clicking the label should activate/focus the checkbox via Radix Label integration.
      const cb = screen.getByRole('checkbox')
      await user.click(label)
      // After clicking the label, the checkbox should be checked.
      expect(cb).toHaveAttribute('data-state', 'checked')
    })
  })
})
