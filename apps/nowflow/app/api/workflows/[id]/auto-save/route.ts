import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  getAutoSaveConfig,
  getLastAutoSaveVersion,
  updateAutoSaveConfig,
} from '@/lib/workflows/auto-save-service'

const logger = createLogger('WorkflowAutoSaveAPI')

/**
 * GET /api/workflows/[id]/auto-save
 * Get auto-save configuration for a workflow
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params

    const config = await getAutoSaveConfig(workflowId)
    const lastAutoSave = await getLastAutoSaveVersion(workflowId)

    return NextResponse.json({
      success: true,
      data: {
        config,
        lastAutoSave: lastAutoSave
          ? {
              versionNumber: lastAutoSave.versionNumber,
              createdAt: lastAutoSave.createdAt,
            }
          : null,
      },
    })
  } catch (error) {
    logger.error('Failed to get auto-save config', { error })
    return NextResponse.json({ error: 'Failed to get auto-save config' }, { status: 500 })
  }
}

/**
 * PATCH /api/workflows/[id]/auto-save
 * Update auto-save configuration
 *
 * Body:
 * - enabled: boolean (optional)
 * - intervalMinutes: number (optional, 1-60)
 * - maxAutoSaveVersions: number (optional, 1-100)
 * - significantChangeThreshold: number (optional, 1-50)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()

    // Validate inputs
    if (body.intervalMinutes !== undefined) {
      if (
        typeof body.intervalMinutes !== 'number' ||
        body.intervalMinutes < 1 ||
        body.intervalMinutes > 60
      ) {
        return NextResponse.json(
          { error: 'intervalMinutes must be a number between 1 and 60' },
          { status: 400 }
        )
      }
    }

    if (body.maxAutoSaveVersions !== undefined) {
      if (
        typeof body.maxAutoSaveVersions !== 'number' ||
        body.maxAutoSaveVersions < 1 ||
        body.maxAutoSaveVersions > 100
      ) {
        return NextResponse.json(
          { error: 'maxAutoSaveVersions must be a number between 1 and 100' },
          { status: 400 }
        )
      }
    }

    if (body.significantChangeThreshold !== undefined) {
      if (
        typeof body.significantChangeThreshold !== 'number' ||
        body.significantChangeThreshold < 1 ||
        body.significantChangeThreshold > 50
      ) {
        return NextResponse.json(
          { error: 'significantChangeThreshold must be a number between 1 and 50' },
          { status: 400 }
        )
      }
    }

    const config = await updateAutoSaveConfig(workflowId, {
      enabled: body.enabled,
      intervalMinutes: body.intervalMinutes,
      maxAutoSaveVersions: body.maxAutoSaveVersions,
      significantChangeThreshold: body.significantChangeThreshold,
    })

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error: any) {
    logger.error('Failed to update auto-save config', { error })
    return NextResponse.json(
      { error: error.message || 'Failed to update auto-save config' },
      { status: 500 }
    )
  }
}
