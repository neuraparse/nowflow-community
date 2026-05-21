'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Turnstile, TURNSTILE_SITE_KEY } from '@/components/ui/turnstile'
import { client } from '@/lib/auth-client'
import { markUserLoggedIn } from '@/lib/auth/client-utils'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notifications/store'
import { AuthNotificationList } from '@/app/(auth)/components/auth-notification-list'
import {
  AnimatedBorderCard,
  AuthCardBadge,
  AuthFormDivider,
} from '@/app/(auth)/components/auth-primitives'
import { AuthShell } from '@/app/(auth)/components/auth-shell'
import { SocialLoginButtons } from '@/app/(auth)/components/social-login-buttons'

export default function LoginPage({
  githubAvailable,
  googleAvailable,
  isProduction,
}: {
  githubAvailable: boolean
  googleAvailable: boolean
  isProduction: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const { addNotification } = useNotificationStore()
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRequired = Boolean(TURNSTILE_SITE_KEY)
  const hasShownQueryMessages = useRef(false)

  useEffect(() => {
    // Clear stale auth error notifications from previous sessions
    // Only clear 'error' type to preserve intentional info messages (resetSuccess, fromLogout)
    const { notifications, hideNotification } = useNotificationStore.getState()
    notifications.forEach((n) => {
      if (n.options?.context === 'auth' && n.isVisible && n.type === 'error') {
        hideNotification(n.id)
      }
    })

    if (hasShownQueryMessages.current) return
    hasShownQueryMessages.current = true

    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }

    if (searchParams.get('setupComplete') === 'true') {
      addNotification('info', 'Initial account created. Sign in to open your workspace.', null, {
        context: 'auth',
      })
    }

    if (searchParams.get('resetSuccess') === 'true') {
      addNotification('info', 'Password reset successful. Please sign in.', null, {
        context: 'auth',
      })
    }

    if (searchParams.get('fromLogout') === 'true') {
      addNotification('info', 'You have been signed out.', null, { context: 'auth' })
    }
  }, [addNotification, searchParams])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    if (captchaRequired && !captchaToken) {
      addNotification('error', 'Please complete the verification challenge.', null, {
        context: 'auth',
      })
      setIsLoading(false)
      return
    }

    try {
      const result = await client.signIn.email(
        {
          email,
          password,
          callbackURL: '/w',
        },
        {
          ...(captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : {}),
          onError: (ctx) => {
            console.error('Login error:', ctx.error)
            let errorMessage = 'Invalid email or password'

            // Handle all possible error cases from Better Auth
            if (ctx.error.message?.includes('EMAIL_NOT_VERIFIED')) {
              return
            } else if (
              ctx.error.message?.includes('BAD_REQUEST') ||
              ctx.error.message?.includes('Email and password sign in is not enabled')
            ) {
              errorMessage = 'Email sign in is currently disabled.'
            } else if (
              ctx.error.message?.includes('INVALID_CREDENTIALS') ||
              ctx.error.message?.includes('invalid password')
            ) {
              errorMessage = 'Invalid email or password. Please try again.'
            } else if (
              ctx.error.message?.includes('USER_NOT_FOUND') ||
              ctx.error.message?.includes('not found')
            ) {
              errorMessage = 'No account found with this email. Please sign up first.'
            } else if (ctx.error.message?.includes('MISSING_CREDENTIALS')) {
              errorMessage = 'Please enter both email and password.'
            } else if (ctx.error.message?.includes('EMAIL_PASSWORD_DISABLED')) {
              errorMessage = 'Email and password login is disabled.'
            } else if (ctx.error.message?.includes('FAILED_TO_CREATE_SESSION')) {
              errorMessage = 'Failed to create session. Please try again later.'
            } else if (ctx.error.message?.includes('too many attempts')) {
              errorMessage =
                'Too many login attempts. Please try again later or reset your password.'
            } else if (ctx.error.message?.includes('account locked')) {
              errorMessage =
                'Your account has been locked for security. Please reset your password.'
            } else if (ctx.error.message?.includes('network')) {
              errorMessage = 'Network error. Please check your connection and try again.'
            } else if (ctx.error.message?.includes('rate limit')) {
              errorMessage = 'Too many requests. Please wait a moment before trying again.'
            }

            addNotification('error', errorMessage, null, { context: 'auth' })
          },
        }
      )

      if (result?.error?.message?.includes('EMAIL_NOT_VERIFIED')) {
        try {
          await client.emailOtp.sendVerificationOtp({
            email,
            type: 'email-verification',
          })

          if (typeof window !== 'undefined') {
            sessionStorage.setItem('verificationEmail', email)
          }

          router.push('/verify')
          return
        } catch {
          addNotification(
            'error',
            'Failed to send verification code. Please try again later.',
            null,
            { context: 'auth' }
          )
          setIsLoading(false)
          return
        }
      }

      if (!result || result.error) {
        setIsLoading(false)
        return
      }

      markUserLoggedIn()

      // Login successful, redirect to workspace
      console.log('Login successful, redirecting to /w')
      router.push('/w')
    } catch (err: any) {
      // Handle only the special verification case that requires a redirect
      if (err.message?.includes('not verified') || err.message?.includes('EMAIL_NOT_VERIFIED')) {
        try {
          await client.emailOtp.sendVerificationOtp({
            email,
            type: 'email-verification',
          })

          if (typeof window !== 'undefined') {
            sessionStorage.setItem('verificationEmail', email)
          }

          router.push(`/verify`)
          return
        } catch {
          addNotification(
            'error',
            'Failed to send verification code. Please try again later.',
            null,
            {
              context: 'auth',
            }
          )
          setIsLoading(false)
          return
        }
      }

      console.error('Uncaught login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthNotificationList />

      <AnimatedBorderCard>
        <Card className="silver-glass-panel relative z-10 w-full rounded-[25px] border-black/[0.06] bg-transparent shadow-[0_24px_64px_rgba(24,24,27,0.08)] dark:border-white/[0.1] dark:shadow-[0_28px_72px_rgba(0,0,0,0.28)]">
          <CardHeader className="pb-4 pt-7 text-center sm:pt-8">
            <AuthCardBadge label="Return To Workspace" />
            <CardTitle className="font-heading text-[24px] font-semibold tracking-[-0.035em] text-zinc-800 dark:text-white">
              Welcome back
            </CardTitle>
            <CardDescription className="font-body mt-2 text-[13px] text-zinc-400 dark:text-white/30">
              Sign in to continue to your workspace
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8 pt-4 sm:px-8">
            <div className="space-y-6">
              <SocialLoginButtons
                githubAvailable={githubAvailable}
                googleAvailable={googleAvailable}
                callbackURL="/w"
                isProduction={isProduction}
              />

              <AuthFormDivider />

              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30"
                    >
                      Email address
                    </Label>
                    <div className="group relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300 dark:text-white/15 group-focus-within:text-zinc-500 dark:group-focus-within:text-white/40 transition-colors duration-200" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(
                          'h-12 rounded-xl border border-black/[0.06] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] pl-11 pr-4 text-[14px] font-body text-zinc-800 dark:text-white shadow-none',
                          'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                          'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                          'transition-all duration-200'
                        )}
                        placeholder="name@company.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30"
                    >
                      Password
                    </Label>
                    <div className="group relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300 dark:text-white/15 group-focus-within:text-zinc-500 dark:group-focus-within:text-white/40 transition-colors duration-200" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={cn(
                          'h-12 rounded-xl border border-black/[0.06] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] pl-11 pr-12 text-[14px] font-body text-zinc-800 dark:text-white shadow-none',
                          'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                          'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                          'transition-all duration-200'
                        )}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-300 dark:text-white/15 transition-colors duration-200 hover:text-zinc-500 dark:hover:text-white/40 focus-visible:outline-none"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      href={
                        email
                          ? `/forgot-password?email=${encodeURIComponent(email)}`
                          : '/forgot-password'
                      }
                      className="font-body text-[12px] font-medium text-zinc-400 transition-colors duration-200 hover:text-[#4A7A68] dark:text-white/25 dark:hover:text-[#8CB09C]"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {captchaRequired && (
                  <Turnstile
                    siteKey={TURNSTILE_SITE_KEY}
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken('')}
                    onError={() => setCaptchaToken('')}
                  />
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
                    type="submit"
                    className={cn(
                      'silver-glass-button-strong relative z-10 h-12 w-full rounded-xl text-[11px] font-tech font-semibold uppercase tracking-[0.15em] text-zinc-900 dark:text-black',
                      'active:scale-[0.99] disabled:opacity-60 transition-all duration-200'
                    )}
                    disabled={isLoading || (captchaRequired && !captchaToken)}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent dark:border-black/85 dark:border-t-transparent" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>

          <CardFooter className="border-t border-black/[0.06] pb-6 pt-6 dark:border-white/[0.06]">
            <div className="w-full text-center">
              <p className="font-body text-[13px] text-zinc-400 dark:text-white/25">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className="font-body font-semibold text-zinc-700 transition-colors duration-200 hover:text-[#4A7A68] dark:text-white/60 dark:hover:text-[#8CB09C]"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </AnimatedBorderCard>

      <p className="font-tech mt-6 text-center text-[11px] tracking-wide text-zinc-400/90 dark:text-white/25">
        Protected by workspace security controls
      </p>
    </AuthShell>
  )
}
