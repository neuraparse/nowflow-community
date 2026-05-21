'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
  }
}

export function Analytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')

      // Track page view
      window.gtag('config', process.env.NEXT_PUBLIC_GA_ID || '', {
        page_path: url,
      })
    }
  }, [pathname, searchParams])

  return null
}

// Custom event tracking
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

// Track CTA clicks
export const trackCTAClick = (ctaName: string, location: string) => {
  trackEvent('cta_click', 'engagement', `${ctaName} - ${location}`)
}

// Track form submissions
export const trackFormSubmission = (formName: string, success: boolean) => {
  trackEvent('form_submission', 'conversion', formName, success ? 1 : 0)
}

// Track feature interactions
export const trackFeatureInteraction = (featureName: string, action: string) => {
  trackEvent('feature_interaction', 'engagement', `${featureName} - ${action}`)
}

// Track scroll depth
export const useScrollTracking = () => {
  useEffect(() => {
    let maxScroll = 0
    const milestones = [25, 50, 75, 100]
    const tracked = new Set<number>()
    let rafId = 0

    const handleScroll = () => {
      rafId = 0
      const scrollPercentage = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )

      if (scrollPercentage > maxScroll) {
        maxScroll = scrollPercentage

        milestones.forEach((milestone) => {
          if (scrollPercentage >= milestone && !tracked.has(milestone)) {
            tracked.add(milestone)
            trackEvent('scroll_depth', 'engagement', `${milestone}%`, milestone)
          }
        })
      }
    }

    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(handleScroll)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [])
}

// Track time on page
export const useTimeTracking = () => {
  useEffect(() => {
    const startTime = Date.now()

    const trackTimeSpent = () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      trackEvent('time_on_page', 'engagement', 'seconds', timeSpent)
    }

    const handlePageHide = () => {
      trackTimeSpent()
    }

    window.addEventListener('pagehide', handlePageHide)

    const interval = setInterval(() => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      trackEvent('time_milestone', 'engagement', `${timeSpent}s`, timeSpent)
    }, 30000)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      clearInterval(interval)
    }
  }, [])
}
