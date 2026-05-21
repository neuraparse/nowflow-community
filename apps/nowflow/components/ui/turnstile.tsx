'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, opts: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
      getResponse: (widgetId?: string) => string | undefined
    }
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-loader="1"]')
    if (existing) {
      const waitReady = () => {
        if (window.turnstile) resolve()
        else setTimeout(waitReady, 50)
      }
      waitReady()
      return
    }

    const script = document.createElement('script')
    script.src = TURNSTILE_SRC
    script.async = true
    script.defer = true
    script.dataset.turnstileLoader = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Cloudflare Turnstile'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

type TurnstileProps = {
  siteKey: string | undefined
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
  action?: string
  className?: string
}

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  onError,
  theme = 'auto',
  action,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const callbacksRef = useRef({ onVerify, onExpire, onError })

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError }
  }, [onVerify, onExpire, onError])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          action,
          callback: (token: string) => callbacksRef.current.onVerify(token),
          'expired-callback': () => callbacksRef.current.onExpire?.(),
          'error-callback': () => callbacksRef.current.onError?.(),
        })
      })
      .catch(() => {
        callbacksRef.current.onError?.()
      })

    return () => {
      cancelled = true
      const id = widgetIdRef.current
      if (id && typeof window !== 'undefined' && window.turnstile) {
        try {
          window.turnstile.remove(id)
        } catch {
          // widget may have already been detached
        }
      }
      widgetIdRef.current = null
    }
  }, [siteKey, theme, action])

  if (!siteKey) return null
  return <div ref={containerRef} className={className ?? 'flex justify-center'} />
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
