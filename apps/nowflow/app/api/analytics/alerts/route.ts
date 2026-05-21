import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  createAlert,
  deleteAlert,
  getAlertEvents,
  getUserAlerts,
  updateAlert,
} from '@/lib/analytics/alert-processor'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('AlertsAPI')

/**
 * GET /api/analytics/alerts
 * List alerts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeEvents = searchParams.get('includeEvents') === 'true'

    const alerts = await getUserAlerts(session.user.id)

    let events = null
    if (includeEvents) {
      const eventResult = await getAlertEvents(session.user.id, { limit: 100 })
      events = eventResult.events
    }

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        events,
      },
    })
  } catch (error) {
    logger.error('Failed to get alerts', { error })
    return NextResponse.json({ error: 'Failed to get alerts' }, { status: 500 })
  }
}

/**
 * POST /api/analytics/alerts
 * Create a new alert
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const alert = await createAlert(session.user.id, {
      workflowId: body.workflowId,
      name: body.name,
      description: body.description,
      metric: body.metric,
      operator: body.operator,
      threshold: body.threshold,
      windowMinutes: body.windowMinutes,
      notificationChannels: body.notificationChannels,
      webhookUrl: body.webhookUrl,
      slackWebhookUrl: body.slackWebhookUrl,
      cooldownMinutes: body.cooldownMinutes,
    })

    return NextResponse.json({
      success: true,
      data: alert,
    })
  } catch (error) {
    logger.error('Failed to create alert', { error })
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }
}

/**
 * PATCH /api/analytics/alerts
 * Update an alert
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
    }

    await updateAlert(body.id, {
      name: body.name,
      description: body.description,
      isEnabled: body.isEnabled,
      metric: body.metric,
      operator: body.operator,
      threshold: body.threshold,
      windowMinutes: body.windowMinutes,
      notificationChannels: body.notificationChannels,
      webhookUrl: body.webhookUrl,
      slackWebhookUrl: body.slackWebhookUrl,
      cooldownMinutes: body.cooldownMinutes,
    })

    return NextResponse.json({
      success: true,
      message: 'Alert updated',
    })
  } catch (error) {
    logger.error('Failed to update alert', { error })
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}

/**
 * DELETE /api/analytics/alerts
 * Delete an alert
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const alertId = searchParams.get('id')

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
    }

    await deleteAlert(alertId)

    return NextResponse.json({
      success: true,
      message: 'Alert deleted',
    })
  } catch (error) {
    logger.error('Failed to delete alert', { error })
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 })
  }
}
