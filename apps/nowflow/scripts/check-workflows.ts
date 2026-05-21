import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createLogger } from '@/lib/logs/console-logger'
import { workflow } from '../db/schema'

const logger = createLogger('check-workflows')

// Database connection
const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString, { prepare: false })
const db = drizzle(client)

// Workflow IDs from the error logs
const workflowIds = [
  'f050123a-7852-42d7-9781-a595192a5649',
  'a99f69ad-e106-4437-9087-515de229ebf5',
  'cead4389-80c2-42af-b816-3c336fcc3331',
  'cf247bde-19cb-4d41-8066-ba037a7d1661',
  '06f9b77f-c9e6-43a7-8558-325fb3d6ddff',
  '92f69ba1-b5e7-4e14-a73e-e0836353ab57', // This one seems to work
]

async function checkWorkflows() {
  logger.debug('Checking workflows in database...\n')

  for (const workflowId of workflowIds) {
    try {
      const result = await db
        .select({
          id: workflow.id,
          name: workflow.name,
          userId: workflow.userId,
          workspaceId: workflow.workspaceId,
          createdAt: workflow.createdAt,
          isDeployed: workflow.isDeployed,
        })
        .from(workflow)
        .where(eq(workflow.id, workflowId))
        .limit(1)

      if (result.length > 0) {
        const wf = result[0]
        logger.debug(`FOUND: ${workflowId}`)
        logger.debug(`   Name: ${wf.name}`)
        logger.debug(`   User ID: ${wf.userId}`)
        logger.debug(`   Workspace ID: ${wf.workspaceId || 'null'}`)
        logger.debug(`   Created: ${wf.createdAt}`)
        logger.debug(`   Deployed: ${wf.isDeployed}`)
      } else {
        logger.debug(`NOT FOUND: ${workflowId}`)
      }
      logger.debug('')
    } catch (error) {
      logger.debug(`🔥 ERROR checking ${workflowId}:`, error)
      logger.debug('')
    }
  }

  // Also check total workflow count
  try {
    const totalWorkflows = await db.select().from(workflow)
    logger.debug(`📊 Total workflows in database: ${totalWorkflows.length}`)

    if (totalWorkflows.length > 0) {
      logger.debug('\nAll workflows:')
      totalWorkflows.forEach((wf) => {
        logger.debug(
          `  - ${wf.id} (${wf.name}) - User: ${wf.userId} - Workspace: ${wf.workspaceId || 'null'}`
        )
      })
    }
  } catch (error) {
    logger.debug('Error getting total workflow count:', error)
  }

  await client.end()
}

checkWorkflows().catch(console.error)
