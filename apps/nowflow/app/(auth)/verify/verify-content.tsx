'use client'

import { Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { cn } from '@/lib/utils'
import { useVerification } from './use-verification'

interface VerifyContentProps {
  hasResendKey: boolean
  isProduction: boolean
}

function VerificationForm({
  hasResendKey,
  isProduction,
}: {
  hasResendKey: boolean
  isProduction: boolean
}) {
  const {
    otp,
    email,
    isLoading,
    isVerified,
    isInvalidOtp,
    errorMessage,
    isOtpComplete,
    verifyCode,
    resendCode,
    handleOtpChange,
  } = useVerification({ hasResendKey, isProduction })

  const [countdown, setCountdown] = useState(0)
  const [isResendDisabled, setIsResendDisabled] = useState(false)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && isResendDisabled) {
      setIsResendDisabled(false)
    }
  }, [countdown, isResendDisabled])

  const handleResend = () => {
    resendCode()
    setIsResendDisabled(true)
    setCountdown(30)
  }

  return (
    <>
      <CardHeader className="text-center pb-6 pt-7 sm:pt-8">
        {/* Icon with rotating border */}
        <div className="mx-auto relative w-16 h-16 mb-5">
          <div
            className="absolute -inset-[1px] rounded-[17px] opacity-40"
            style={{
              background: isVerified
                ? 'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #10B981 20%, transparent 40%, #10B98180 70%, transparent 90%)'
                : 'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 40%, #4A7A6880 70%, transparent 90%)',
              animation: 'border-spin 4s linear infinite',
            }}
          />
          <div
            className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: isVerified
                ? 'linear-gradient(145deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))'
                : 'linear-gradient(145deg, rgba(74,122,104,0.15), rgba(74,122,104,0.05))',
              boxShadow: isVerified
                ? 'inset 0 1px 0 rgba(16,185,129,0.1), 0 0 0 1px rgba(16,185,129,0.1)'
                : 'inset 0 1px 0 rgba(74,122,104,0.1), 0 0 0 1px rgba(74,122,104,0.1)',
            }}
          >
            {isVerified ? (
              <svg
                className="w-7 h-7 text-emerald-500 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            )}
          </div>
        </div>
        <div className="mb-4 flex justify-center">
          <div className="silver-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isVerified ? 'bg-emerald-500' : 'bg-[#4A7A68] dark:bg-[#8CB09C]'
              )}
            />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/35">
              {isVerified ? 'Verified' : 'Email Check'}
            </span>
          </div>
        </div>
        <CardTitle className="font-heading text-[24px] font-semibold tracking-[-0.035em] text-zinc-800 dark:text-white">
          {isVerified ? 'Email Verified' : 'Verify your email'}
        </CardTitle>
        <CardDescription className="font-body mt-2 text-[13px] text-zinc-400 dark:text-white/30">
          {isVerified ? (
            'Your email has been verified successfully. Redirecting to your dashboard...'
          ) : (
            <p>
              We&apos;ve sent a 6-digit verification code to{' '}
              <span className="font-semibold text-zinc-600 dark:text-white/50">
                {email || 'your email'}
              </span>
            </p>
          )}
        </CardDescription>
      </CardHeader>

      {/* Add debug output for error state */}
      <div className="hidden">
        Debug - isInvalidOtp: {String(isInvalidOtp)}, errorMessage: {errorMessage || 'none'}
      </div>

      {!isVerified && (
        <CardContent className="space-y-6 px-8 pb-8">
          <p className="font-body text-center text-[12px] leading-relaxed text-zinc-400 dark:text-white/25">
            Enter the 6-digit code to verify your account. If you don&apos;t see it in your email,
            check your spam folder.
          </p>
          <div className="flex flex-col items-center space-y-4">
            <div className="flex justify-center py-2">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                disabled={isLoading}
                className={cn('gap-3', isInvalidOtp && 'border-red-500 focus-visible:ring-red-500')}
              >
                <InputOTPGroup className="gap-2.5">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="silver-glass-pane font-heading w-12 h-14 rounded-xl border-white/60 bg-transparent text-lg font-semibold text-zinc-800 focus-visible:border-[#4A7A68]/40 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 dark:border-white/[0.1] dark:text-white"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="silver-glass-pane text-center rounded-xl border border-red-200/60 dark:border-red-500/20 py-3 px-4 bg-red-50/80 dark:bg-red-950/30">
              <p className="font-body flex items-center justify-center gap-2 text-[13px] font-medium text-red-600 dark:text-red-300">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {errorMessage}
              </p>
            </div>
          )}

          {/* Verify button with rotating border */}
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
              onClick={verifyCode}
              className={cn(
                'silver-glass-button-strong relative z-10 w-full h-12 rounded-xl text-[11px] font-tech font-semibold uppercase tracking-[0.15em] text-zinc-900 dark:text-white',
                'active:scale-[0.99] disabled:opacity-60 transition-all duration-200'
              )}
              disabled={!isOtpComplete || isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent dark:border-white/85 dark:border-t-transparent" />
                  <span>Verifying...</span>
                </div>
              ) : (
                'Verify Email'
              )}
            </Button>
          </div>
        </CardContent>
      )}

      {!isVerified && (
        <CardFooter className="flex justify-center pb-6 border-t border-black/[0.06] dark:border-white/[0.06] pt-5">
          <p className="font-body text-[13px] text-zinc-400 dark:text-white/25">
            Didn&apos;t receive a code?{' '}
            {countdown > 0 ? (
              <span>
                Resend in{' '}
                <span className="font-semibold text-zinc-600 dark:text-white/50">{countdown}s</span>
              </span>
            ) : (
              <button
                className="font-body font-semibold text-zinc-600 transition-colors duration-200 hover:text-[#4A7A68] dark:text-white/50 dark:hover:text-[#8CB09C]"
                onClick={handleResend}
                disabled={isLoading || isResendDisabled}
              >
                Resend code
              </button>
            )}
          </p>
        </CardFooter>
      )}
    </>
  )
}

