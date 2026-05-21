import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createLogger } from '@/lib/logs/console-logger'
import { sendDailyDigests, sendWeeklyDigests } from '@/lib/notifications/digest-scheduler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const logger = createLogger('CronDigestAPI')

function requireCronSecret(request: NextRequest): string | null {
  const expected = process.env.DIGEST_CRON_SECRET || process.env.CRON_SECRET
  if (!expected) return null

  const auth = request.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null
  const headerSecret = request.headers.get('x-cron-secret')
  const token = bearer || headerSecret
  if (!token) return null
  try {
    const a = Buffer.from(token)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b) ? token : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const expected = process.env.DIGEST_CRON_SECRET || process.env.CRON_SECRET
    if (!expected) {
      return NextResponse.json(
        { error: 'Cron secret not configured', details: 'Set DIGEST_CRON_SECRET or CRON_SECRET' },
        { status: 500 }
      )
    }

    if (!requireCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get digest type from query params (default to 'all')
    const { searchParams } = new URL(request.url)
    const digestType = searchParams.get('type') || 'all'

    logger.info('Digest cron job triggered', { digestType })

    let dailyResult = { sent: 0, failed: 0 }
    let weeklyResult = { sent: 0, failed: 0 }

    // Process daily digests
    if (digestType === 'daily' || digestType === 'all') {
      logger.info('Processing daily digests')
      dailyResult = await sendDailyDigests()
    }

    // Process weekly digests
    if (digestType === 'weekly' || digestType === 'all') {
      logger.info('Processing weekly digests')
      weeklyResult = await sendWeeklyDigests()
    }

    const totalSent = dailyResult.sent + weeklyResult.sent
    const totalFailed = dailyResult.failed + weeklyResult.failed

    logger.info('Digest cron job completed', {
      digestType,
      daily: dailyResult,
      weekly: weeklyResult,
      totalSent,
      totalFailed,
    })

    return NextResponse.json({
      success: true,
      digestType,
      daily: dailyResult,
      weekly: weeklyResult,
      summary: {
        totalSent,
        totalFailed,
      },
    })
  } catch (error) {
    logger.error('Digest cron job failed:', error)
    return NextResponse.json(
      {
        error: 'Digest processing failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
