import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createExperiment, getExperiments } from '@/lib/experiments/experiment-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ExperimentsAPI')

/**
 * GET /api/workflows/[id]/experiments
 * List all experiments for a workflow
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const experiments = await getExperiments(workflowId)

    return NextResponse.json({
      success: true,
      data: experiments,
    })
  } catch (error) {
    logger.error('Failed to get experiments', { error })
    return NextResponse.json({ error: 'Failed to get experiments' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/experiments
 * Create a new experiment
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()

    const experiment = await createExperiment(workflowId, session.user.id, {
      name: body.name,
      description: body.description,
      variants: body.variants,
      trafficSplit: body.trafficSplit,
      metrics: body.metrics,
      targetSampleSize: body.targetSampleSize,
    })

    return NextResponse.json({
      success: true,
      data: experiment,
    })
  } catch (error) {
    logger.error('Failed to create experiment', { error })
    return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 })
  }
}
