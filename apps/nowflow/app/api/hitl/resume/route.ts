import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { deserializeExecutionContext, SerializedExecutionState } from '@/lib/hitl/execution-state'
import { createLogger } from '@/lib/logs/console-logger'
import { WorkflowState } from '@/stores/workflows/workflow/types'
import { db } from '@/db'
import { hitlPausedExecution, hitlRequest, workflow } from '@/db/schema'
import { Executor } from '@/executor'
import { ExecutionResult, StreamingExecution } from '@/executor/types'
import { Serializer } from '@/serializer'

const logger = createLogger('HITLResumeAPI')

/**
 * POST /api/hitl/resume
 * Resume a paused workflow execution after HITL approval
 *
 * Body:
 * - hitlRequestId: string - The ID of the HITL request that was approved
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hitlRequestId } = body

    if (!hitlRequestId) {
      return NextResponse.json({ error: 'hitlRequestId is required' }, { status: 400 })
    }

    logger.info('Resuming workflow execution', { hitlRequestId })

    // Get the HITL request to check status
    const [hitlReq] = await db
      .select()
      .from(hitlRequest)
      .where(eq(hitlRequest.id, hitlRequestId))
      .limit(1)

    if (!hitlReq) {
      return NextResponse.json({ error: 'HITL request not found' }, { status: 404 })
    }

    // Check if approved
    if (hitlReq.status !== 'approved') {
      logger.info('HITL request not approved, skipping resume', {
        hitlRequestId,
        status: hitlReq.status,
      })
      return NextResponse.json({
        success: true,
        resumed: false,
        reason: `Request status is ${hitlReq.status}, not approved`,
      })
    }

    // Get the paused execution state
    const [pausedExec] = await db
      .select()
      .from(hitlPausedExecution)
      .where(eq(hitlPausedExecution.hitlRequestId, hitlRequestId))
      .limit(1)

    if (!pausedExec) {
      logger.warn('No paused execution state found', { hitlRequestId })
      return NextResponse.json({
        success: true,
        resumed: false,
        reason: 'No paused execution state found',
      })
    }

    if (pausedExec.resumedAt) {
      logger.info('Workflow already resumed', { hitlRequestId })
      return NextResponse.json({
        success: true,
        resumed: false,
        reason: 'Workflow already resumed',
        resumedAt: pausedExec.resumedAt,
      })
    }

    // Get the workflow
    const [wf] = await db
      .select()
      .from(workflow)
      .where(eq(workflow.id, pausedExec.workflowId))
      .limit(1)

    if (!wf || !wf.state) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Parse workflow state - it's stored as WorkflowState format (blocks as object)
    // We need to serialize it to SerializedWorkflow format (blocks as array)
    let workflowState: WorkflowState
    if (typeof wf.state === 'string') {
      try {
        workflowState = JSON.parse(wf.state) as WorkflowState
      } catch (parseError) {
        logger.error('Failed to parse workflow state', { error: parseError })
        return NextResponse.json({ error: 'Invalid workflow state format' }, { status: 500 })
      }
    } else {
      workflowState = wf.state as WorkflowState
    }

    // Validate workflow state structure
    if (!workflowState || !workflowState.blocks) {
      logger.error('Invalid workflow state - missing blocks', {
        workflowId: pausedExec.workflowId,
        hasState: !!workflowState,
        hasBlocks: !!(workflowState as any)?.blocks,
      })
      return NextResponse.json(
        { error: 'Invalid workflow state - missing blocks' },
        { status: 500 }
      )
    }

    // Serialize workflow state to the format Executor expects
    const { blocks, edges, loops } = workflowState
    const serializedWorkflow = new Serializer().serializeWorkflow(blocks, edges || [], loops || {})

    logger.info('Serialized workflow for resume', {
      workflowId: pausedExec.workflowId,
      blocksCount: serializedWorkflow.blocks.length,
      connectionsCount: serializedWorkflow.connections.length,
    })

    const executionState = pausedExec.executionState as SerializedExecutionState
    const restoredContext = deserializeExecutionContext(executionState)

    logger.info('Restored execution context', {
      hitlRequestId,
      workflowId: pausedExec.workflowId,
      executedBlocks: Array.from(restoredContext.executedBlocks || new Set()),
      activeExecutionPath: Array.from(restoredContext.activeExecutionPath || new Set()),
    })

    // Find the approval block that caused the pause
    const hitlBlockId = hitlReq.blockId

    // Update the block state to mark as approved (not pending anymore)
    if (hitlBlockId && restoredContext.blockStates) {
      const blockState = restoredContext.blockStates.get(hitlBlockId)
      if (blockState) {
        // Update block state to reflect approval
        blockState.output = {
          response: {
            approvalStatus: 'approved',
            hitlResponse: hitlReq.response,
            responseNote: hitlReq.responseNote,
            respondedBy: hitlReq.respondedBy,
            respondedAt: hitlReq.respondedAt
              ? hitlReq.respondedAt.toISOString()
              : new Date().toISOString(),
            requestId: hitlRequestId,
          },
        }
        blockState.executed = true
        restoredContext.blockStates.set(hitlBlockId, blockState)

        // Mark the block as executed
        restoredContext.executedBlocks?.add(hitlBlockId)

        // Find and activate blocks connected to the approval block (next blocks to execute)
        const connectionsFromApproval = serializedWorkflow.connections.filter(
          (conn) => conn.source === hitlBlockId
        )
        for (const conn of connectionsFromApproval) {
          restoredContext.activeExecutionPath?.add(conn.target)
          logger.info('Activated next block after approval', {
            approvalBlockId: hitlBlockId,
            nextBlockId: conn.target,
          })
        }

        logger.info('Updated approval block state', {
          hitlBlockId,
          approvalStatus: 'approved',
          nextBlocksActivated: connectionsFromApproval.length,
        })
      }
    }

    // Convert restored context to initial block states for executor
    const initialBlockStates: Record<string, any> = {}
    restoredContext.blockStates?.forEach((state, blockId) => {
      initialBlockStates[blockId] = state.output
    })

    // Build list of executed blocks from restored context
    const executedBlocksList = Array.from(restoredContext.executedBlocks || new Set()) as string[]
    const activePathList = Array.from(restoredContext.activeExecutionPath || new Set()) as string[]

    logger.info('Preparing executor with restored state', {
      hitlRequestId,
      executedBlocksCount: executedBlocksList.length,
      executedBlocks: executedBlocksList,
      activePathCount: activePathList.length,
      activePath: activePathList,
    })

    // Create executor with restored state including executed blocks
    const executor = new Executor({
      workflow: serializedWorkflow,
      currentBlockStates: initialBlockStates,
      envVarValues: executionState.environmentVariables || {},
      contextExtensions: {
        stream: executionState.stream,
        selectedOutputIds: executionState.selectedOutputIds,
        edges: executionState.edges,
        userId: executionState.userId,
        sessionId: executionState.sessionId,
        sessionToken: executionState.sessionToken,
        memoryEnabled: executionState.memoryEnabled,
        sessionMetadata: executionState.sessionMetadata,
        apiBaseUrl: executionState.apiBaseUrl,
        executionId: executionState.executionId, // Keep same executionId for HITL tracking
        executedBlocks: executedBlocksList, // Pass already executed blocks
        activeExecutionPath: activePathList, // Pass active execution path
      },
    })

    // Execute the workflow from where it left off
    logger.info('Continuing workflow execution', {
      hitlRequestId,
      workflowId: pausedExec.workflowId,
    })

    const rawResult = await executor.execute(pausedExec.workflowId)

    // Handle both ExecutionResult and StreamingExecution
    const isStreaming = 'stream' in rawResult && 'execution' in rawResult
    const result: ExecutionResult = isStreaming
      ? (rawResult as StreamingExecution).execution
      : (rawResult as ExecutionResult)

    // Update the paused execution record
    await db
      .update(hitlPausedExecution)
      .set({
        resumedAt: new Date(),
        resumeResult: {
          success: result.success,
          output: result.output,
          error: result.error,
        },
      })
      .where(eq(hitlPausedExecution.id, pausedExec.id))

    logger.info('Workflow execution resumed successfully', {
      hitlRequestId,
      workflowId: pausedExec.workflowId,
      success: result.success,
    })

    return NextResponse.json({
      success: true,
      resumed: true,
      result: {
        success: result.success,
        output: result.output,
        error: result.error,
      },
    })
  } catch (error: any) {
    logger.error('Failed to resume workflow', {
      error: error.message,
      stack: error.stack,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to resume workflow' },
      { status: 500 }
    )
  }
}
