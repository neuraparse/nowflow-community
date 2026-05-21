'use client'

import { createErrorBoundary } from '@/components/error-boundary'

const DocsError = createErrorBoundary({
  loggerName: 'DocsErrorBoundary',
  logPrefix: 'Docs error:',
  title: 'Documentation Error',
  message: 'We had trouble loading this documentation page. Please try again.',
  variant: 'glass-dark',
})

export default DocsError
