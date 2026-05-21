'use client'

import { createErrorBoundary } from '@/components/error-boundary'

const LandingError = createErrorBoundary({
  loggerName: 'LandingErrorBoundary',
  logPrefix: 'Landing page error:',
  title: 'Something went wrong',
  message: 'We encountered an unexpected error loading this page. Please try again.',
  variant: 'theme',
})

export default LandingError
