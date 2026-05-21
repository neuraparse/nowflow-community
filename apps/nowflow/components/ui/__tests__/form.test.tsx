/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { zodResolver } from '@hookform/resolvers/zod'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const schema = z.object({
  email: z.string().email({ message: 'Enter a valid email' }),
  username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
})

type FormValues = z.infer<typeof schema>

type TestFormProps = {
  onSubmit?: (values: FormValues) => void
  defaultValues?: Partial<FormValues>
}

const TestForm = ({
  onSubmit = () => {},
  defaultValues = { email: '', username: '' },
}: TestFormProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as FormValues,
    mode: 'onSubmit',
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
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
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <input placeholder="username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </Form>
  )
}

describe('Form', () => {
  describe('rendering', () => {
    it('renders labels, inputs, and descriptions', () => {
      render(<TestForm />)

      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Username')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('username')).toBeInTheDocument()
      expect(screen.getByText('We will never share your email.')).toBeInTheDocument()
    })

    it('links the label htmlFor attribute to the control id (FormItem useId)', () => {
      render(<TestForm />)

      const input = screen.getByPlaceholderText('email')
      const label = screen.getByText('Email')
      expect(input.id).toBeTruthy()
      expect(input.id).toMatch(/-form-item$/)
      expect(label).toHaveAttribute('for', input.id)
    })

    it('applies the workflow-editor-form-item class to FormItem', () => {
      render(<TestForm />)
      expect(document.querySelector('.workflow-editor-form-item')).toBeInTheDocument()
    })

    it('applies the workflow-editor-form-description class to FormDescription', () => {
      render(<TestForm />)
      expect(document.querySelector('.workflow-editor-form-description')).toBeInTheDocument()
    })

    it('sets aria-describedby on FormControl referencing description id', () => {
      render(<TestForm />)
      const input = screen.getByPlaceholderText('email')
      const describedBy = input.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      expect(describedBy).toMatch(/-form-item-description/)
    })

    it('marks aria-invalid false when no error is present', () => {
      render(<TestForm />)
      const input = screen.getByPlaceholderText('email')
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })
  })

  describe('submission', () => {
    it('calls the submit handler with values when valid', async () => {
      const onSubmit = vi.fn()
      const user = userEvent.setup()
      render(<TestForm onSubmit={onSubmit} />)

      await user.type(screen.getByPlaceholderText('email'), 'hello@example.com')
      await user.type(screen.getByPlaceholderText('username'), 'alice')
      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1)
      })
      const [values] = onSubmit.mock.calls[0]
      expect(values).toEqual({ email: 'hello@example.com', username: 'alice' })
    })

    it('does not call submit when invalid and shows error messages', async () => {
      const onSubmit = vi.fn()
      const user = userEvent.setup()
      render(<TestForm onSubmit={onSubmit} />)

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
      })
      expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('marks controls aria-invalid when the field errors', async () => {
      const user = userEvent.setup()
      render(<TestForm />)

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('email')).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('applies destructive class to labels when their field errors', async () => {
      const user = userEvent.setup()
      render(<TestForm />)

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByText('Email')).toHaveClass('text-destructive')
      })
    })

    it('renders FormMessage with error message and workflow-editor-form-message class', async () => {
      const user = userEvent.setup()
      render(<TestForm />)

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByText('Enter a valid email')).toHaveClass('workflow-editor-form-message')
      })
    })

    it('clears the error once the field becomes valid', async () => {
      const onSubmit = vi.fn()
      const user = userEvent.setup()
      render(<TestForm onSubmit={onSubmit} />)

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('email'), 'hi@example.com')
      await user.type(screen.getByPlaceholderText('username'), 'alice')
      await user.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument()
      })
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })
})
