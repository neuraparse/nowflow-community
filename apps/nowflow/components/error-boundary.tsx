'use client'

import { type ReactNode, useEffect } from 'react'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'

export type ErrorBoundaryVariant = 'glass-dark' | 'theme'

type ErrorBoundaryFactoryOptions = {
  loggerName: string
  logPrefix: string
  title: string
  message: string
  variant?: ErrorBoundaryVariant
  primaryLabel?: string
  secondaryAction?: { label: string; href: string }
  containerClassName?: string
}

type ErrorBoundaryProps = {
  error: Error & { digest?: string }
  reset: () => void
}

const VARIANT_STYLES: Record<
  ErrorBoundaryVariant,
  { outer: string; card: string; title: string; body: string; button: string }
> = {
  'glass-dark': {
    outer: 'flex min-h-dvh items-center justify-center px-4',
    card: 'silver-glass-panel w-full max-w-md space-y-6 rounded-[18px] p-6 text-center',
    title: 'text-xl font-semibold tracking-tight text-white',
    body: 'text-sm text-white/62',
    button:
      'silver-glass-button-strong inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none',
  },
  theme: {
    outer: 'flex min-h-dvh items-center justify-center bg-background px-4',
    card: 'w-full max-w-md space-y-6 text-center',
    title: 'text-xl font-semibold tracking-tight text-foreground',
    body: 'text-sm text-muted-foreground',
    button:
      'inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
}

const secondaryButtonClassName =
  'inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const createErrorBoundary = ({
  loggerName,
  logPrefix,
  title,
  message,
  variant = 'theme',
  primaryLabel = 'Try again',
  secondaryAction,
  containerClassName,
}: ErrorBoundaryFactoryOptions) => {
  const logger = createLogger(loggerName)
  const styles = VARIANT_STYLES[variant]

  const ErrorBoundary = ({ error, reset }: ErrorBoundaryProps): ReactNode => {
    useEffect(() => {
      logger.error(logPrefix, { message: error.message, digest: error.digest })
    }, [error])

    return (
      <div className={cn(styles.outer, containerClassName)}>
        <div className={styles.card}>
          <div className="space-y-2">
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.body}>{message}</p>
          </div>
          {secondaryAction ? (
            <div className="flex items-center justify-center gap-3">
              <button onClick={reset} className={styles.button}>
                {primaryLabel}
              </button>
              <a href={secondaryAction.href} className={secondaryButtonClassName}>
                {secondaryAction.label}
              </a>
            </div>
          ) : (
            <button onClick={reset} className={styles.button}>
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
    )
  }

  return ErrorBoundary
}
