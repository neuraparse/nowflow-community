import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { evalRun, evalSuite } from '@/db/schema'

const logger = createLogger('EvalsAPI')

/**
 * GET /api/evals - List eval suites for a workflow
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workflowId = searchParams.get('workflowId')

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }

    const suites = await db
      .select()
      .from(evalSuite)
      .where(and(eq(evalSuite.userId, session.user.id), eq(evalSuite.workflowId, workflowId)))
      .orderBy(desc(evalSuite.updatedAt))

    // Get latest run for each suite
    const suitesWithRuns = await Promise.all(
      suites.map(async (suite: any) => {
        const [latestRun] = await db
          .select()
          .from(evalRun)
          .where(eq(evalRun.suiteId, suite.id))
          .orderBy(desc(evalRun.createdAt))
          .limit(1)

        return {
          ...suite,
          latestRun: latestRun || null,
          testCaseCount: (suite.testCases as any[])?.length || 0,
        }
      })
    )

    return NextResponse.json({ suites: suitesWithRuns })
  } catch (error) {
    logger.error('Error fetching eval suites:', error)
    return NextResponse.json({ error: 'Failed to fetch evals' }, { status: 500 })
  }
}

/**
 * POST /api/evals - Create an eval suite
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workflowId, name, description, testCases, scoringConfig } = await req.json()

    if (!workflowId || !name) {
      return NextResponse.json({ error: 'Workflow ID and name are required' }, { status: 400 })
    }

    const suiteId = crypto.randomUUID()
    const now = new Date()

    await db.insert(evalSuite).values({
      id: suiteId,
      userId: session.user.id,
      workflowId,
      name,
      description: description || null,
      testCases: testCases || [],
      scoringConfig: scoringConfig || {
        metrics: ['accuracy', 'relevance', 'consistency'],
      },
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ suite: { id: suiteId, name, workflowId } })
  } catch (error) {
    logger.error('Error creating eval suite:', error)
    return NextResponse.json({ error: 'Failed to create eval suite' }, { status: 500 })
  }
}

/**
 * DELETE /api/evals - Delete an eval suite
 */
export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const suiteId = searchParams.get('id')

    if (!suiteId) {
      return NextResponse.json({ error: 'Suite ID is required' }, { status: 400 })
    }

    // Verify ownership
    const [suite] = await db
      .select()
      .from(evalSuite)
      .where(and(eq(evalSuite.id, suiteId), eq(evalSuite.userId, session.user.id)))
      .limit(1)

    if (!suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 })
    }

    await db.delete(evalSuite).where(eq(evalSuite.id, suiteId))

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting eval suite:', error)
    return NextResponse.json({ error: 'Failed to delete eval suite' }, { status: 500 })
  }
}
