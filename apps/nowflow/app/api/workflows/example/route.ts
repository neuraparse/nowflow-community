import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { generateUUID, getColorForCategory } from '@/lib/utils'
import {
  createWorkflowWithLimits,
  WorkflowCreationLimitError,
} from '@/lib/workflows/create-workflow'
import { createErrorResponse } from '@/app/api/workflows/utils'
import { getBlock } from '@/blocks'
import { resolveOutputType } from '@/blocks/utils'
import exampleWorkflows from '@/examples/workflows/index'

const logger = createLogger('WorkflowExampleAPI')

export async function POST(request: NextRequest) {
  const requestId = generateUUID().slice(0, 8)

  try {
    // Check authentication
    const session = await getSession()

    if (!session || !session.user) {
      logger.warn(`[${requestId}] Unauthorized access attempt`)
      return createErrorResponse('Unauthorized', 401)
    }

    // Get example ID from query parameters
    const searchParams = request.nextUrl.searchParams
    const exampleId = searchParams.get('exampleId')

    if (!exampleId) {
      logger.warn(`[${requestId}] Missing exampleId parameter`)
      return createErrorResponse('Missing exampleId parameter', 400)
    }

    // Check if example workflow exists
    const exampleWorkflow = exampleWorkflows[exampleId]
    if (!exampleWorkflow) {
      logger.warn(`[${requestId}] Example workflow not found: ${exampleId}`)
      return createErrorResponse('Example workflow not found', 404)
    }

    // Generate workflow ID
    let id = generateUUID()
    const now = new Date()

    // Create workflow state
    const state: any = {
      blocks: {},
      edges: [],
      loops: {},
      lastSaved: Date.now(),
      isDeployed: false,
    }

    // Add blocks to state
    if (exampleWorkflow.blocks && Array.isArray(exampleWorkflow.blocks)) {
      exampleWorkflow.blocks.forEach((block: any) => {
        if (block.id && block.type) {
          // Convert 'output' type blocks to 'function' type
          if (block.type === 'output') {
            block.type = 'function'
            block.subBlocks = {
              code: 'function processData(input) {\n  // Simply return the input as the final output\n  return input;\n}',
            }
          }

          // Get label from data or use type as fallback
          const label = block.data?.label || block.type
          const blockName = label || block.type || 'Unnamed Block'

          // Get block configuration to properly set up outputs
          const blockConfig = getBlock(block.type)
          const subBlocks = block.subBlocks || {}

          // Set default outputs based on block type
          let outputs: Record<string, any> = {}

          // Define default outputs for common block types
          if (block.type === 'starter') {
            outputs = { output: { type: 'any' } }
          } else if (block.type === 'agent') {
            outputs = {
              output: { type: 'any' },
              content: { type: 'string' },
              model: { type: 'string' },
              processTime: { type: 'number' },
            }
          } else if (block.type === 'function') {
            outputs = { output: { type: 'any' } }
          } else if (block.type === 'condition') {
            // For condition blocks, add all condition outputs
            if (subBlocks.conditions && Array.isArray(subBlocks.conditions)) {
              subBlocks.conditions.forEach((condition: any) => {
                if (condition.id) {
                  outputs[condition.id] = { type: 'any' }
                }
              })
            }
          } else if (block.type === 'router') {
            // For router blocks, add standard outputs
            outputs = {
              'output-1': { type: 'any' },
              'output-2': { type: 'any' },
              'output-3': { type: 'any' },
            }
          } else if (block.type === 'evaluator') {
            outputs = {
              output: { type: 'any' },
              score: { type: 'number' },
              feedback: { type: 'string' },
            }
          }

          // Try to use blockConfig outputs if available
          if (blockConfig && blockConfig.outputs) {
            try {
              const configOutputs = resolveOutputType(blockConfig.outputs, subBlocks)
              if (Object.keys(configOutputs).length > 0) {
                outputs = configOutputs
              }
            } catch (error) {
              // If resolving outputs fails, keep the default outputs
              logger.error(`Failed to resolve outputs for block ${block.id}:`, error)
            }
          }

          // Create a complete block structure with all required properties
          state.blocks[block.id] = {
            id: block.id,
            type: block.type,
            name: blockName, // Ensure name is always defined
            position: block.position || { x: 0, y: 0 },
            data: {
              label: label,
              ...(block.data || {}),
            },
            subBlocks: subBlocks,
            outputs: outputs, // Set outputs based on block type
            enabled: true,
            horizontalHandles: true,
            isWide: false,
            height: 0,
          }
        }
      })
    }

    // Add edges to state
    if (exampleWorkflow.edges && Array.isArray(exampleWorkflow.edges)) {
      state.edges = exampleWorkflow.edges.map((edge: any) => ({
        id: edge.id || `edge-${crypto.randomUUID().slice(0, 8)}`,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || 'output',
        targetHandle: edge.targetHandle || 'input',
        type: edge.type || 'default',
        data: edge.data || null,
        animated: edge.animated || false,
        style: edge.style || { stroke: '#999' },
      }))
    }

    // Create new workflow in database
    try {
      logger.info(`[${requestId}] Creating workflow from example`, {
        exampleId,
        userId: session.user.id,
        name: exampleWorkflow.metadata.name,
      })

      await createWorkflowWithLimits({
        id,
        userId: session.user.id,
        name: exampleWorkflow.metadata.name,
        description: exampleWorkflow.metadata.description || '',
        color: getColorForCategory(exampleWorkflow.metadata.category),
        state,
        isDeployed: false,
        now,
      })

      logger.info(`[${requestId}] Workflow created from example and saved to database`, {
        id,
        exampleId,
        userId: session.user.id,
        name: exampleWorkflow.metadata.name,
      })

      // Return the workflow data with the correct ID for redirection
      return NextResponse.json({
        id,
        name: exampleWorkflow.metadata.name,
        description: exampleWorkflow.metadata.description || '',
        color: getColorForCategory(exampleWorkflow.metadata.category),
      })
    } catch (dbError) {
      if (dbError instanceof WorkflowCreationLimitError) {
        return createErrorResponse(dbError.message, dbError.status)
      }

      logger.error(`[${requestId}] Database error creating workflow`, {
        error: dbError,
        errorMessage: dbError instanceof Error ? dbError.message : 'Unknown error',
        errorStack: dbError instanceof Error ? dbError.stack : 'No stack trace',
        errorName: dbError instanceof Error ? dbError.name : 'Unknown error type',
      })
      return createErrorResponse(
        `Failed to save workflow to database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
        500
      )
    }
  } catch (error) {
    logger.error(`[${requestId}] Error creating workflow from example`, {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
      errorName: error instanceof Error ? error.name : 'Unknown error type',
    })
    return createErrorResponse(
      `Failed to create workflow from example: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    )
  }
}
