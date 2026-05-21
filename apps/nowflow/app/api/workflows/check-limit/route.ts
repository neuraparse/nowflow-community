import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { canCreateWorkflow } from '@/lib/workflow-limits'

const logger = createLogger('WorkflowCheckLimitAPI')

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Check if user can create a new workflow
    const { allowed, currentCount, limit, message } = await canCreateWorkflow(userId)

    if (!allowed) {
      logger.warn(`User ${userId} has reached workflow limit`, {
        currentCount,
        limit,
      })
      return NextResponse.json(
        {
          error: 'Workflow limit exceeded',
          message: message || `Workflow limit reached (${currentCount}/${limit})`,
          currentCount,
          limit,
        },
        { status: 429 }
      )
    }

    return NextResponse.json({
      allowed: true,
      currentCount,
      limit,
    })
  } catch (error) {
    logger.error('Error checking workflow limit:', error)
    return NextResponse.json({ error: 'Failed to check workflow limit' }, { status: 500 })
  }
}
