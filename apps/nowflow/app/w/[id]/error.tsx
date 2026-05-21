'use client'

import { createErrorBoundary } from '@/components/error-boundary'

const WorkflowError = createErrorBoundary({
  loggerName: 'WorkflowErrorBoundary',
  logPrefix: 'Workflow error:',
  title: 'Workflow Error',
  message: 'This workflow encountered an error. Your progress has been saved — please try again.',
  variant: 'theme',
  secondaryAction: { label: 'Back to workflows', href: '/w' },
})

export default WorkflowError
