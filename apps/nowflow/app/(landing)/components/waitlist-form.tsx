'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const emailSchema = z.string().email('Please enter a valid email')

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'exists' | 'ratelimited'>(
    'idle'
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('idle')
    setErrorMessage('')
    setRetryAfter(null)

    try {
      // Validate email
      emailSchema.parse(email)

      setIsSubmitting(true)
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check for rate limiting (429 status)
        if (response.status === 429) {
          setStatus('ratelimited')
          setErrorMessage(data.message || 'Too many attempts. Please try again later.')
          setRetryAfter(data.retryAfter || 60)
        }
        // Check if the error is because the email already exists
        else if (response.status === 400 && data.message?.includes('already exists')) {
          setStatus('exists')
          setErrorMessage('Already on the waitlist')
        } else {
          setStatus('error')
          setErrorMessage(data.message || 'Failed to join waitlist')
        }
        return
      }

      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
      setErrorMessage('Please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getButtonText = () => {
    if (isSubmitting) return 'Joining...'
    if (status === 'success') return 'Joined!'
    if (status === 'error') return 'Try again'
    if (status === 'exists') return 'Already joined'
    if (status === 'ratelimited') return `Try again later`
    return 'Join waitlist'
  }

  const getButtonStyle = () => {
    switch (status) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600'
      case 'error':
        return 'bg-red-500 hover:bg-red-600'
      case 'exists':
        return 'bg-amber-500 hover:bg-amber-600'
      case 'ratelimited':
        return 'bg-gray-500 hover:bg-gray-600'
      default:
        return 'bg-white text-black hover:bg-gray-100 dark:bg-white dark:text-black dark:hover:bg-gray-200'
    }
  }

  const getFeedbackMessage = () => {
    if (status === 'success') return 'You are on the waitlist.'
    if (status === 'exists') return errorMessage
    if (status === 'ratelimited') {
      return retryAfter ? `${errorMessage} Try again in ${retryAfter}s.` : errorMessage
    }
    if (status === 'error') return errorMessage
    return ''
  }

  const feedbackMessage = getFeedbackMessage()

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 items-center max-w-lg mx-auto mt-8"
    >
      <div className="flex w-full gap-3">
        <Input
          type="email"
          placeholder="you@example.com"
          className="font-body h-[49px] flex-1 rounded-md border-white/20 bg-slate-950 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:ring-white/30 dark:bg-slate-950 md:text-md lg:text-[16px]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting || status === 'ratelimited'}
        />
        <Button
          type="submit"
          className={`font-tech h-[48px] rounded-md px-8 text-sm font-semibold uppercase tracking-[0.12em] md:text-md ${getButtonStyle()}`}
          disabled={isSubmitting || status === 'ratelimited'}
        >
          {getButtonText()}
        </Button>
      </div>
      {feedbackMessage && (
        <p className="text-center text-xs text-white/60" role="status">
          {feedbackMessage}
        </p>
      )}
    </form>
  )
}
