import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { session as sessionTable, user } from '@/db/schema'

const logger = createLogger('DeleteAccountAPI')

export async function DELETE() {
  try {
    const currentSession = await getSession()
    if (!currentSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = currentSession.user.id

    // Delete sessions + user atomically to prevent broken state on partial failure
    await db.transaction(async (tx: any) => {
      await tx.delete(sessionTable).where(eq(sessionTable.userId, userId))
      await tx.delete(user).where(eq(user.id, userId))
    })

    logger.info(`User account deleted: ${userId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
