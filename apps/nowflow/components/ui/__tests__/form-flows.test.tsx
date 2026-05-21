/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
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

type Values = z.infer<typeof schema>

type HarnessProps = {
  onSubmit?: (v: Values) => void | Promise<void>
  mode?: 'onSubmit' | 'onChange' | 'onBlur'
}

const Harness = ({ onSubmit = () => {}, mode = 'onSubmit' }: HarnessProps) => {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', username: '' },
    mode,
  })

  const submitting = form.formState.isSubmitting

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
              <FormDescription>We never share your email.</FormDescription>
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
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Submit'}
        </button>
      </form>
    </Form>
  )
}

describe('Form flows', () => {
  it('invalid submit renders errors in FormMessage nodes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    })
    expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument()

    const errorMessages = document.querySelectorAll('.workflow-editor-form-message')
    expect(errorMessages.length).toBe(2)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('successful submit after fixing fields calls handler with correct values', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await user.type(screen.getByPlaceholderText('email'), 'hey@example.com')
    await user.type(screen.getByPlaceholderText('username'), 'alice')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect(onSubmit.mock.calls[0][0]).toEqual({
      email: 'hey@example.com',
      username: 'alice',
    })
  })

  it('clears error once a field is corrected and re-submitted', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => {
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('email'), 'ok@example.com')
    await user.type(screen.getByPlaceholderText('username'), 'alice')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Username must be at least 3 characters')).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('aria-invalid toggles true on error and aria-describedby includes the message id', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const email = screen.getByPlaceholderText('email') as HTMLInputElement
    expect(email).toHaveAttribute('aria-invalid', 'false')
    const initialDescribedBy = email.getAttribute('aria-describedby') ?? ''
    expect(initialDescribedBy).toMatch(/-form-item-description/)
    expect(initialDescribedBy).not.toMatch(/-form-item-message/)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(email).toHaveAttribute('aria-invalid', 'true')
    })
    const updatedDescribedBy = email.getAttribute('aria-describedby') ?? ''
    expect(updatedDescribedBy).toMatch(/-form-item-description/)
    expect(updatedDescribedBy).toMatch(/-form-item-message/)

    const messageId = updatedDescribedBy.split(' ').find((id) => id.includes('-form-item-message'))
    expect(messageId).toBeTruthy()
    const messageNode = document.getElementById(messageId as string)
    expect(messageNode).toHaveTextContent('Enter a valid email')
  })

  it('tab order goes email -> username -> submit', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const email = screen.getByPlaceholderText('email')
    email.focus()
    expect(email).toHaveFocus()

    await user.tab()
    expect(screen.getByPlaceholderText('username')).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus()
  })

  it('disables submit button while submitting', async () => {
    const user = userEvent.setup()
    let resolveSubmit: () => void = () => {}
    const submitPromise = new Promise<void>((r) => {
      resolveSubmit = r
    })
    const onSubmit = vi.fn(async () => submitPromise)

    render(<Harness onSubmit={onSubmit} />)

    await user.type(screen.getByPlaceholderText('email'), 'ok@example.com')
    await user.type(screen.getByPlaceholderText('username'), 'alice')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    })

    resolveSubmit()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).not.toBeDisabled()
    })
  })
})
