import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('validateAPI')

// GET /api/workflows/[id]/validate - Validate workflow for deployment
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }

    // Fetch workflow from database
    const [workflowData] = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        state: workflow.state,
        userId: workflow.userId,
      })
      .from(workflow)
      .where(and(eq(workflow.id, id), eq(workflow.userId, session.user.id)))
      .limit(1)

    if (!workflowData) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Validate workflow structure
    logger.debug('Validating workflow structure...')
    logger.debug('Workflow state:', JSON.stringify(workflowData.state, null, 2))

    const validationResults = validateWorkflowStructure(workflowData.state)
    logger.debug('Validation results:', validationResults)

    if (!validationResults.isValid) {
      logger.debug('Validation failed:', validationResults.issues)
      return NextResponse.json(
        {
          error: 'Workflow validation failed',
          issues: validationResults.issues,
          debug: {
            nodeCount: validationResults.nodeCount,
            workflowId: workflowData.id,
            workflowName: workflowData.name,
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Workflow is valid for deployment',
      workflow: {
        id: workflowData.id,
        name: workflowData.name,
      },
      validation: validationResults,
    })
  } catch (error) {
    logger.error('Error validating workflow:', error)
    return NextResponse.json({ error: 'Failed to validate workflow' }, { status: 500 })
  }
}

// Validate workflow structure for deployment
function validateWorkflowStructure(workflowData: any) {
  const issues: string[] = []
  const warnings: string[] = []
  let isValid = true
  let data = null
  let nodeCount = 0

  try {
    logger.debug('Raw workflow data type:', typeof workflowData)
    logger.debug('Raw workflow data:', workflowData)

    // Handle different data formats
    data = workflowData
    if (typeof workflowData === 'string') {
      try {
        data = JSON.parse(workflowData)
      } catch (e) {
        logger.debug('Failed to parse workflow data as JSON')
        issues.push('Invalid workflow data format - not valid JSON')
        isValid = false
        return { isValid, issues, warnings, nodeCount: 0 }
      }
    }

    // If data is null or undefined, it might be an empty workflow
    if (!data) {
      logger.debug('Workflow data is null or undefined')
      issues.push('Workflow data is empty')
      isValid = false
      return { isValid, issues, warnings, nodeCount: 0 }
    }

    logger.debug('Parsed data:', data)
    logger.debug('Data keys:', Object.keys(data || {}))
    logger.debug('Data.nodes:', data?.nodes)
    logger.debug('Data.edges:', data?.edges)

    // Check if workflow has nodes - try different possible keys
    let nodes = data.nodes || data.blocks || data.components || []
    let blocksObject = null

    // Handle blocks as object (new format)
    if (!Array.isArray(nodes) && data.blocks && typeof data.blocks === 'object') {
      logger.debug('Found blocks as object, converting to array')
      blocksObject = data.blocks
      nodes = Object.values(data.blocks)
      logger.debug('Converted blocks object to array:', nodes.length, 'blocks')
    }

    if (!Array.isArray(nodes)) {
      logger.debug('No nodes/blocks array found')
      // For now, let's be more permissive - if there are edges, assume it's a valid workflow
      if (data.edges && Array.isArray(data.edges) && data.edges.length > 0) {
        logger.debug('Found edges but no nodes - assuming valid workflow structure')
        warnings.push('Workflow structure detected but nodes array not found in expected format')
        nodeCount = data.edges.length // Use edge count as approximation
        // Don't mark as invalid if we have edges
        isValid = true
      } else {
        issues.push('Workflow must have a nodes/blocks array or valid structure')
        isValid = false
        nodeCount = 0
      }
    } else if (nodes.length === 0) {
      logger.debug('Empty nodes array')
      issues.push('Workflow must have at least one node')
      isValid = false
      nodeCount = 0
    } else {
      logger.debug('Found', nodes.length, 'nodes/blocks')
      nodeCount = nodes.length
    }

    // Check if workflow has edges (connections) - but don't require them for single node workflows
    if (!data.edges || !Array.isArray(data.edges)) {
      logger.debug('No edges array found')
      warnings.push('Workflow has no connections defined')
    } else {
      logger.debug('Found', data.edges.length, 'edges')
    }

    // Only validate further if we have nodes
    if (nodes && Array.isArray(nodes) && nodes.length > 0) {
      // Check for starter node (optional for deployment)
      const hasStarter = nodes.some((node: any) => node.type === 'starter')
      if (!hasStarter) {
        logger.debug('No starter node found')
        warnings.push(
          'Workflow has no starter node - consider adding one for better execution flow'
        )
      }

      // Check for disconnected nodes (only if we have edges)
      if (data.edges && Array.isArray(data.edges) && data.edges.length > 0) {
        const connectedNodeIds = new Set()
        data.edges.forEach((edge: any) => {
          if (edge.source) connectedNodeIds.add(edge.source)
          if (edge.target) connectedNodeIds.add(edge.target)
        })

        const disconnectedNodes = nodes.filter(
          (node: any) => node.type !== 'starter' && !connectedNodeIds.has(node.id)
        )

        if (disconnectedNodes.length > 0) {
          logger.debug('Found', disconnectedNodes.length, 'disconnected nodes')
          warnings.push(`Found ${disconnectedNodes.length} disconnected node(s)`)
        }
      }

      // Check for basic node structure (less strict)
      const nodesWithIssues = nodes.filter((node: any) => {
        if (!node.id) return true
        if (!node.type) return true
        return false
      })

      if (nodesWithIssues.length > 0) {
        logger.debug('Found nodes with missing id or type')
        issues.push('Some nodes are missing required id or type')
        isValid = false
      }
    }

    logger.debug(
      'Validation complete. Valid:',
      isValid,
      'Issues:',
      issues.length,
      'Warnings:',
      warnings.length
    )
  } catch (parseError) {
    logger.debug('Validation error:', parseError)
    issues.push(
      `Validation error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
    )
    isValid = false
  }

  return {
    isValid,
    issues,
    warnings,
    nodeCount,
  }
}
