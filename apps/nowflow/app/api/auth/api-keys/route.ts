import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { apiKey } from '@/db/schema'

const logger = createLogger('api-keysAPI')

// Generate a secure API key
function generateApiKey(): string {
  return `np_${nanoid(32)}`
}

// GET /api/auth/api-keys - Fetch user's API keys
export async function GET(request: NextRequest) {
  try {
    logger.debug('🔑 API Keys endpoint called')

    const session = await getSession()
    logger.debug('🔑 Session:', session ? 'Found' : 'Not found')

    if (!session?.user?.id) {
      logger.debug('🔑 No user session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.debug('🔑 User ID:', session.user.id)

    // Fetch user's API keys from database
    logger.debug('🔑 Fetching API keys from database...')
    const userApiKeys = await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key,
        createdAt: apiKey.createdAt,
        lastUsed: apiKey.lastUsed,
      })
      .from(apiKey)
      .where(eq(apiKey.userId, session.user.id))
      .orderBy(apiKey.createdAt)

    logger.debug('🔑 Found API keys:', userApiKeys.length)

    // Mask keys — full key is only shown at creation time
    const maskedKeys = userApiKeys.map((k: any) => ({
      ...k,
      key:
        k.key.length > 12
          ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}`
          : '****',
    }))

    return NextResponse.json({
      apiKeys: maskedKeys,
      success: true,
    })
  } catch (error) {
    logger.error('🔑 Error fetching API keys:', error)
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
  }
}

// POST /api/auth/api-keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate request body
    const createApiKeySchema = z.object({
      name: z.string().min(1, 'API key name is required').max(100, 'Name too long'),
    })

    const { name } = createApiKeySchema.parse(body)

    // Generate new API key
    const newApiKey = generateApiKey()
    const keyId = nanoid()

    // Insert into database
    const [createdApiKey] = await db
      .insert(apiKey)
      .values({
        id: keyId,
        userId: session.user.id,
        name: name.trim(),
        key: newApiKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key,
        createdAt: apiKey.createdAt,
        lastUsed: apiKey.lastUsed,
      })

    return NextResponse.json({
      apiKey: createdApiKey,
      success: true,
      message: 'API key created successfully',
    })
  } catch (error) {
    logger.error('Error creating API key:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