// Fallback component while the verification form is loading
function VerificationFormFallback() {
  return (
    <CardHeader className="text-center pb-6 pt-8">
      <div
        className="mx-auto w-16 h-16 rounded-2xl mb-5 flex items-center justify-center animate-pulse"
        style={{
          background: 'linear-gradient(145deg, rgba(74,122,104,0.15), rgba(74,122,104,0.05))',
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <CardTitle className="font-heading text-[24px] font-semibold tracking-[-0.035em] text-zinc-800 dark:text-white">
        Loading verification...
      </CardTitle>
      <CardDescription className="font-body mt-2 text-[13px] text-zinc-400 dark:text-white/30">
        Please wait while we load your verification details...
      </CardDescription>
    </CardHeader>
  )
}

export function VerifyContent({ hasResendKey, isProduction }: VerifyContentProps) {
  return (
    <div className="relative rounded-[26px]">
      <div
        className="absolute -inset-[1px] rounded-[26px] opacity-30"
        style={{
          background:
            'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 45%, #4A7A6860 70%, transparent 100%)',
          animation: 'border-spin 10s linear infinite',
        }}
      />
      <Card className="silver-glass-panel relative z-10 w-full rounded-[25px] border-white/70 dark:border-white/[0.1] bg-transparent shadow-[0_24px_64px_rgba(24,24,27,0.1)] dark:shadow-[0_28px_72px_rgba(0,0,0,0.28)] overflow-hidden">
        <Suspense fallback={<VerificationFormFallback />}>
          <VerificationForm hasResendKey={hasResendKey} isProduction={isProduction} />
        </Suspense>

        {/* Login link for already verified users */}
        <CardFooter className="flex justify-center pt-0 pb-6">
          <p className="font-body text-[13px] text-zinc-400 dark:text-white/25">
            Already verified?{' '}
            <a
              href="/login"
              className="font-body font-semibold text-zinc-600 transition-colors duration-200 hover:text-[#4A7A68] dark:text-white/50 dark:hover:text-[#8CB09C]"
            >
              Sign in to NowFlow
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
