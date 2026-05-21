import { NextResponse } from 'next/server'
import { addCredits, getCreditHistory, getOrCreateAccount } from '@/lib/ai/credit-manager'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('CreditsAPI')

/**
 * GET /api/ai/credits - Get user's credit balance and history
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const includeHistory = searchParams.get('history') === 'true'

    const account = await getOrCreateAccount(session.user.id)
    const history = includeHistory ? await getCreditHistory(session.user.id) : []

    return NextResponse.json({ account, history })
  } catch (error) {
    logger.error('Error fetching credits:', error)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}

/**
 * POST /api/ai/credits - Add credits or enable BYOK
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, amount, type } = await req.json()

    if (action === 'add' && amount && type) {
      const result = await addCredits(session.user.id, amount, type)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    logger.error('Error managing credits:', error)
    return NextResponse.json({ error: 'Failed to manage credits' }, { status: 500 })
  }
}
