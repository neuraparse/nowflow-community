import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { apiKey } from '@/db/schema'

const logger = createLogger('[id]API')

// DELETE /api/auth/api-keys/[id] - Delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'API key ID is required' }, { status: 400 })
    }

    // Hard delete the API key
    const [deletedApiKey] = await db
      .delete(apiKey)
      .where(and(eq(apiKey.id, id), eq(apiKey.userId, session.user.id)))
      .returning({
        id: apiKey.id,
        name: apiKey.name,
      })

    if (!deletedApiKey) {
      return NextResponse.json({ error: 'API key not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
      deletedApiKey,
    })
  } catch (error) {
    logger.error('Error deleting API key:', error)
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
  }
}
