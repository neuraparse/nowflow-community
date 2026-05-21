import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getVersionTimeline } from '@/lib/workflows/version-service'

const logger = createLogger('WorkflowVersionTimelineAPI')

/**
 * GET /api/workflows/[id]/versions/timeline
 * Get timeline data for version history visualization
 *
 * Query params:
 * - limit: number (default 100, max 500)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

    const timeline = await getVersionTimeline(workflowId, { limit })

    // Group timeline entries by date for UI
    const groupedByDate: Record<string, typeof timeline> = {}
    for (const entry of timeline) {
      const dateKey = entry.createdAt.toISOString().split('T')[0]
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = []
      }
      groupedByDate[dateKey].push(entry)
    }

    // Create sorted date groups
    const dateGroups = Object.entries(groupedByDate)
      .sort(([a], [b]) => b.localeCompare(a)) // Newest first
      .map(([date, entries]) => ({
        date,
        entries,
        deployCount: entries.filter((e) => e.changeType === 'deploy').length,
        pinnedCount: entries.filter((e) => e.isPinned).length,
      }))

    // Calculate stats
    const stats = {
      totalVersions: timeline.length,
      deployments: timeline.filter((e) => e.changeType === 'deploy').length,
      pinnedVersions: timeline.filter((e) => e.isPinned).length,
      autoSaves: timeline.filter((e) => e.changeType === 'auto_save').length,
      manualSaves: timeline.filter((e) => e.changeType === 'update').length,
    }

    return NextResponse.json({
      success: true,
      data: {
        timeline,
        dateGroups,
        stats,
      },
    })
  } catch (error) {
    logger.error('Failed to get version timeline', { error })
    return NextResponse.json({ error: 'Failed to get timeline' }, { status: 500 })
  }
}
