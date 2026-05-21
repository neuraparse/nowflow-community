import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getPostgresStorage } from '@/lib/memory/storage/postgres-storage'
import type { MemoryEntry, MemoryQuery } from '@/lib/memory/types'

const logger = createLogger('MemoryAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RequestSchema = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
})

type Action =
  | 'save'
  | 'saveBatch'
  | 'get'
  | 'query'
  | 'update'
  | 'delete'
  | 'deleteSession'
  | 'deleteExpired'
  | 'count'

function denyIfUnauthorized(sessionUserId: string | undefined, sessionId?: string) {
  if (!sessionId) return

  if (!sessionUserId && sessionId.startsWith('user-')) {
    throw new Error('Unauthorized session access')
  }

  if (sessionUserId && sessionId.startsWith('user-')) {
    const expected = `user-${sessionUserId}`
    if (!sessionId.startsWith(expected)) {
      throw new Error('Forbidden session access')
    }
  }
}

function enforceUserId<T extends { userId?: string }>(
  sessionUserId: string | undefined,
  payload: T
): T {
  if (!sessionUserId) return payload
  return { ...payload, userId: sessionUserId }
}

/**
 * Normalize date fields in memory entry
 * JSON serialization converts Date to string, so we need to parse them back
 */
function normalizeDates<T extends { expiresAt?: Date | string | null }>(entry: T): T {
  if (!entry.expiresAt) return entry

  const expiresAt = entry.expiresAt
  if (expiresAt instanceof Date) return entry

  // Parse string to Date
  const parsed = new Date(expiresAt as string)
  if (isNaN(parsed.getTime())) {
    // Invalid date, remove it
    return { ...entry, expiresAt: undefined }
  }

  return { ...entry, expiresAt: parsed }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload' },
        { status: 400 }
      )
    }

    const { action, payload } = parsed.data
    const session = await getSession()
    const sessionUserId = session?.user?.id
    const storage = getPostgresStorage()

    switch (action as Action) {
      case 'save': {
        const rawEntry = payload?.entry as Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>
        if (!rawEntry?.sessionId) {
          return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 })
        }
        denyIfUnauthorized(sessionUserId, rawEntry.sessionId)
        // Normalize: convert date strings to Date objects, enforce userId
        const entry = normalizeDates(enforceUserId(sessionUserId, rawEntry))
        const id = await storage.save(entry)
        return NextResponse.json({ success: true, data: { id } })
      }
      case 'saveBatch': {
        const rawEntries = (payload?.entries || []) as Omit<
          MemoryEntry,
          'id' | 'createdAt' | 'updatedAt'
        >[]
        rawEntries.forEach((entry) => denyIfUnauthorized(sessionUserId, entry.sessionId))
        // Normalize: convert date strings to Date objects, enforce userId
        const entries = rawEntries.map((entry) =>
          normalizeDates(enforceUserId(sessionUserId, entry))
        )
        const ids = await storage.saveBatch(entries)
        return NextResponse.json({ success: true, data: { ids } })
      }
      case 'get': {
        const id = payload?.id as string
        const sessionId = payload?.sessionId as string
        if (!id || !sessionId) {
          return NextResponse.json(
            { success: false, error: 'Missing id or sessionId' },
            { status: 400 }
          )
        }
        denyIfUnauthorized(sessionUserId, sessionId)
        const entry = await storage.get(id, sessionId)
        return NextResponse.json({ success: true, data: { entry } })
      }
      case 'query': {
        const query = payload?.query as MemoryQuery
        if (!query?.sessionId) {
          return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 })
        }
        denyIfUnauthorized(sessionUserId, query.sessionId)
        const normalized = enforceUserId(sessionUserId, query)
        const entries = await storage.query(normalized)
        return NextResponse.json({ success: true, data: { entries } })
      }
      case 'update': {
        const id = payload?.id as string
        const sessionId = payload?.sessionId as string
        const updates = payload?.updates as Partial<MemoryEntry>
        if (!id || !sessionId || !updates) {
          return NextResponse.json(
            { success: false, error: 'Missing id, sessionId, or updates' },
            { status: 400 }
          )
        }
        denyIfUnauthorized(sessionUserId, sessionId)
        await storage.update(id, sessionId, updates)
        return NextResponse.json({ success: true, data: {} })
      }
      case 'delete': {
        const id = payload?.id as string
        const sessionId = payload?.sessionId as string
        if (!id || !sessionId) {
          return NextResponse.json(
            { success: false, error: 'Missing id or sessionId' },
            { status: 400 }
          )
        }
        denyIfUnauthorized(sessionUserId, sessionId)
        await storage.delete(id, sessionId)
        return NextResponse.json({ success: true, data: {} })
      }
      case 'deleteSession': {
        const sessionId = payload?.sessionId as string
        if (!sessionId) {
          return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 })
        }
        denyIfUnauthorized(sessionUserId, sessionId)
        const count = await storage.deleteSession(sessionId)
        return NextResponse.json({ success: true, data: { count } })
      }
      case 'deleteExpired': {
        const count = await storage.deleteExpired()
        return NextResponse.json({ success: true, data: { count } })
      }
      case 'count': {
        const sessionId = payload?.sessionId as string
        if (!sessionId) {
          return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 })
        }
        denyIfUnauthorized(sessionUserId, sessionId)
        const count = await storage.count(sessionId)
        return NextResponse.json({ success: true, data: { count } })
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    logger.error('Memory API error', {
      error: error?.message || error,
      stack: error?.stack,
      name: error?.name,
    })
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unauthorized')
      ? 401
      : message.includes('Forbidden')
        ? 403
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
