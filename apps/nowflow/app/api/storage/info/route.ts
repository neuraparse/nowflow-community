import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { StorageLimitService } from '@/lib/storage/storage-limit-service'

const logger = createLogger('StorageInfoAPI')

export const dynamic = 'force-dynamic'

/**
 * GET - Get storage information for workspace
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    const storageService = new StorageLimitService(session.user.id, workspaceId || undefined)

    const storageInfo = await storageService.getStorageInfo()

    return NextResponse.json({
      success: true,
      storage: storageInfo,
    })
  } catch (error: any) {
    logger.error('Failed to get storage info', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
