import { recordAgentMetrics } from '@/lib/agents/metrics'
import { createLogger } from '@/lib/logs/console-logger'
import { withSpan } from '@/lib/observability'
import { BlockOutput } from '@/blocks/types'
import { SerializedBlock } from '@/serializer/types'
import { BlockHandler, ExecutionContext } from '../../types'
import { ApprovalBlockHandler, HITLPauseError } from '../approval/index'

const logger = createLogger('HumanAgentHandler')

/**
 * Handler for Human Agent blocks.
 * Wraps ApprovalBlockHandler to add human agent-specific metadata and metrics.
 */
export class HumanAgentBlockHandler implements BlockHandler {
  private approvalHandler = new ApprovalBlockHandler()

  canHandle(block: SerializedBlock): boolean {
    return block.metadata?.id === 'human_agent'
  }

  async execute(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput> {
    return withSpan(
      'executor.handler.human-agent',
      async () => this.executeInternal(block, inputs, context),
      { blockId: block.id, workflowId: context.workflowId }
    )
  }

  private async executeInternal(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput> {
    const startTime = Date.now()

    logger.info('Executing human agent block', {
      blockId: block.id,
      agentName: inputs.agentName,
      assignedTo: inputs.assignedToEmail,
    })

    // Map human agent inputs to approval block inputs
    const approvalInputs = {
      title: `[Human Agent: ${inputs.agentName || 'Unnamed'}] ${(inputs.taskDescription || 'Task').slice(0, 100)}`,
      description: inputs.taskDescription || '',
      requestType: 'input',
      assignedToEmail: inputs.assignedToEmail,
      notificationChannels: inputs.notificationChannels || ['email', 'in_app'],
      timeoutMinutes: inputs.timeoutMinutes ? parseInt(inputs.timeoutMinutes) : undefined,
      priority: inputs.priority || 'normal',
      metadata: {
        isHumanAgent: true,
        agentName: inputs.agentName,
        agentRole: inputs.agentRole,
        agentProfileId: inputs.agentProfileId,
        contextData: inputs.contextData,
        expectedResponseFormat: inputs.expectedResponseFormat,
      },
    }

    try {
      const result = await this.approvalHandler.execute(block, approvalInputs, context)

      // Record success metrics
      recordAgentMetrics({
        workflowId: context.workflowId || '',
        executionId: context.executionId || '',
        blockId: block.id,
        agentName: inputs.agentName || null,
        agentProfileId: inputs.agentProfileId || null,
        agentType: 'human',
        status: 'success',
        durationMs: Date.now() - startTime,
      })

      return result
    } catch (error) {
      // Don't record metrics for HITL pause (it's expected, not a failure)
      if (error instanceof HITLPauseError) {
        throw error
      }

      // Record failure metrics
      recordAgentMetrics({
        workflowId: context.workflowId || '',
        executionId: context.executionId || '',
        blockId: block.id,
        agentName: inputs.agentName || null,
        agentProfileId: inputs.agentProfileId || null,
        agentType: 'human',
        status: inputs.onTimeout === 'fail' ? 'timeout' : 'failed',
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}
