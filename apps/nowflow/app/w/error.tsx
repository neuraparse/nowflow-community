'use client'

import { createErrorBoundary } from '@/components/error-boundary'

const WorkspaceError = createErrorBoundary({
  loggerName: 'WorkspaceErrorBoundary',
  logPrefix: 'Workspace error:',
  title: 'Workspace Error',
  message: 'Something went wrong loading your workspace. Your data is safe — please try again.',
  variant: 'theme',
})

export default WorkspaceError
