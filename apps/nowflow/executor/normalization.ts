import { SerializedBlock } from '@/serializer/types'
import { BlockLog, NormalizedBlockOutput } from './types'

/**
 * Normalizes a block output to ensure it has the expected structure.
 * Handles different block types with appropriate response formats.
 *
 * @param output - Raw output from block execution
 * @param block - Block that produced the output
 * @returns Normalized output with consistent structure
 */
export function normalizeBlockOutput(output: any, block: SerializedBlock): NormalizedBlockOutput {
  // Handle error outputs
  if (output && typeof output === 'object' && output.error) {
    return {
      response: {
        error: output.error,
        status: output.status || 500,
      },
      error: output.error,
    }
  }

  if (output && typeof output === 'object' && 'response' in output) {
    // If response already contains an error, maintain it
    if (output.response && output.response.error) {
      return {
        ...output,
        error: output.response.error,
      }
    }
    return output as NormalizedBlockOutput
  }

  const blockType = block.metadata?.id

  if (blockType === 'agent') {
    return output
  }

  if (blockType === 'router') {
    return {
      response: {
        content: '',
        model: '',
        tokens: { prompt: 0, completion: 0, total: 0 },
        selectedPath: output?.selectedPath || {
          blockId: '',
          blockType: '',
          blockTitle: '',
        },
      },
    }
  }

  if (blockType === 'condition') {
    if (output && typeof output === 'object' && 'response' in output) {
      return {
        response: {
          ...output.response,
          conditionResult: output.response.conditionResult || false,
          selectedPath: output.response.selectedPath || {
            blockId: '',
            blockType: '',
            blockTitle: '',
          },
          selectedConditionId: output.response.selectedConditionId || '',
        },
      }
    }

    return {
      response: {
        conditionResult: output?.conditionResult || false,
        selectedPath: output?.selectedPath || {
          blockId: '',
          blockType: '',
          blockTitle: '',
        },
        selectedConditionId: output?.selectedConditionId || '',
      },
    }
  }

  if (blockType === 'function') {
    return {
      response: {
        result: output?.result,
        stdout: output?.stdout || '',
        executionTime: output?.executionTime || 0,
      },
    }
  }

  if (blockType === 'api') {
    return {
      response: {
        data: output?.data,
        status: output?.status || 0,
        headers: output?.headers || {},
      },
    }
  }

  if (blockType === 'evaluator') {
    const evaluatorResponse: {
      content: string
      model: string
      [key: string]: any
    } = {
      content: output?.content || '',
      model: output?.model || '',
    }

    if (output && typeof output === 'object') {
      Object.keys(output).forEach((key) => {
        if (key !== 'content' && key !== 'model') {
          evaluatorResponse[key] = output[key]
        }
      })
    }

    return { response: evaluatorResponse }
  }

  return {
    response: { result: output },
  }
}

/**
 * Creates a new block log entry with initial values.
 *
 * @param block - Block to create log for
 * @returns Initialized block log
 */
export function createBlockLog(block: SerializedBlock): BlockLog {
  return {
    blockId: block.id,
    blockName: block.metadata?.name || '',
    blockType: block.metadata?.id || '',
    startedAt: new Date().toISOString(),
    endedAt: '',
    durationMs: 0,
    success: false,
  }
}
