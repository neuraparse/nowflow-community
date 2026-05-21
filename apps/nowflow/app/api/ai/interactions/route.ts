import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAIInteractions, getAIInteractionStats } from '@/lib/database/ai-interactions'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('interactionsAPI')

export async function GET(request: NextRequest) {
  try {
    // Get user authentication
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    switch (action) {
      case 'list':
        const interactions = await getAIInteractions(session.user.id, limit, offset)
        return NextResponse.json({ interactions })

      case 'stats':
        const stats = await getAIInteractionStats()
        return NextResponse.json({ stats })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    logger.error('AI Interactions API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch AI interactions' }, { status: 500 })
  }
}
