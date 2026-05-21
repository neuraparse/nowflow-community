import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getVoiceService } from '@/lib/voice/voice-service'

const logger = createLogger('VoiceCommandAPI')

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { text, sessionId, language } = body

    // Use session user or fallback to body userId
    const userId = session?.user?.id || body.userId
    if (!text || !userId) {
      return NextResponse.json({ error: 'Missing required fields: text' }, { status: 400 })
    }

    const voiceService = getVoiceService()
    const response = await voiceService.processCommand({
      text,
      userId,
      sessionId,
      language,
    })

    return NextResponse.json(response)
  } catch (error: any) {
    logger.error('Voice command processing failed', { error: error.message })
    return NextResponse.json({ error: 'Failed to process voice command' }, { status: 500 })
  }
}
