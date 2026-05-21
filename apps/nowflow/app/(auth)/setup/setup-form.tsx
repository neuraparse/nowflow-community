'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, User, Workflow } from 'lucide-react'
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
import { getPasswordValidationErrors } from '@/lib/setup/validation'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notifications/store'
import { AuthNotificationList } from '@/app/(auth)/components/auth-notification-list'
import { AnimatedBorderCard, AuthCardBadge } from '@/app/(auth)/components/auth-primitives'
import { AuthShell } from '@/app/(auth)/components/auth-shell'

export default function SetupForm() {
  const router = useRouter()
  const { addNotification } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [workspaceName, setWorkspaceName] = useState('NowFlow Workspace')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [showValidationError, setShowValidationError] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRequired = Boolean(TURNSTILE_SITE_KEY)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const errors = getPasswordValidationErrors(password)
    if (password !== confirmPassword) {
      errors.push('Passwords must match.')
    }

    setPasswordErrors(errors)
    setShowValidationError(errors.length > 0)

    if (errors.length > 0) {
      addNotification('error', errors[0], null, { context: 'auth' })
      return
    }

    if (captchaRequired && !captchaToken) {
      addNotification('error', 'Please complete the verification challenge.', null, {
        context: 'auth',
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/setup/first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(captchaToken ? { 'x-captcha-response': captchaToken } : {}),
        },
        body: JSON.stringify({
          name,
          email,
          password,
          workspaceName,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message =
          data?.error ||
          (response.status === 409
            ? 'Initial setup has already been completed.'
            : 'Failed to complete initial setup.')

        addNotification('error', message, null, { context: 'auth' })

        if (response.status === 409) {
          router.push('/login')
        }
        return
      }

      addNotification('info', 'Initial account created. Sign in to open your workspace.', null, {
        context: 'auth',
      })

      router.push(`/login?setupComplete=true&email=${encodeURIComponent(email.trim())}`)
    } catch {
      addNotification('error', 'Network error. Please check your connection and try again.', null, {
        context: 'auth',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthNotificationList />

      <AnimatedBorderCard>
        <Card className="silver-glass-panel relative z-10 w-full rounded-[25px] border-black/[0.06] bg-transparent shadow-[0_24px_64px_rgba(24,24,27,0.1)] dark:border-white/[0.1] dark:shadow-[0_28px_72px_rgba(0,0,0,0.28)]">
          <CardHeader className="pb-4 pt-7 text-center sm:pt-8">
            <AuthCardBadge label="Community Setup" />
            <CardTitle className="font-heading text-[24px] font-semibold text-zinc-800 dark:text-white">
              Create the first account
            </CardTitle>
            <CardDescription className="font-body mt-2 text-[13px] text-zinc-400 dark:text-white/30">
              This local install needs an owner before the workspace can open.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8 pt-4 sm:px-8">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="font-tech text-[11px] font-semibold uppercase text-zinc-500 dark:text-white/30"
                  >
                    Full name
                  </Label>
                  <div className="group relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors duration-200 group-focus-within:text-zinc-600 dark:text-white/15 dark:group-focus-within:text-white/40" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={cn(
                        'h-12 rounded-xl border border-black/[0.06] bg-white/80 pl-11 pr-4 text-[14px] font-body text-zinc-800 shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                        'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                        'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                        'transition-all duration-200'
                      )}
                      placeholder="Ada Lovelace"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-tech text-[11px] font-semibold uppercase text-zinc-500 dark:text-white/30"
                  >
                    Email address
                  </Label>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors duration-200 group-focus-within:text-zinc-600 dark:text-white/15 dark:group-focus-within:text-white/40" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={cn(
                        'h-12 rounded-xl border border-black/[0.06] bg-white/80 pl-11 pr-4 text-[14px] font-body text-zinc-800 shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                        'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                        'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                        'transition-all duration-200'
                      )}
                      placeholder="owner@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="workspaceName"
                    className="font-tech text-[11px] font-semibold uppercase text-zinc-500 dark:text-white/30"
                  >
                    Workspace name
                  </Label>
                  <div className="group relative">
                    <Workflow className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors duration-200 group-focus-within:text-zinc-600 dark:text-white/15 dark:group-focus-within:text-white/40" />
                    <Input
                      id="workspaceName"
                      name="workspaceName"
                      type="text"
                      autoComplete="organization"
                      required
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      className={cn(
                        'h-12 rounded-xl border border-black/[0.06] bg-white/80 pl-11 pr-4 text-[14px] font-body text-zinc-800 shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                        'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                        'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                        'transition-all duration-200'
                      )}
                      placeholder="NowFlow Workspace"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="font-tech text-[11px] font-semibold uppercase text-zinc-500 dark:text-white/30"
                  >
                    Password
                  </Label>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors duration-200 group-focus-within:text-zinc-600 dark:text-white/15 dark:group-focus-within:text-white/40" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={cn(
                        'h-12 rounded-xl border border-black/[0.06] bg-white/80 pl-11 pr-12 text-[14px] font-body text-zinc-800 shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                        'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                        'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                        'transition-all duration-200'
                      )}
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 transition-colors duration-200 hover:text-zinc-600 focus-visible:outline-none dark:text-white/15 dark:hover:text-white/40"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="font-tech text-[11px] font-semibold uppercase text-zinc-500 dark:text-white/30"
                  >
                    Confirm password
                  </Label>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors duration-200 group-focus-within:text-zinc-600 dark:text-white/15 dark:group-focus-within:text-white/40" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={cn(
                        'h-12 rounded-xl border border-black/[0.06] bg-white/80 pl-11 pr-4 text-[14px] font-body text-zinc-800 shadow-[0_10px_24px_rgba(24,24,27,0.05)] dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                        'placeholder:text-zinc-500 dark:placeholder:text-white/20',
                        'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
                        'transition-all duration-200'
                      )}
                      placeholder="Repeat your password"
                    />
                  </div>
                </div>

                {showValidationError && passwordErrors.length > 0 && (
                  <div className="silver-glass-pane rounded-xl border border-red-200/60 bg-red-50/70 p-3 text-xs font-body text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
                    <p className="mb-1 font-semibold">Password requirements:</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {passwordErrors.slice(0, 4).map((error, index) => (
                        <li key={`${error}-${index}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {captchaRequired && (
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                  onError={() => setCaptchaToken('')}
                  action="first-run-setup"
                />
              )}

              <div className="relative rounded-xl group/submit">
                <div
                  className="absolute -inset-[1px] rounded-[13px] opacity-40 transition-opacity duration-500 group-hover/submit:opacity-70"
                  style={{
                    background:
                      'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 40%, #4A7A6880 70%, transparent 90%)',
                    animation: 'border-spin 4s linear infinite',
                  }}
                />
                <Button
                  type="submit"
                  className={cn(
                    'silver-glass-button-strong relative z-10 h-12 w-full rounded-xl text-[11px] font-tech font-semibold uppercase text-zinc-900 dark:text-black',
                    'transition-all duration-200 active:scale-[0.99] disabled:opacity-60'
                  )}
                  disabled={isLoading || (captchaRequired && !captchaToken)}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent dark:border-black/85 dark:border-t-transparent" />
                      <span>Creating workspace...</span>
                    </div>
                  ) : (
                    'Create first account'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="border-t border-black/[0.06] pb-6 pt-6 dark:border-white/[0.06]">
            <div className="w-full text-center">
              <p className="font-body text-[13px] text-zinc-400 dark:text-white/25">
                Already completed setup?{' '}
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
    </AuthShell>
  )
}
