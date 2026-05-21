import { consumeApiCallQuota } from '@/lib/api-rate-limits'
import { checkServerSideUsageLimits } from '@/lib/usage-monitor'

export class AIRequestLimitError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'AIRequestLimitError'
    this.status = status
    this.code = code
  }
}

export async function enforceAIRequestAccess(userId: string) {
  const usageCheck = await checkServerSideUsageLimits(userId)
  if (usageCheck.isExceeded) {
    throw new AIRequestLimitError(
      usageCheck.message || 'Usage limit exceeded. Please upgrade your plan to continue.',
      402,
      'USAGE_LIMIT_EXCEEDED'
    )
  }

  const quotaCheck = await consumeApiCallQuota(userId)
  if (!quotaCheck.allowed) {
    throw new AIRequestLimitError(
      quotaCheck.message || 'API call limit exceeded. Limit resets in 24 hours.',
      429,
      'API_CALL_LIMIT_EXCEEDED'
    )
  }

  return quotaCheck
}
