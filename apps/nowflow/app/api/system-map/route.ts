import { NextResponse } from 'next/server'
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowLogs, workflowRun } from '@/db/schema'

const logger = createLogger('SystemMapAPI')

/**
 * GET /api/system-map - Get system map data for workflow visualization
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    // Get all active (non-deleted) workflows for the user
    const conditions = [eq(workflow.userId, session.user.id), isNull(workflow.deletedAt)]
    if (workspaceId) {
      conditions.push(eq(workflow.workspaceId, workspaceId))
    }

    const workflows = await db
      .select()
      .from(workflow)
      .where(and(...conditions))
      .orderBy(desc(workflow.updatedAt))

    // Analyze each workflow's services and connections
    const workflowNodes = workflows.map((wf: any) => {
      const state = wf.state as any
      const services: string[] = []
      const triggers: string[] = []
      const dependencies: string[] = []

      // Extract block types as services
      if (state?.blocks) {
        Object.values(state.blocks).forEach((block: any) => {
          const blockType = block?.type
          if (
            blockType &&
            !['starter', 'condition', 'function', 'loop', 'router', 'evaluator'].includes(blockType)
          ) {
            const serviceName = blockType
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase())
            if (!services.includes(serviceName)) {
              services.push(serviceName)
            }
          }
        })
      }

      // Determine status based on deployment and recent errors
      let status: 'healthy' | 'warning' | 'error' | 'inactive' = 'inactive'
      if (wf.isDeployed) {
        status = 'healthy'
      }

      return {
        id: wf.id,
        name: wf.name || 'Untitled Workflow',
        status,
        lastRun: null,
        runCount: 0,
        errorCount: 0,
        services,
        isDeployed: !!wf.isDeployed,
        triggers,
        dependencies,
      }
    })

    // Group workflows by service
    const serviceMap = new Map<string, Set<string>>()
    workflowNodes.forEach((wf: any) => {
      wf.services.forEach((service: any) => {
        if (!serviceMap.has(service)) {
          serviceMap.set(service, new Set())
        }
        serviceMap.get(service)!.add(wf.id)
      })
    })

    const services = Array.from(serviceMap.entries()).map(([name, ids]) => ({
      name,
      icon: getServiceIcon(name),
      color: getServiceColorServer(name),
      workflowIds: Array.from(ids),
    }))

    // Build connections (workflows that share services)
    const connections: { from: string; to: string; type: string }[] = []
    services.forEach((service) => {
      const ids = service.workflowIds
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          connections.push({
            from: ids[i],
            to: ids[j],
            type: service.name,
          })
        }
      }
    })

    return NextResponse.json({
      workflows: workflowNodes,
      services,
      connections,
      stats: {
        totalWorkflows: workflowNodes.length,
        activeWorkflows: workflowNodes.filter((w: any) => w.isDeployed).length,
        totalExecutions: 0,
        avgSuccessRate: 0,
        estimatedTimeSaved: 0,
      },
    })
  } catch (error) {
    logger.error('Error fetching system map:', error)
    return NextResponse.json({ error: 'Failed to fetch system map' }, { status: 500 })
  }
}

function getServiceIcon(name: string): string {
  const iconMap: Record<string, string> = {
    Slack: '💬',
    Gmail: '📧',
    'Google Sheets': '📊',
    'Google Drive': '📁',
    Discord: '🎮',
    GitHub: '💻',
    Notion: '📝',
    Airtable: '📋',
    Stripe: '💳',
    'Http Request': '🌐',
    Webhook: '🔗',
    OpenAI: '🤖',
    Anthropic: '🧠',
    'Image Generator': '🖼️',
    S3: '☁️',
  }
  return iconMap[name] || '🔌'
}

function getServiceColorServer(name: string): string {
  const colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return colors[Math.abs(hash) % colors.length]
}
