import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { buildEffectiveEnvVars, resolveTemplateEnvOrThrow } from '@/lib/execution/env-vars'
import { createLogger } from '@/lib/logs/console-logger'
import { persistExecutionError, persistExecutionLogs } from '@/lib/logs/execution-logger'
import { buildTraceSpans } from '@/lib/logs/trace-spans'
import { canExecuteTrigger } from '@/lib/spam-guard'
import { updateWorkflowRunCounts } from '@/lib/workflows/utils'
import { WorkflowState } from '@/stores/workflows/workflow/types'
import { db } from '@/db'
import { triggerLog, userStats, workflow, workflowTrigger } from '@/db/schema'
import { Executor } from '@/executor'
import { Serializer } from '@/serializer'

const logger = createLogger('TriggerWorkflowExec')

/**
 * Execute a workflow triggered by polling, email, or webhook notification.
 * Shared between cron-based trigger execution and push webhook handlers.
 */
export async function executeTriggeredWorkflow(
  trigger: typeof workflowTrigger.$inferSelect,
  workflowRecord: typeof workflow.$inferSelect,
  triggerData: any
): Promise<void> {
  // Rate limit check - prevent runaway trigger loops
  if (!(await canExecuteTrigger(trigger.id))) {
    logger.warn(`Trigger ${trigger.id} rate-limited - too many executions`, {
      triggerId: trigger.id,
      workflowId: workflowRecord.id,
      triggerType: trigger.triggerType,
    })
    throw new Error(`Trigger rate-limited: exceeded maximum execution frequency`)
  }

  const executionId = uuidv4()

  try {
    // Prefer deployedState for deployed workflows
    const state = ((workflowRecord as any).deployedState || workflowRecord.state) as WorkflowState
    const { blocks, edges, loops } = state

    // Build environment variables
    const effectiveEnvVars = await buildEffectiveEnvVars({
      userId: workflowRecord.userId,
      workflowId: workflowRecord.id,
      executionMode: 'trigger',
      extra: {
        TRIGGER_TYPE: trigger.triggerType,
        TRIGGER_PROVIDER: trigger.provider || '',
      },
    })

    // Resolve environment variables in block states
    const currentBlockStates = await Object.entries(blocks).reduce(
      async (accPromise, [id, block]) => {
        const acc = await accPromise
        acc[id] = await Object.entries(block.subBlocks).reduce(
          async (subAccPromise, [key, subBlock]) => {
            const subAcc = await subAccPromise
            let value = subBlock.value

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

    // Serialize workflow
    const serializedWorkflow = new Serializer().serializeWorkflow(blocks, edges, loops)

    // For array-based triggers, flatten the first item's fields at the top level
    // so downstream blocks can access them directly (e.g., <start.response.subject>)
    // Keep the full array available under a trigger-specific key
    let inputPayload: any = triggerData
    if (Array.isArray(triggerData) && triggerData.length > 0) {
      switch (trigger.triggerType) {
        case 'email':
          inputPayload = { ...triggerData[0], emails: triggerData }
          break
        case 'form':
          inputPayload = { ...triggerData[0], responses: triggerData }
          break
        case 'database':
          inputPayload = { ...triggerData[0], changes: triggerData }
          break
        case 'file':
          inputPayload = { ...triggerData[0], files: triggerData }
          break
        case 'calendar':
          inputPayload = { ...triggerData[0], events: triggerData }
          break
        default:
          inputPayload = { ...triggerData[0], items: triggerData }
          break
      }
    }

    const input = {
      workflowId: workflowRecord.id,
      input: inputPayload,
      triggerData,
      _context: {
        workflowId: workflowRecord.id,
        triggerType: trigger.triggerType,
        triggerId: trigger.id,
      },
    }

    // Get workflow variables
    let workflowVariables = {}
    if (workflowRecord.variables) {
      try {
        workflowVariables =
          typeof workflowRecord.variables === 'string'
            ? JSON.parse(workflowRecord.variables)
            : workflowRecord.variables
      } catch (error) {
        logger.error(`Failed to parse workflow variables for ${workflowRecord.id}`, error)
      }
    }

    // Execute workflow
    const executor = new Executor({
      workflow: serializedWorkflow,
      currentBlockStates,
      envVarValues: effectiveEnvVars,
      workflowInput: input,
      workflowVariables,
      workflowState: state,
    })

    const result = await executor.execute(workflowRecord.id)

    const executionResult = 'stream' in result && 'execution' in result ? result.execution : result

    // Update workflow run counts if successful
    if (executionResult.success) {
      await updateWorkflowRunCounts(workflowRecord.id)

      await db
        .update(userStats)
        .set({ lastActive: new Date() })
        .where(eq(userStats.userId, workflowRecord.userId))

      // Update trigger stats
      await db
        .update(workflowTrigger)
        .set({
          lastTriggeredAt: new Date(),
          totalTriggers: (trigger.totalTriggers || 0) + 1,
          successfulTriggers: (trigger.successfulTriggers || 0) + 1,
          healthStatus: 'healthy',
          lastError: null,
        })
        .where(eq(workflowTrigger.id, trigger.id))
    } else {
      // Update failed trigger stats
      await db
        .update(workflowTrigger)
        .set({
          failedTriggers: (trigger.failedTriggers || 0) + 1,
          lastError: executionResult.error || 'Workflow execution failed',
          healthStatus: 'warning',
        })
        .where(eq(workflowTrigger.id, trigger.id))
    }

    // Build trace spans
    const { traceSpans, totalDuration } = buildTraceSpans(executionResult)

    const enrichedResult = {
      ...executionResult,
      traceSpans,
      totalDuration,
    }

    // Log execution
    await persistExecutionLogs(workflowRecord.id, executionId, enrichedResult, 'trigger')

    // Log trigger execution
    await db.insert(triggerLog).values({
      id: uuidv4(),
      triggerId: trigger.id,
      triggerType: trigger.triggerType,
      provider: trigger.provider,
      triggerData,
      executionId,
      success: executionResult.success,
      errorMessage: executionResult.error,
      processingTime: totalDuration,
      triggeredAt: new Date(),
      completedAt: new Date(),
    })
  } catch (error: any) {
    logger.error(`Error executing workflow for trigger ${trigger.id}`, error)

    await persistExecutionError(workflowRecord.id, executionId, error, 'trigger')

    // Determine if this is an auth/scope error that will keep failing
    const errorMsg = (error.message || '').toLowerCase()
    const isAuthError =
      errorMsg.includes('authentication failed') ||
      errorMsg.includes('authorization failed') ||
      errorMsg.includes('access token') ||
      errorMsg.includes('reconnect your')
    const consecutiveFailures = (trigger.failedTriggers || 0) + 1

    // Degrade trigger health: auth errors → error immediately, others → warning then error
    const healthStatus = isAuthError || consecutiveFailures >= 5 ? 'error' : 'warning'

    await db
      .update(workflowTrigger)
      .set({
        failedTriggers: consecutiveFailures,
        lastError: error.message,
        healthStatus,
      })
      .where(eq(workflowTrigger.id, trigger.id))

    await db.insert(triggerLog).values({
      id: uuidv4(),
      triggerId: trigger.id,
      triggerType: trigger.triggerType,
      provider: trigger.provider,
      triggerData,
      executionId,
      success: false,
      errorMessage: error.message,
      triggeredAt: new Date(),
      completedAt: new Date(),
    })

    throw error
  }
}
