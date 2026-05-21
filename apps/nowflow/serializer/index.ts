import { Edge } from '@xyflow/react'
import { createLogger } from '@/lib/logs/console-logger'
import { BlockState, Loop } from '@/stores/workflows/workflow/types'
import { getBlock } from '@/blocks'
import { SerializedBlock, SerializedWorkflow } from './types'

const logger = createLogger('Serializer')

export class Serializer {
  serializeWorkflow(
    blocks: Record<string, BlockState>,
    edges: Edge[],
    loops: Record<string, Loop>
  ): SerializedWorkflow {
    // Validate and recover blocks before serialization
    const validBlocks = Object.values(blocks).filter((block) => {
      if (!block) {
        logger.warn(`Skipping null block during serialization`)
        return false
      }

      // Try to recover missing type/name from the block registry
      if (block.type && !block.name) {
        const blockConfig = getBlock(block.type)
        if (blockConfig) {
          block.name = blockConfig.name
          logger.warn(`Recovered missing name for block ${block.id} from registry: "${block.name}"`)
        }
      }

      if (!block.type || !block.name) {
        logger.warn(`Skipping invalid block during serialization:`, {
          blockId: block.id,
          blockType: block.type,
          blockName: block.name,
        })
        return false
      }
      return true
    })

    return {
      version: '1.0',
      blocks: validBlocks.map((block) => this.serializeBlock(block)),
      connections: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
      })),
      loops,
    }
  }

  private serializeBlock(block: BlockState): SerializedBlock {
    // Additional validation before attempting to get block config
    if (!block) {
      throw new Error(`Cannot serialize null or undefined block`)
    }

    if (!block.type) {
      throw new Error(`Block ${block.id || 'unknown'} has undefined or null type`)
    }

    if (typeof block.type !== 'string') {
      throw new Error(
        `Block ${block.id || 'unknown'} has invalid type: ${typeof block.type} (${block.type})`
      )
    }

    const blockConfig = getBlock(block.type)
    if (!blockConfig) {
      throw new Error(`Invalid block type: ${block.type} for block ${block.id || 'unknown'}`)
    }

    // Check if this is an agent block with custom tools
    const params = this.extractParams(block)
    let toolId = ''

    if (block.type === 'agent' && params.tools) {
      // Process the tools in the agent block
      try {
        const tools = Array.isArray(params.tools)
          ? params.tools
          : typeof params.tools === 'string' && params.tools.trim().startsWith('[')
            ? JSON.parse(params.tools)
            : []

        // If there are custom tools, we just keep them as is
        // They'll be handled by the executor during runtime

        // For non-custom tools, we determine the tool ID
        const nonCustomTools = tools.filter((tool: any) => tool.type !== 'custom-tool')
        if (nonCustomTools.length > 0) {
          toolId = blockConfig.tools.config?.tool
            ? blockConfig.tools.config.tool(params)
            : blockConfig.tools.access[0]
        }
      } catch (error) {
        logger.error('Error processing tools in agent block:', {
          error: error instanceof Error ? error.message : String(error),
        })
        // Default to the first tool if we can't process tools
        toolId = blockConfig.tools.access[0]
      }
    } else {
      // For non-agent blocks, get tool ID from block config as usual
      toolId = blockConfig.tools.config?.tool
        ? blockConfig.tools.config.tool(params)
        : blockConfig.tools.access[0]
    }

    // Apply params transformation if defined in block config
    // This is where enhanced system prompts and other transformations happen
    let finalParams = params
    if (blockConfig.tools.config?.params) {
      try {
        finalParams = blockConfig.tools.config.params(params)
        logger.info(`Applied params transformation for block type: ${block.type}`, {
          blockId: block.id,
          hasSystemPrompt: !!finalParams.systemPrompt,
          hasContext: !!finalParams.context,
        })
      } catch (error) {
        logger.error('Error applying params transformation:', { error, blockType: block.type })
        // Fall back to original params if transformation fails
        finalParams = params
      }
    }

    // Get inputs from block config
    const inputs: Record<string, any> = {}
    if (blockConfig.inputs) {
      Object.entries(blockConfig.inputs).forEach(([key, config]) => {
        inputs[key] = config.type
      })
    }

    return {
      id: block.id,
      position: block.position,
      config: {
        tool: toolId,
        params: finalParams,
      },
      inputs,
      outputs: {
        ...block.outputs,
        // Include response format fields if available
        ...(finalParams.responseFormat
          ? {
              responseFormat: JSON.parse(finalParams.responseFormat),
            }
          : {}),
      },
      metadata: {
        id: block.type,
        name: block.name,
        description: blockConfig.description,
        category: blockConfig.category,
        color: blockConfig.bgColor,
      },
      enabled: block.enabled,
    }
  }

  private extractParams(block: BlockState): Record<string, any> {
    const blockConfig = getBlock(block.type)
    if (!blockConfig) {
      throw new Error(`Invalid block type: ${block.type}`)
    }

    const params: Record<string, any> = {}

    // First collect all current values from subBlocks
    Object.entries(block.subBlocks).forEach(([id, subBlock]) => {
      params[id] = subBlock.value
    })

    // Then check for any subBlocks with default values or condition-hidden fields
    blockConfig.subBlocks.forEach((subBlockConfig) => {
      const id = subBlockConfig.id
      if (params[id] === null && subBlockConfig.value) {
        // If the value is null and there's a default value function, use it
        params[id] = subBlockConfig.value(params)
      }

      // Clear values for condition-hidden fields so stale data is not sent to executor
      if (subBlockConfig.condition) {
        const condField = subBlockConfig.condition.field
        const condValue = subBlockConfig.condition.value
        const actualValue = params[condField] ?? ''
        const isMatch = Array.isArray(condValue)
          ? condValue.includes(actualValue)
          : actualValue === condValue
        const isVisible = subBlockConfig.condition.not ? !isMatch : isMatch
        if (!isVisible) {
          params[id] = null
        }
      }
    })

    // DEBUG: Log knowledge sources for agent blocks
    if (block.type === 'agent' && params.knowledgeSources) {
      logger.info('🔵 [Serializer] Agent block has knowledge sources', {
        blockId: block.id,
        knowledgeSources: params.knowledgeSources,
      })
    }

    return params
  }

  deserializeWorkflow(workflow: SerializedWorkflow): {
    blocks: Record<string, BlockState>
    edges: Edge[]
  } {
    const blocks: Record<string, BlockState> = {}
    const edges: Edge[] = []

    // Deserialize blocks
    workflow.blocks.forEach((serializedBlock) => {
      const block = this.deserializeBlock(serializedBlock)
      blocks[block.id] = block
    })

    // Deserialize connections
    workflow.connections.forEach((connection) => {
      edges.push({
        id: crypto.randomUUID(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      })
    })

    return { blocks, edges }
  }

  private deserializeBlock(serializedBlock: SerializedBlock): BlockState {
    const blockType = serializedBlock.metadata?.id
    if (!blockType) {
      throw new Error(`Invalid block type: ${serializedBlock.metadata?.id}`)
    }

    const blockConfig = getBlock(blockType)
    if (!blockConfig) {
      throw new Error(`Invalid block type: ${blockType}`)
    }

    const subBlocks: Record<string, any> = {}
    blockConfig.subBlocks.forEach((subBlock) => {
      const savedValue = serializedBlock.config.params[subBlock.id]
      subBlocks[subBlock.id] = {
        id: subBlock.id,
        type: subBlock.type,
        value: savedValue ?? (typeof subBlock.value === 'function' ? subBlock.value({}) : null),
      }
    })

    return {
      id: serializedBlock.id,
      type: blockType,
      name: serializedBlock.metadata?.name || blockConfig.name,
      position: serializedBlock.position,
      subBlocks,
      outputs: serializedBlock.outputs,
      enabled: true,
    }
  }
}
