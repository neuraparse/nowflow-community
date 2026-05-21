'use client'

import { createErrorBoundary } from '@/components/error-boundary'

const AuthError = createErrorBoundary({
  loggerName: 'AuthErrorBoundary',
  logPrefix: 'Auth error:',
  title: 'Authentication Error',
  message: 'Something went wrong during authentication. Please try again.',
  variant: 'glass-dark',
  containerClassName: 'community-ui-landing community-ui-auth bg-[#04070a] text-white',
})

export default AuthError
