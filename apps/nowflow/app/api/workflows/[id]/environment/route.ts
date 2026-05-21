import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { decryptSecret } from '@/lib/utils'
import { db } from '@/db'
import { environment } from '@/db/schema'
import { validateWorkflowAccess } from '../../middleware'

const logger = createLogger('WorkflowEnvironmentAPI')

// GET /api/workflows/[id]/environment - Get environment variables for workflow execution
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const { id } = await params

  try {
    logger.debug(`[${requestId}] Environment variables request for workflow: ${id}`)

    // Validate workflow access using API key
    const validation = await validateWorkflowAccess(request, id)
    if (validation.error) {
      logger.warn(`[${requestId}] Workflow access validation failed: ${validation.error.message}`)
      return NextResponse.json(
        { error: validation.error.message },
        { status: validation.error.status }
      )
    }

    const workflow = validation.workflow

    // Get user's environment variables
    const [userEnv] = await db
      .select()
      .from(environment)
      .where(eq(environment.userId, workflow.userId))
      .limit(1)

    if (!userEnv || !userEnv.variables) {
      logger.info(`[${requestId}] No environment variables found for user: ${workflow.userId}`)
      return NextResponse.json({
        success: true,
        variables: {},
        message: 'No environment variables configured',
      })
    }

    // Decrypt environment variables
    const encryptedVariables = userEnv.variables as Record<string, string>
    const decryptedVariables: Record<string, string> = {}

    for (const [key, encryptedValue] of Object.entries(encryptedVariables)) {
      try {
        const { decrypted } = await decryptSecret(encryptedValue)
        decryptedVariables[key] = decrypted
      } catch (error) {
        logger.error(`[${requestId}] Error decrypting variable ${key}`, error)
        // Skip failed decryptions
      }
    }

    logger.info(
      `[${requestId}] Retrieved ${Object.keys(decryptedVariables).length} environment variables`
    )

    return NextResponse.json({
      success: true,
      variables: decryptedVariables,
      count: Object.keys(decryptedVariables).length,
    })
  } catch (error: any) {
    logger.error(`[${requestId}] Error fetching environment variables`, error)
    return NextResponse.json({ error: 'Failed to fetch environment variables' }, { status: 500 })
  }
}

// POST /api/workflows/[id]/environment - Set environment variables for workflow
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const { id } = await params

  try {
    logger.debug(`[${requestId}] Setting environment variables for workflow: ${id}`)

    // Validate workflow access using API key
    const validation = await validateWorkflowAccess(request, id)
    if (validation.error) {
      logger.warn(`[${requestId}] Workflow access validation failed: ${validation.error.message}`)
      return NextResponse.json(
        { error: validation.error.message },
        { status: validation.error.status }
      )
    }

    const workflow = validation.workflow
    const body = await request.json()

    if (!body.variables || typeof body.variables !== 'object') {
      return NextResponse.json({ error: 'Variables object is required' }, { status: 400 })
    }

    // For API access, we'll create default environment variables if none exist
    const defaultVariables = {
      WORKFLOW_ID: id,
      API_ACCESS: 'true',
      EXECUTION_MODE: 'api',
      ...body.variables,
    }

    logger.info(
      `[${requestId}] Setting ${Object.keys(defaultVariables).length} environment variables`
    )

    return NextResponse.json({
      success: true,
      message: 'Environment variables would be set (demo mode)',
      variables: Object.keys(defaultVariables),
      count: Object.keys(defaultVariables).length,
    })
  } catch (error: any) {
    logger.error(`[${requestId}] Error setting environment variables`, error)
    return NextResponse.json({ error: 'Failed to set environment variables' }, { status: 500 })
  }
}
