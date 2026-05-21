import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { buildEffectiveEnvVars, resolveTemplateEnvOrThrow } from '@/lib/execution/env-vars'
import { createLogger } from '@/lib/logs/console-logger'
import { persistExecutionError, persistExecutionLogs } from '@/lib/logs/execution-logger'
import { buildTraceSpans } from '@/lib/logs/trace-spans'
import { updateWorkflowRunCounts } from '@/lib/workflows/utils'
import { WorkflowState } from '@/stores/workflows/workflow/types'
import { db } from '@/db'
import {
  dataTableRow,
  form,
  formSubmission,
  userStats,
  workflow as workflowTable,
} from '@/db/schema'
import { Executor } from '@/executor'
import { Serializer } from '@/serializer'

const logger = createLogger('FormSubmitAPI')

function serializePublicForm(existingForm: typeof form.$inferSelect) {
  return {
    id: existingForm.id,
    name: existingForm.name,
    description: existingForm.description,
    slug: existingForm.slug,
    status: existingForm.status,
    fields: Array.isArray(existingForm.fields) ? existingForm.fields : [],
    settings: {
      submitButtonText: 'Submit',
      successMessage: 'Thank you for your submission!',
      redirectUrl: '',
      theme: 'light',
      branding: true,
      ...(typeof existingForm.settings === 'object' && existingForm.settings
        ? existingForm.settings
        : {}),
    },
  }
}

/**
 * Execute a workflow triggered by a form submission.
 * Runs asynchronously — does not block the form response.
 */
async function executeFormWorkflow(
  workflowId: string,
  formData: Record<string, unknown>,
  submissionId: string,
  formId: string,
  formName: string
): Promise<void> {
  const executionId = uuidv4()

  try {
    // Fetch the workflow
    const [workflowRecord] = await db
      .select()
      .from(workflowTable)
      .where(eq(workflowTable.id, workflowId))
      .limit(1)

    if (!workflowRecord) {
      logger.error(`Workflow ${workflowId} not found for form submission ${submissionId}`)
      return
    }

    // Use deployed state if available, fall back to current state
    const workflowState = (workflowRecord.deployedState || workflowRecord.state) as WorkflowState
    if (!workflowState) {
      logger.error(`No workflow state found for workflow ${workflowId}`)
      return
    }

    const { blocks, edges, loops } = workflowState

    // Build environment variables
    const effectiveEnvVars = await buildEffectiveEnvVars({
      userId: workflowRecord.userId,
      workflowId,
      executionMode: 'api',
      extra: {
        TRIGGER_TYPE: 'form',
        FORM_ID: formId,
        FORM_NAME: formName,
        SUBMISSION_ID: submissionId,
      },
    })

    // Resolve environment variables in block states
    const currentBlockStates = await Object.entries(blocks).reduce(
      async (accPromise, [id, block]) => {
        const acc = await accPromise
        acc[id] = await Object.entries((block as any)?.subBlocks || {}).reduce(
          async (subAccPromise, [key, subBlock]) => {
            const subAcc = await subAccPromise
            let value = (subBlock as any)?.value

            if (typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
              value = resolveTemplateEnvOrThrow(value, effectiveEnvVars)
            }

            subAcc[key] = value
            return subAcc
          },
          Promise.resolve({} as Record<string, any>)
        )
        return acc
      },
      Promise.resolve({} as Record<string, Record<string, any>>)
    )

    // Process response formats
    const processedBlockStates = Object.entries(currentBlockStates).reduce(
      (acc, [blockId, blockState]) => {
        if (blockState.responseFormat && typeof blockState.responseFormat === 'string') {
          try {
            acc[blockId] = {
              ...blockState,
              responseFormat: JSON.parse(blockState.responseFormat),
            }
          } catch {
            acc[blockId] = blockState
          }
        } else {
          acc[blockId] = blockState
        }
        return acc
      },
      {} as Record<string, Record<string, any>>
    )

    // Get workflow variables
    let workflowVariables = {}
    if (workflowRecord.variables) {
      try {
        workflowVariables =
          typeof workflowRecord.variables === 'string'
            ? JSON.parse(workflowRecord.variables)
            : workflowRecord.variables
      } catch (error) {
        logger.error(`Failed to parse workflow variables for ${workflowId}`, error)
      }
    }

    // Prepare input with form submission data
    const workflowInput = {
      input: {
        formSubmissionId: submissionId,
        formId,
        formName,
        ...formData,
      },
    }

    // Serialize and execute
    const serializedWorkflow = new Serializer().serializeWorkflow(blocks, edges, loops)
    const executor = new Executor({
      workflow: serializedWorkflow,
      currentBlockStates: processedBlockStates,
      envVarValues: effectiveEnvVars,
      workflowInput,
      workflowVariables,
      workflowState,
    })

    const result = await executor.execute(workflowId)
    const executionResult = 'stream' in result && 'execution' in result ? result.execution : result

    logger.info(`Form-triggered workflow execution completed: ${workflowId}`, {
      success: executionResult.success,
      submissionId,
    })

    // Update run counts and stats on success
    if (executionResult.success) {
      await updateWorkflowRunCounts(workflowId)

      await db
        .update(userStats)
        .set({
          totalApiCalls: sql`total_api_calls + 1`,
          lastActive: new Date(),
        })
        .where(eq(userStats.userId, workflowRecord.userId))
    }

    // Build trace spans and persist logs
    const { traceSpans, totalDuration } = buildTraceSpans(executionResult)
    const enrichedResult = { ...executionResult, traceSpans, totalDuration }
    await persistExecutionLogs(workflowId, executionId, enrichedResult, 'api')

    // Update the form submission with the workflow run reference
    await db
      .update(formSubmission)
      .set({ workflowRunId: executionId })
      .where(eq(formSubmission.id, submissionId))

    logger.info(`Updated formSubmission ${submissionId} with workflowRunId ${executionId}`)
  } catch (error: any) {
    logger.error(`Form-triggered workflow execution failed: ${workflowId}`, error)
    await persistExecutionError(workflowId, executionId, error, 'api')
  }
}

