#!/usr/bin/env tsx
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { marketplace, user, workflow } from '../db/schema'
// Import example workflows
import contentCreationWorkflow from '../examples/workflows/content_creation_workflow.json'
import customerServiceWorkflow from '../examples/workflows/customer_service_workflow.json'
import dataAnalysisWorkflow from '../examples/workflows/data_analysis_workflow.json'
import ecommerceWorkflow from '../examples/workflows/ecommerce_workflow.json'
import educationWorkflow from '../examples/workflows/education_workflow.json'
import healthcareWorkflow from '../examples/workflows/healthcare_workflow.json'
import simpleWorkflow from '../examples/workflows/simple_workflow.json'

const logger = createLogger('seed-examples')

// Database connection
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error('DATABASE_URL or POSTGRES_URL must be set before seeding examples')
}
const client = postgres(connectionString, { prepare: false })
const db = drizzle(client)

// Example workflows data
const exampleWorkflows = [
  {
    data: simpleWorkflow,
    category: 'getting-started',
    difficultyLevel: 'beginner',
    tags: ['simple', 'basic', 'tutorial'],
    order: 1,
  },
  {
    data: contentCreationWorkflow,
    category: 'content-creation',
    difficultyLevel: 'intermediate',
    tags: ['content', 'writing', 'ai', 'automation'],
    order: 2,
  },
  {
    data: customerServiceWorkflow,
    category: 'customer-service',
    difficultyLevel: 'intermediate',
    tags: ['customer-service', 'support', 'automation', 'chat'],
    order: 3,
  },
  {
    data: dataAnalysisWorkflow,
    category: 'data-analysis',
    difficultyLevel: 'advanced',
    tags: ['data', 'analysis', 'charts', 'visualization'],
    order: 4,
  },
  {
    data: ecommerceWorkflow,
    category: 'ecommerce',
    difficultyLevel: 'intermediate',
    tags: ['ecommerce', 'sales', 'automation', 'orders'],
    order: 5,
  },
  {
    data: educationWorkflow,
    category: 'education',
    difficultyLevel: 'intermediate',
    tags: ['education', 'learning', 'quiz', 'assessment'],
    order: 6,
  },
  {
    data: healthcareWorkflow,
    category: 'healthcare',
    difficultyLevel: 'advanced',
    tags: ['healthcare', 'medical', 'patient', 'records'],
    order: 7,
  },
]

async function seedExamples() {
  logger.debug('🌱 Starting to seed example workflows...')

  try {
    // Create a system user for examples if it doesn't exist
    const systemUserId = 'system-examples-user'
    let systemUser = await db.select().from(user).where(eq(user.id, systemUserId)).limit(1)

    if (systemUser.length === 0) {
      logger.debug('Creating system user for examples...')
      await db.insert(user).values({
        id: systemUserId,
        name: 'NowFlow Examples',
        email: 'examples@example.com',
        emailVerified: true,
        role: 'system',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      logger.debug('System user created')
    } else {
      logger.debug('👤 System user already exists')
    }

    // Process each example workflow
    for (const example of exampleWorkflows) {
      const workflowId = uuidv4()
      const marketplaceId = uuidv4()

      logger.debug(`📦 Processing: ${example.data.metadata.name}`)

      try {
        // Create workflow entry
        await db.insert(workflow).values({
          id: workflowId,
          userId: systemUserId,
          name: example.data.metadata.name,
          description: example.data.metadata.description || '',
          color: getColorForCategory(example.category),
          state: {
            blocks: example.data.blocks || [],
            edges: example.data.edges || [],
          },
          lastSynced: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeployed: false,
          runCount: 0,
        })

        // Create marketplace entry
        await db.insert(marketplace).values({
          id: marketplaceId,
          workflowId: workflowId,
          state: {
            blocks: example.data.blocks || [],
            edges: example.data.edges || [],
          },
          name: example.data.metadata.name,
          description: example.data.metadata.description || '',
          authorId: systemUserId,
          authorName: 'NowFlow Examples',
          views: 0,
          useCount: 0,
          category: example.category,
          tags: example.tags,
          difficultyLevel: example.difficultyLevel,
          isExample: true,
          exampleOrder: example.order,
          rating: '0.00',
          ratingCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        logger.debug(`Added: ${example.data.metadata.name}`)
      } catch (error) {
        logger.error(`Error processing ${example.data.metadata.name}:`, error)
      }
    }

    logger.debug('🎉 Example workflows seeded successfully!')
  } catch (error) {
    logger.error('💥 Error seeding examples:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

function getColorForCategory(category: string): string {
  const colors: Record<string, string> = {
    'getting-started': '#10B981', // green
    'content-creation': '#8B5CF6', // purple
    'customer-service': '#3B82F6', // blue
    'data-analysis': '#F59E0B', // amber
    ecommerce: '#EF4444', // red
    education: '#06B6D4', // cyan
    healthcare: '#EC4899', // pink
  }
  return colors[category] || '#6B7280' // gray as default
}

// Run the seeder
seedExamples()

export { seedExamples }
