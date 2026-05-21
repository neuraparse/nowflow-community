'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface RequestResetFormProps {
  email: string
  onEmailChange: (email: string) => void
  onSubmit: (email: string) => Promise<void>
  isSubmitting: boolean
  statusType: 'success' | 'error' | null
  statusMessage: string
  className?: string
  submitDisabled?: boolean
  children?: React.ReactNode
}

export function RequestResetForm({
  email,
  onEmailChange,
  onSubmit,
  isSubmitting,
  statusType,
  statusMessage,
  className,
  submitDisabled,
  children,
}: RequestResetFormProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(email)
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label
            htmlFor="reset-email"
            className="font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30"
          >
            Email address
          </Label>
          <Input
            id="reset-email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Enter your email"
            type="email"
            disabled={isSubmitting}
            required
            className={cn(
              'border dark:bg-white/[0.06] bg-white/80 h-12 rounded-xl border-white/60 dark:border-white/[0.1] px-4 text-[14px] font-body text-zinc-800 dark:text-white shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
              'placeholder:text-zinc-500 dark:placeholder:text-white/20',
              'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
              'transition-all duration-200'
            )}
          />
          <p className="font-body text-[11px] text-zinc-400 dark:text-white/22">
            We&apos;ll send a password reset link to this email address.
          </p>
        </div>

        {/* Status message display */}
        {statusType && (
          <div
            className={cn(
              'silver-glass-pane rounded-xl border p-3 text-[13px] font-body',
              statusType === 'success'
                ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-500/20'
                : 'bg-red-50/80 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-300 dark:border-red-500/20'
            )}
          >
            {statusMessage}
          </div>
        )}

        {children}

        {/* Submit button with rotating border */}
        <div className="relative rounded-xl group/submit">
          <div
            className="absolute -inset-[1px] rounded-[13px] opacity-40 group-hover/submit:opacity-70 transition-opacity duration-500"
            style={{
              background:
                'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 40%, #4A7A6880 70%, transparent 90%)',
              animation: 'border-spin 4s linear infinite',
            }}
          />
          <Button
            type="submit"
            disabled={isSubmitting || submitDisabled}
            className={cn(
              'silver-glass-button-strong relative z-10 h-12 w-full rounded-xl text-[11px] font-tech font-semibold uppercase tracking-[0.15em] text-zinc-900 dark:text-black',
              'active:scale-[0.99] disabled:opacity-60 transition-all duration-200'
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent dark:border-black/85 dark:border-t-transparent" />
                <span>Sending...</span>
              </div>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

interface SetNewPasswordFormProps {
  token: string | null
  onSubmit: (password: string) => Promise<void>
  isSubmitting: boolean
  statusType: 'success' | 'error' | null
  statusMessage: string
  className?: string
}

export function SetNewPasswordForm({
  token,
  onSubmit,
  isSubmitting,
  statusType,
  statusMessage,
  className,
}: SetNewPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationMessage, setValidationMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Simple validation
    if (password.length < 8) {
      setValidationMessage('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      setValidationMessage('Passwords do not match')
      return
    }

    setValidationMessage('')
    onSubmit(password)
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label
            htmlFor="password"
            className="font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30"
          >
            New Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter new password"
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect="off"
            disabled={isSubmitting || !token}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={cn(
              'border dark:bg-white/[0.06] bg-white/80 h-12 rounded-xl border-white/60 dark:border-white/[0.1] px-4 text-[14px] font-body text-zinc-800 dark:text-white shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
              'placeholder:text-zinc-500 dark:placeholder:text-white/20',
              'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
              'transition-all duration-200'
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor="confirmPassword"
            className="font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30"
          >
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect="off"
            disabled={isSubmitting || !token}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={cn(
              'border dark:bg-white/[0.06] bg-white/80 h-12 rounded-xl border-white/60 dark:border-white/[0.1] px-4 text-[14px] font-body text-zinc-800 dark:text-white shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
              'placeholder:text-zinc-500 dark:placeholder:text-white/20',
              'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
              'transition-all duration-200'
            )}
          />
        </div>

        {validationMessage && (
          <div className="silver-glass-pane rounded-xl border border-red-200/60 bg-red-50/80 p-3 text-[13px] text-red-700 font-body dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-300">
            {validationMessage}
          </div>
        )}

        {statusType && (
          <div
            className={cn(
              'silver-glass-pane rounded-xl border p-3 text-[13px] font-body',
              statusType === 'success'
                ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-500/20'
                : 'bg-red-50/80 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-300 dark:border-red-500/20'
            )}
          >
            {statusMessage}
          </div>
        )}

        {/* Submit button with rotating border */}
        <div className="relative rounded-xl group/submit">
          <div
            className="absolute -inset-[1px] rounded-[13px] opacity-40 group-hover/submit:opacity-70 transition-opacity duration-500"
            style={{
              background:
                'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 40%, #4A7A6880 70%, transparent 90%)',
              animation: 'border-spin 4s linear infinite',
            }}
          />
          <Button
            disabled={isSubmitting || !token}
            type="submit"
            className={cn(
              'silver-glass-button-strong relative z-10 h-12 w-full rounded-xl text-[11px] font-tech font-semibold uppercase tracking-[0.15em] text-zinc-900 dark:text-black',
              'active:scale-[0.99] disabled:opacity-60 transition-all duration-200'
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent dark:border-black/85 dark:border-t-transparent" />
                <span>Resetting...</span>
              </div>
            ) : (
              'Reset Password'
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