/**
 * GET /api/interfaces/[id]/submit - Public form structure endpoint (no auth required)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [existingForm] = await db.select().from(form).where(eq(form.id, id)).limit(1)

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    if (existingForm.status !== 'published') {
      return NextResponse.json({ error: 'Form is not published' }, { status: 400 })
    }

    return NextResponse.json(
      { form: serializePublicForm(existingForm) },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    logger.error('Error loading public form:', error)
    return NextResponse.json({ error: 'Failed to load form' }, { status: 500 })
  }
}

/**
 * POST /api/interfaces/[id]/submit - Public form submission endpoint (no auth required)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Fetch the form (must be published and public)
    const [existingForm] = await db.select().from(form).where(eq(form.id, id)).limit(1)

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    if (existingForm.status !== 'published') {
      return NextResponse.json({ error: 'Form is not published' }, { status: 400 })
    }

    // Validate required fields
    const fields =
      (existingForm.fields as Array<{
        id: string
        type: string
        label: string
        required?: boolean
      }>) || []

    const missingFields: string[] = []
    for (const field of fields) {
      if (field.required) {
        const value = body.data?.[field.id]
        if (value === undefined || value === null || value === '') {
          missingFields.push(field.label)
        }
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Collect submission metadata
    const metadata = {
      userAgent: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
      submittedAt: new Date().toISOString(),
    }

    const submissionId = crypto.randomUUID()
    const now = new Date()

    await db.transaction(async (tx: any) => {
      // Save the form submission
      await tx.insert(formSubmission).values({
        id: submissionId,
        formId: id,
        data: body.data || {},
        metadata,
        workflowRunId: null,
        createdAt: now,
      })

      // Increment submit count on the form
      await tx
        .update(form)
        .set({ submitCount: sql`${form.submitCount} + 1` })
        .where(eq(form.id, id))

      // If form is connected to a data table, also save a row there
      if (existingForm.dataTableId) {
        try {
          // Map form field data to a data table row
          const rowData: Record<string, unknown> = {}
          for (const field of fields) {
            if (body.data?.[field.id] !== undefined) {
              rowData[field.id] = body.data[field.id]
            }
          }

          await tx.insert(dataTableRow).values({
            id: crypto.randomUUID(),
            tableId: existingForm.dataTableId,
            data: rowData,
            order: 0,
            createdAt: now,
            updatedAt: now,
          })
        } catch (tableError) {
          logger.error('Error saving to data table (non-fatal):', tableError)
          // Non-fatal: submission is still saved even if data table insert fails
        }
      }
    })

    // If form has a connected workflow, trigger it asynchronously (non-blocking)
    if (existingForm.workflowId) {
      logger.info('Triggering workflow from form submission', {
        formId: id,
        workflowId: existingForm.workflowId,
        submissionId,
      })

      // Fire and forget — don't block the form response
      executeFormWorkflow(
        existingForm.workflowId,
        body.data || {},
        submissionId,
        id,
        existingForm.name
      ).catch((err) => {
        logger.error('Background workflow execution failed:', err)
      })
    }

    // Retrieve form settings for the response
    const settings =
      (existingForm.settings as {
        successMessage?: string
        redirectUrl?: string
      }) || {}

    return NextResponse.json({
      success: true,
      submissionId,
      message: settings.successMessage || 'Thank you for your submission!',
      redirectUrl: settings.redirectUrl || null,
    })
  } catch (error) {
    logger.error('Error processing form submission:', error)
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 })
  }
}
