import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getSession } from '@/lib/auth'

function safeCompare(expected: string, actual: string) {
  try {
    const a = Buffer.from(actual)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
}

export function hasValidInternalApiKey(request: Request) {
  const token = getBearerToken(request)
  const internalApiKey = process.env.INTERNAL_API_KEY

  if (!token || !internalApiKey) {
    return false
  }

  return safeCompare(internalApiKey, token)
}

export async function requireSession() {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return session
}

export async function requireSessionOrInternalApiKey(request: Request) {
  if (hasValidInternalApiKey(request)) {
    return { session: null, isInternal: true as const }
  }

  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { session, isInternal: false as const }
}
