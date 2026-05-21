import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  completeExperiment,
  getExperiment,
  getExperimentAnalysis,
  getExperimentResults,
  pauseExperiment,
  startExperiment,
} from '@/lib/experiments/experiment-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ExperimentAPI')

/**
 * GET /api/workflows/[id]/experiments/[experimentId]
 * Get a specific experiment with results and statistical analysis
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; experimentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { experimentId } = await params

    // Check if analysis view is requested
    const { searchParams } = new URL(request.url)
    const includeAnalysis = searchParams.get('analysis') === 'true'

    if (includeAnalysis) {
      // Return full statistical analysis
      const analysis = await getExperimentAnalysis(experimentId)

      if (!analysis.experiment) {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: {
          experiment: analysis.experiment,
          summary: analysis.summary,
          significance: analysis.significance,
          recommendedWinner: analysis.recommendedWinner,
        },
      })
    }

    // Standard experiment details
    const experiment = await getExperiment(experimentId)

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    const { results, summary } = await getExperimentResults(experimentId)

    return NextResponse.json({
      success: true,
      data: {
        experiment,
        results,
        summary,
      },
    })
  } catch (error) {
    logger.error('Failed to get experiment', { error })
    return NextResponse.json({ error: 'Failed to get experiment' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/experiments/[experimentId]
 * Control experiment (start, pause, complete)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; experimentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { experimentId } = await params
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'start':
        await startExperiment(experimentId)
        break
      case 'pause':
        await pauseExperiment(experimentId)
        break
      case 'complete':
        await completeExperiment(experimentId, body.winnerVariantId)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use start, pause, or complete' },
          { status: 400 }
        )
    }

    const experiment = await getExperiment(experimentId)

    return NextResponse.json({
      success: true,
      data: experiment,
      message: `Experiment ${action}ed successfully`,
    })
  } catch (error) {
    logger.error('Failed to control experiment', { error })
    return NextResponse.json({ error: 'Failed to control experiment' }, { status: 500 })
  }
}
