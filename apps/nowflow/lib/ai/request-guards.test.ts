import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkServerSideUsageLimits = vi.fn()
const consumeApiCallQuota = vi.fn()

vi.mock('@/lib/usage-monitor', () => ({
  checkServerSideUsageLimits,
}))

vi.mock('@/lib/api-rate-limits', () => ({
  consumeApiCallQuota,
}))

describe('enforceAIRequestAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws a usage limit error before consuming API quota', async () => {
    checkServerSideUsageLimits.mockResolvedValue({
      isExceeded: true,
      currentUsage: 12,
      limit: 10,
      message: 'Usage limit exceeded.',
    })

    const { AIRequestLimitError, enforceAIRequestAccess } = await import('./request-guards')
    const error = await enforceAIRequestAccess('user-1').catch((caughtError) => caughtError)

    expect(error).toBeInstanceOf(AIRequestLimitError)
    expect(error).toMatchObject({
      status: 402,
      code: 'USAGE_LIMIT_EXCEEDED',
      message: 'Usage limit exceeded.',
    })
    expect(consumeApiCallQuota).not.toHaveBeenCalled()
  })

  it('throws an API call limit error when quota reservation fails', async () => {
    checkServerSideUsageLimits.mockResolvedValue({
      isExceeded: false,
      currentUsage: 4,
      limit: 10,
    })
    consumeApiCallQuota.mockResolvedValue({
      allowed: false,
      currentCalls: 20,
      limit: 20,
      message: 'Daily API limit reached.',
    })

    const { AIRequestLimitError, enforceAIRequestAccess } = await import('./request-guards')
    const error = await enforceAIRequestAccess('user-1').catch((caughtError) => caughtError)

    expect(error).toBeInstanceOf(AIRequestLimitError)
    expect(error).toMatchObject({
      status: 429,
      code: 'API_CALL_LIMIT_EXCEEDED',
      message: 'Daily API limit reached.',
    })
  })

  it('returns quota information when access is allowed', async () => {
    checkServerSideUsageLimits.mockResolvedValue({
      isExceeded: false,
      currentUsage: 1,
      limit: 10,
    })
    consumeApiCallQuota.mockResolvedValue({
      allowed: true,
      currentCalls: 2,
      limit: 20,
    })

    const { enforceAIRequestAccess } = await import('./request-guards')

    await expect(enforceAIRequestAccess('user-1')).resolves.toEqual({
      allowed: true,
      currentCalls: 2,
      limit: 20,
    })
  })
})
