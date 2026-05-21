import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { rolloverService } from '@/lib/billing/rollover-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('QuotaAPI')

type QuotaType = 'api_calls' | 'storage' | 'ai_credits' | 'workflows'
const VALID_QUOTA_TYPES: QuotaType[] = ['api_calls', 'storage', 'ai_credits', 'workflows']

/**
 * GET /api/billing/quota - Get current quota breakdown (base + rollover)
 *
 * Query params:
 *   type - optional quota type filter (api_calls, storage, ai_credits, workflows)
 *
 * Returns total available, base quota, rollover amount, usage, remaining.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const typeParam = searchParams.get('type') as QuotaType | null

    if (typeParam && !VALID_QUOTA_TYPES.includes(typeParam)) {
      return NextResponse.json(
        { error: `Invalid quota type. Must be one of: ${VALID_QUOTA_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const types = typeParam ? [typeParam] : VALID_QUOTA_TYPES

    const breakdowns = await Promise.all(
      types.map((qt) => rolloverService.getQuotaBreakdown(session.user.id, qt))
    )

    return NextResponse.json({
      quotas: breakdowns,
      userId: session.user.id,
    })
  } catch (error) {
    logger.error('Error fetching quota breakdown:', error)
    return NextResponse.json({ error: 'Failed to fetch quota breakdown' }, { status: 500 })
  }
}
