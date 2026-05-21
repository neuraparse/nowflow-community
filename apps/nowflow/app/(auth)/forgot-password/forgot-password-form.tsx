'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Turnstile, TURNSTILE_SITE_KEY } from '@/components/ui/turnstile'
import { createLogger } from '@/lib/logs/console-logger'
import { AuthNotificationList } from '@/app/(auth)/components/auth-notification-list'
import { AuthShell } from '@/app/(auth)/components/auth-shell'
import { RequestResetForm } from '@/app/(auth)/components/reset-password-form'

const logger = createLogger('ForgotPasswordForm')

export default function ForgotPasswordForm({ initialEmail }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRequired = Boolean(TURNSTILE_SITE_KEY)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  })

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail)
  }, [initialEmail])

  const handleRequestReset = async (emailAddress: string) => {
    if (!emailAddress) {
      setStatus({ type: 'error', message: 'Please enter your email address.' })
      return
    }

    if (captchaRequired && !captchaToken) {
      setStatus({ type: 'error', message: 'Please complete the verification challenge.' })
      return
    }

    try {
      setIsSubmitting(true)
      setStatus({ type: null, message: '' })

      const response = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(captchaToken ? { 'x-captcha-response': captchaToken } : {}),
        },
        body: JSON.stringify({
          email: emailAddress,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to request password reset')
      }

      setStatus({
        type: 'success',
        message: 'Password reset link sent. Please check your inbox.',
      })
    } catch (error) {
      logger.error('Error requesting password reset:', { error })
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to request password reset',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <AuthNotificationList />

      {/* Card with rotating border */}
      <div className="relative rounded-[26px]">
        <div
          className="absolute -inset-[1px] rounded-[26px] opacity-30"
          style={{
            background:
              'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 45%, #4A7A6860 70%, transparent 100%)',
            animation: 'border-spin 10s linear infinite',
          }}
        />
        <Card className="silver-glass-panel relative z-10 w-full rounded-[25px] border-white/70 dark:border-white/[0.1] bg-transparent shadow-[0_24px_64px_rgba(24,24,27,0.1)] dark:shadow-[0_28px_72px_rgba(0,0,0,0.28)]">
          <CardHeader className="text-center pb-4 pt-7 sm:pt-8">
            {/* Decorative icon with rotating border */}
            <div className="mx-auto relative w-16 h-16 mb-5">
              <div
                className="absolute -inset-[1px] rounded-[17px] opacity-40"
                style={{
                  background:
                    'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 40%, #4A7A6880 70%, transparent 90%)',
                  animation: 'border-spin 4s linear infinite',
                }}
              />
              <div
                className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(74,122,104,0.15), rgba(74,122,104,0.05))',
                  boxShadow: 'inset 0 1px 0 rgba(74,122,104,0.1), 0 0 0 1px rgba(74,122,104,0.1)',
                }}
              >
                <svg
                  className="w-7 h-7 text-[#4A7A68] dark:text-[#8CB09C]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
            </div>
            <div className="mb-4 flex justify-center">
              <div className="silver-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4A7A68] dark:bg-[#8CB09C]" />
                <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/35">
                  Recovery Flow
                </span>
              </div>
            </div>
            <CardTitle className="font-heading text-[24px] font-semibold tracking-[-0.035em] text-zinc-800 dark:text-white">
              Reset your password
            </CardTitle>
            <CardDescription className="font-body mt-2 text-[13px] text-zinc-400 dark:text-white/30">
              We&apos;ll send a reset link to your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 pt-4 sm:px-8">
            <RequestResetForm
              email={email}
              onEmailChange={setEmail}
              onSubmit={handleRequestReset}
              isSubmitting={isSubmitting}
              statusType={status.type}
              statusMessage={status.message}
              submitDisabled={captchaRequired && !captchaToken}
            >
              {captchaRequired && (
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                  onError={() => setCaptchaToken('')}
                />
              )}
            </RequestResetForm>
          </CardContent>
          <CardFooter className="border-t border-black/[0.06] dark:border-white/[0.06] pb-6 pt-6">
            <div className="w-full text-center">
              <Link
                href="/login"
                className="font-body text-[13px] font-medium text-zinc-400 transition-colors duration-200 hover:text-[#4A7A68] dark:text-white/25 dark:hover:text-[#8CB09C]"
              >
                Back to login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </AuthShell>
  )
}
