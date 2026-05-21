'use client'

import { Analytics, useScrollTracking, useTimeTracking } from '@/components/analytics'

export default function LandingAnalytics() {
  useScrollTracking()
  useTimeTracking()

  return <Analytics />
}
