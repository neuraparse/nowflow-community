'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createLogger } from '@/lib/logs/console-logger'
import { AuthShell } from '../components/auth-shell'
import { SetNewPasswordForm } from '../components/reset-password-form'

const logger = createLogger('ResetPasswordPage')

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | null
    text: string
  }>({
    type: null,
    text: '',
  })

  // Validate token presence
  useEffect(() => {
    if (!token) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid or missing reset token. Please request a new password reset link.',
      })
    }
  }, [token])

  const handleResetPassword = async (password: string) => {
    try {
      setIsSubmitting(true)
      setStatusMessage({ type: null, text: '' })

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to reset password')
      }

      setStatusMessage({
        type: 'success',
        text: 'Password reset successful! Redirecting to login...',
      })

      // Redirect to login page after 1.5 seconds
      setTimeout(() => {
        router.push('/login?resetSuccess=true')
      }, 1500)
    } catch (error) {
      logger.error('Error resetting password:', { error })
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to reset password',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>
            <div className="mb-4 flex justify-center">
              <div className="silver-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4A7A68] dark:bg-[#8CB09C]" />
                <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/35">
                  Secure Reset
                </span>
              </div>
            </div>
            <CardTitle className="font-heading text-[24px] font-semibold tracking-[-0.035em] text-zinc-800 dark:text-white">
              Choose a new password
            </CardTitle>
            <CardDescription className="font-body mt-2 text-[13px] text-zinc-400 dark:text-white/30">
              Enter a strong password to secure your account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 pt-4 sm:px-8">
            <SetNewPasswordForm
              token={token}
              onSubmit={handleResetPassword}
              isSubmitting={isSubmitting}
              statusType={statusMessage.type}
              statusMessage={statusMessage.text}
            />
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="odyssey-landing community-ui-landing community-ui-auth flex min-h-screen items-center justify-center bg-[#f6f6f4] font-body text-zinc-800 dark:bg-[#0A0A0A] dark:text-white">
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
