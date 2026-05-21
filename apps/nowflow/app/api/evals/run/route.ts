import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { evalRun, evalSuite } from '@/db/schema'

const logger = createLogger('EvalRunAPI')

/**
 * POST /api/evals/run - Execute an eval suite
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { suiteId, modelConfig } = await req.json()

    if (!suiteId) {
      return NextResponse.json({ error: 'Suite ID is required' }, { status: 400 })
    }

    // Get suite
    const [suite] = await db
      .select()
      .from(evalSuite)
      .where(and(eq(evalSuite.id, suiteId), eq(evalSuite.userId, session.user.id)))
      .limit(1)

    if (!suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 })
    }

    const testCases = suite.testCases as any[]
    if (!testCases || testCases.length === 0) {
      return NextResponse.json({ error: 'No test cases in suite' }, { status: 400 })
    }

    const runId = crypto.randomUUID()
    const now = new Date()

    // Create run record
    await db.insert(evalRun).values({
      id: runId,
      suiteId,
      status: 'running',
      modelConfig: modelConfig || {},
      startedAt: now,
      createdAt: now,
    })

    // Execute test cases (simplified - in production would use workflow executor)
    const results = testCases.map((testCase, index) => ({
      testCaseIndex: index,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: null, // Would be populated by actual execution
      scores: {
        accuracy: 0,
        relevance: 0,
        consistency: 0,
      },
      latency: 0,
      tokensUsed: 0,
      status: 'pending' as const,
    }))

    // Update run with results
    await db
      .update(evalRun)
      .set({
        status: 'completed',
        results,
        summary: {
          totalTestCases: testCases.length,
          completed: 0,
          avgAccuracy: 0,
          avgRelevance: 0,
          avgConsistency: 0,
          totalTokens: 0,
          totalCost: 0,
        },
        completedAt: new Date(),
      })
      .where(eq(evalRun.id, runId))

    return NextResponse.json({
      run: {
        id: runId,
        suiteId,
        status: 'completed',
        resultCount: results.length,
      },
    })
  } catch (error) {
    logger.error('Error running eval:', error)
    return NextResponse.json({ error: 'Failed to run eval' }, { status: 500 })
  }
}
