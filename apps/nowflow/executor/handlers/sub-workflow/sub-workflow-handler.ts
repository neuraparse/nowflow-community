import { createLogger } from '@/lib/logs/console-logger'
import { withSpan } from '@/lib/observability'
import { BlockOutput } from '@/blocks/types'
import { SerializedBlock } from '@/serializer/types'
import { BlockHandler, ExecutionContext } from '../../types'

const logger = createLogger('SubWorkflowBlockHandler')

/**
 * Handler for Sub-Workflow blocks that execute another workflow as a nested step.
 * The target workflow is called via its execute API endpoint and must be deployed.
 */
export class SubWorkflowBlockHandler implements BlockHandler {
  canHandle(block: SerializedBlock): boolean {
    return block.metadata?.id === 'sub-workflow'
  }

  async execute(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput> {
    return withSpan(
      'executor.handler.sub-workflow',
      async () => this.executeInternal(block, inputs, context),
      { blockId: block.id, workflowId: context.workflowId }
    )
  }

  private async executeInternal(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput> {
    const workflowId = inputs.workflowId?.trim()
    if (!workflowId) {
      throw new Error('Sub-Workflow: Workflow ID is required')
    }

    let inputData = inputs.inputData
    if (typeof inputData === 'string') {
      try {
        inputData = JSON.parse(inputData)
      } catch {
        // keep as string
      }
    }
    if (inputData === null || inputData === undefined) {
      inputData = {}
    }

    const baseUrl = context.apiBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const url = `${baseUrl}/api/workflows/${workflowId}/execute`

    logger.info(`[SubWorkflowBlockHandler] Calling sub-workflow: ${url}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: inputData }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText)
      throw new Error(`Sub-Workflow failed (${response.status}): ${errText}`)
    }

    const data = await response.json()
    logger.info(`[SubWorkflowBlockHandler] Sub-workflow completed`, data)

    return {
      response: {
        content: data,
        status: 'completed',
        executionId: data?.executionId ?? '',
      },
    }
  }
}
