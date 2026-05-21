'use client'

import { useState } from 'react'
import { GithubIcon, GoogleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { client } from '@/lib/auth-client'
import { markUserLoggedIn } from '@/lib/auth/client-utils'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notifications/store'

interface SocialLoginButtonsProps {
  githubAvailable: boolean
  googleAvailable: boolean
  callbackURL?: string
  isProduction: boolean
}

export function SocialLoginButtons({
  githubAvailable,
  googleAvailable,
  callbackURL = '/w',
}: SocialLoginButtonsProps) {
  const [isGithubLoading, setIsGithubLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const { addNotification } = useNotificationStore()

  async function signInWithGithub() {
    if (!githubAvailable) return

    setIsGithubLoading(true)
    try {
      await client.signIn.social({ provider: 'github', callbackURL })
      markUserLoggedIn()
    } catch (err: any) {
      let errorMessage = 'Failed to sign in with GitHub'

      if (err.message?.includes('account exists')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.'
      } else if (err.message?.includes('cancelled')) {
        errorMessage = 'GitHub sign in was cancelled. Please try again.'
      } else if (err.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (err.message?.includes('rate limit')) {
        errorMessage = 'Too many attempts. Please try again later.'
      }

      addNotification('error', errorMessage, null, { context: 'auth' })
    } finally {
      setIsGithubLoading(false)
    }
  }

  async function signInWithGoogle() {
    if (!googleAvailable) return

    setIsGoogleLoading(true)
    try {
      await client.signIn.social({ provider: 'google', callbackURL })
      markUserLoggedIn()
    } catch (err: any) {
      let errorMessage = 'Failed to sign in with Google'

      if (err.message?.includes('account exists')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.'
      } else if (err.message?.includes('cancelled')) {
        errorMessage = 'Google sign in was cancelled. Please try again.'
      } else if (err.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (err.message?.includes('rate limit')) {
        errorMessage = 'Too many attempts. Please try again later.'
      }

      addNotification('error', errorMessage, null, { context: 'auth' })
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const githubButton = (
    <div className="group/social relative rounded-xl">
      <div
        className="absolute -inset-[1px] rounded-[13px] opacity-0 group-hover/social:opacity-30 transition-opacity duration-500"
        style={{
          background:
            'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #71717A 20%, transparent 40%, #71717A80 70%, transparent 90%)',
          animation: 'border-spin 3s linear infinite',
        }}
      />
      <Button
        variant="outline"
        className={cn(
          'silver-glass-button relative z-10 h-12 w-full rounded-xl border-black/[0.06] text-[12px] font-body font-medium text-zinc-700 dark:border-white/[0.1] dark:text-white/72 tracking-[0.01em]',
          'hover:text-zinc-900 dark:hover:text-white/90',
          'transition-all duration-200'
        )}
        disabled={!githubAvailable || isGithubLoading}
        onClick={signInWithGithub}
      >
        <GithubIcon className="mr-2.5 h-4 w-4" />
        {isGithubLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            <span>Connecting...</span>
          </div>
        ) : (
          'Continue with GitHub'
        )}
      </Button>
    </div>
  )

  const googleButton = (
    <div className="group/social relative rounded-xl">
      <div
        className="absolute -inset-[1px] rounded-[13px] opacity-0 group-hover/social:opacity-30 transition-opacity duration-500"
        style={{
          background:
            'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4285F4 20%, transparent 40%, #4285F480 70%, transparent 90%)',
          animation: 'border-spin 3s linear infinite',
        }}
      />
      <Button
        variant="outline"
        className={cn(
          'silver-glass-button relative z-10 h-12 w-full rounded-xl border-black/[0.06] text-[12px] font-body font-medium text-zinc-700 dark:border-white/[0.1] dark:text-white/72 tracking-[0.01em]',
          'hover:text-zinc-900 dark:hover:text-white/90',
          'transition-all duration-200'
        )}
        disabled={!googleAvailable || isGoogleLoading}
        onClick={signInWithGoogle}
      >
        <GoogleIcon className="mr-2.5 h-4 w-4" />
        {isGoogleLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            <span>Connecting...</span>
          </div>
        ) : (
          'Continue with Google'
        )}
      </Button>
    </div>
  )

  const renderGithubButton = () => {
    if (githubAvailable) return githubButton

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{githubButton}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-body">
              GitHub login requires OAuth credentials to be configured. Add the following
              environment variables:
            </p>
            <ul className="mt-2 space-y-1 text-xs font-body">
              <li>• GITHUB_CLIENT_ID</li>
              <li>• GITHUB_CLIENT_SECRET</li>
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const renderGoogleButton = () => {
    if (googleAvailable) return googleButton

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{googleButton}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-body">
              Google login requires OAuth credentials to be configured. Add the following
              environment variables:
            </p>
            <ul className="mt-2 space-y-1 text-xs font-body">
              <li>• GOOGLE_CLIENT_ID</li>
              <li>• GOOGLE_CLIENT_SECRET</li>
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="grid gap-3">
      {renderGoogleButton()}
      {renderGithubButton()}
    </div>
  )
}
