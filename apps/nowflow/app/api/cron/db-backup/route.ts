import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createSavedBackup } from '@/lib/database/backup-service'
import { createLogger } from '@/lib/logs/console-logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const logger = createLogger('CronDbBackupAPI')

function requireCronSecret(request: NextRequest): string | null {
  const expected = process.env.DB_BACKUP_CRON_SECRET
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

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.DB_BACKUP_CRON_SECRET
    if (!expected) {
      return NextResponse.json(
        { error: 'Cron secret not configured', details: 'Set DB_BACKUP_CRON_SECRET' },
        { status: 500 }
      )
    }

    if (!requireCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await createSavedBackup()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    logger.error('Cron DB backup failed:', error)
    return NextResponse.json(
      { error: 'Backup failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
