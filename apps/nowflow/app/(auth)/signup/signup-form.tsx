'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
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
import { createLogger } from '@/lib/logs/console-logger'
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

const logger = createLogger('signup-form')

const PASSWORD_VALIDATIONS = {
  minLength: { regex: /.{8,}/, message: 'Password must be at least 8 characters long.' },
  uppercase: {
    regex: /(?=.*?[A-Z])/,
    message: 'Password must include at least one uppercase letter.',
  },
  lowercase: {
    regex: /(?=.*?[a-z])/,
    message: 'Password must include at least one lowercase letter.',
  },
  number: { regex: /(?=.*?[0-9])/, message: 'Password must include at least one number.' },
  special: {
    regex: /(?=.*?[#?!@$%^&*-])/,
    message: 'Password must include at least one special character.',
  },
}

function SignupFormContent({
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
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [showValidationError, setShowValidationError] = useState(false)
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRequired = Boolean(TURNSTILE_SITE_KEY)

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }

    // Check for waitlist token
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      // Verify the token and get the email
      verifyWaitlistToken(tokenParam)
    }
  }, [searchParams])

  // Verify waitlist token and pre-fill email
  const verifyWaitlistToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify-waitlist-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (data.success && data.email) {
        setEmail(data.email)
      }
    } catch (error) {
      logger.error('Error verifying waitlist token:', error)
      // Continue regardless of errors - we don't want to block sign up
    }
  }

  // Validate password and return array of error messages
  const validatePassword = (passwordValue: string): string[] => {
    const errors: string[] = []

    // Check each validation criteria
    if (!PASSWORD_VALIDATIONS.minLength.regex.test(passwordValue)) {
      errors.push(PASSWORD_VALIDATIONS.minLength.message)
    }

    if (!PASSWORD_VALIDATIONS.uppercase.regex.test(passwordValue)) {
      errors.push(PASSWORD_VALIDATIONS.uppercase.message)
    }

    if (!PASSWORD_VALIDATIONS.lowercase.regex.test(passwordValue)) {
      errors.push(PASSWORD_VALIDATIONS.lowercase.message)
    }

    if (!PASSWORD_VALIDATIONS.number.regex.test(passwordValue)) {
      errors.push(PASSWORD_VALIDATIONS.number.message)
    }

    if (!PASSWORD_VALIDATIONS.special.regex.test(passwordValue)) {
      errors.push(PASSWORD_VALIDATIONS.special.message)
    }

    return errors
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value
    setPassword(newPassword)

    // Silently validate but don't show errors
    validatePassword(newPassword)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const emailValue = formData.get('email') as string
    const passwordValue = formData.get('password') as string
    const name = formData.get('name') as string

    // Validate password on submit
    const errors = validatePassword(passwordValue)
    setPasswordErrors(errors)

    // Only show validation errors if there are any
    setShowValidationError(errors.length > 0)

    try {
      if (errors.length > 0) {
        // Show first error as notification
        addNotification('error', errors[0], null, { context: 'auth' })
        setIsLoading(false)
        return
      }

      if (captchaRequired && !captchaToken) {
        addNotification('error', 'Please complete the verification challenge.', null, {
          context: 'auth',
        })
        setIsLoading(false)
        return
      }

      logger.debug('Starting signup process...', { email: emailValue, name })

      const response = await client.signUp.email(
        {
          email: emailValue,
          password: passwordValue,
          name,
        },
        {
          ...(captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : {}),
          onError: (ctx) => {
            logger.error('Signup error:', ctx.error)
            let errorMessage = 'Failed to create account'

            // Handle all possible error cases from Better Auth
            if (ctx.error.status === 422 || ctx.error.message?.includes('already exists')) {
              errorMessage = 'An account with this email already exists. Please sign in instead.'
            } else if (
              ctx.error.message?.includes('BAD_REQUEST') ||
              ctx.error.message?.includes('Email and password sign up is not enabled')
            ) {
              errorMessage = 'Email signup is currently disabled.'
            } else if (ctx.error.message?.includes('INVALID_EMAIL')) {
              errorMessage = 'Please enter a valid email address.'
            } else if (ctx.error.message?.includes('PASSWORD_TOO_SHORT')) {
              errorMessage = 'Password must be at least 8 characters long.'
            } else if (ctx.error.message?.includes('PASSWORD_TOO_LONG')) {
              errorMessage = 'Password must be less than 128 characters.'
            } else if (ctx.error.message?.includes('USER_ALREADY_EXISTS')) {
              errorMessage = 'An account with this email already exists. Please sign in instead.'
            } else if (
              ctx.error.message?.includes('email provider is not supported') ||
              ctx.error.message?.includes('disposable')
            ) {
              errorMessage = 'Please use a work email — disposable providers are not allowed.'
            } else if (ctx.error.message?.includes('FAILED_TO_CREATE_USER')) {
              errorMessage = 'Failed to create account. Please try again later.'
            } else if (ctx.error.message?.includes('FAILED_TO_CREATE_SESSION')) {
              errorMessage = 'Failed to create session. Please try again later.'
            } else if (ctx.error.message?.includes('rate limit')) {
              errorMessage = 'Too many signup attempts. Please try again later.'
            } else if (ctx.error.message?.includes('network')) {
              errorMessage = 'Network error. Please check your connection and try again.'
            } else if (ctx.error.message?.includes('invalid name')) {
              errorMessage = 'Please enter a valid name.'
            }

            addNotification('error', errorMessage, null, { context: 'auth' })
          },
        }
      )

      logger.debug('Signup response:', response)

      if (!response || response.error) {
        logger.debug('Signup failed:', response?.error)
        setIsLoading(false)
        return
      }

      logger.debug('Signup successful, redirecting to verify page')

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('verificationEmail', emailValue)
      }

      router.push(`/verify?fromSignup=true`)
    } catch (err: any) {
      logger.error('Uncaught signup error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthNotificationList />

      <AnimatedBorderCard>
        <Card className="silver-glass-panel relative z-10 w-full rounded-[25px] border-black/[0.06] bg-transparent shadow-[0_24px_64px_rgba(24,24,27,0.1)] dark:border-white/[0.1] dark:shadow-[0_28px_72px_rgba(0,0,0,0.28)]">
          <CardHeader className="text-center pb-4 pt-7 sm:pt-8">
            <AuthCardBadge label="Launch Your Workspace" />
            <CardTitle className="font-heading text-[24px] font-semibold tracking-[-0.035em] text-zinc-800 dark:text-white">
              Create your account
            </CardTitle>
            <CardDescription className="font-body mt-2 text-[13px] text-zinc-400 dark:text-white/30">
              Start building with NowFlow
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
                      htmlFor="name"
                      className="font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30"
                    >
                      Full name
                    </Label>
                    <div className="group relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/15 group-focus-within:text-zinc-600 dark:group-focus-within:text-white/40 transition-colors duration-200" />
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        className={cn(
                          'h-12 rounded-xl border border-black/[0.06] dark:border-white/[0.1] dark:bg-white/[0.06] bg-white/80 pl-11 pr-4 text-[14px] font-body text-zinc-800 dark:text-white shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                          'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                          'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                          'transition-all duration-200'
                        )}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30"
                    >
                      Email address
                    </Label>
                    <div className="group relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/15 group-focus-within:text-zinc-600 dark:group-focus-within:text-white/40 transition-colors duration-200" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(
                          'h-12 rounded-xl border border-black/[0.06] dark:border-white/[0.1] dark:bg-white/[0.06] bg-white/80 pl-11 pr-4 text-[14px] font-body text-zinc-800 dark:text-white shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
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
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/15 group-focus-within:text-zinc-600 dark:group-focus-within:text-white/40 transition-colors duration-200" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={handlePasswordChange}
                        className={cn(
                          'h-12 rounded-xl border border-black/[0.06] dark:border-white/[0.1] dark:bg-white/[0.06] bg-white/80 pl-11 pr-12 text-[14px] font-body text-zinc-800 dark:text-white shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                          'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                          'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                          'transition-all duration-200'
                        )}
                        placeholder="Create a strong password"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 dark:text-white/15 transition-colors duration-200 hover:text-zinc-600 dark:hover:text-white/40 focus-visible:outline-none"
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
                    {showValidationError && passwordErrors.length > 0 && (
                      <div className="silver-glass-pane rounded-xl border border-red-200/60 bg-red-50/70 p-3 text-xs text-red-700 font-body dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
                        <p className="mb-1 font-semibold">Password requirements:</p>
                        <ul className="list-disc space-y-0.5 pl-4">
                          {passwordErrors.slice(0, 3).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      'Create account'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>

          <CardFooter className="border-t border-black/[0.06] dark:border-white/[0.06] pb-6 pt-6">
            <div className="w-full text-center">
              <p className="font-body text-[13px] text-zinc-400 dark:text-white/25">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-body font-semibold text-zinc-700 transition-colors duration-200 hover:text-[#4A7A68] dark:text-white/60 dark:hover:text-[#8CB09C]"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </AnimatedBorderCard>

      <p className="font-tech mt-6 text-center text-[11px] tracking-wide text-zinc-400/90 dark:text-white/25">
        By signing up, you agree to our Terms of Service and Privacy Policy
      </p>
    </AuthShell>
  )
}

export default function SignupPage({
  githubAvailable,
  googleAvailable,
  isProduction,
}: {
  githubAvailable: boolean
  googleAvailable: boolean
  isProduction: boolean
}) {
  return (
    <Suspense
      fallback={
        <div className="odyssey-landing community-ui-landing community-ui-auth flex min-h-screen items-center justify-center bg-[#f6f6f4] font-body dark:bg-[#0A0A0A]">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SignupFormContent
        githubAvailable={githubAvailable}
        googleAvailable={googleAvailable}
        isProduction={isProduction}
      />
    </Suspense>
  )
}
