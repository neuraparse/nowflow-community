import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { VoiceAgentService } from '@/lib/voice/voice-agent-service'

const logger = createLogger('VoiceWebhook')

/**
 * POST /api/voice/webhook
 * Handles Twilio voice webhooks: call status callbacks, incoming calls,
 * and speech gathering results.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'incoming'
    const workflowId = url.searchParams.get('workflowId') || undefined
    const greeting = url.searchParams.get('greeting') || undefined

    // Parse the Twilio form-encoded webhook body
    const formData = await req.formData()
    const body: Record<string, string> = {}
    formData.forEach((value, key) => {
      body[key] = value.toString()
    })

    logger.info(`Voice webhook: action=${action}, callSid=${body.CallSid || 'n/a'}`)

    // Build the service from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      logger.error('Missing Twilio environment variables')
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service configuration error.</Say><Hangup/></Response>',
        { status: 200, headers: { 'Content-Type': 'application/xml' } }
      )
    }

    const webhookBaseUrl = url.origin
    const service = new VoiceAgentService({
      accountSid,
      authToken,
      fromNumber,
      webhookBaseUrl,
    })

    let twiml: string

    switch (action) {
      case 'incoming':
        twiml = service.handleIncomingCall(greeting, workflowId)
        break

      case 'greeting':
        twiml = service.handleIncomingCall(greeting, workflowId)
        break

      case 'gather': {
        const speechResult = body.SpeechResult || body.Digits || ''
        if (!speechResult) {
          twiml = service.generateTwiML('ended', {
            message: 'No input received. Goodbye.',
          })
        } else {
          twiml = await service.processVoiceInput(speechResult, workflowId, body.CallSid)
        }
        break
      }

      case 'status': {
        // Call status callback - log and return 200
        logger.info(`Call status update: ${body.CallSid} -> ${body.CallStatus}`)
        return NextResponse.json({ received: true })
      }

      default:
        twiml = service.generateTwiML('ended', {
          message: 'Unknown request. Goodbye.',
        })
    }

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    })
  } catch (error) {
    logger.error('Voice webhook error:', error)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say><Hangup/></Response>',
      { status: 200, headers: { 'Content-Type': 'application/xml' } }
    )
  }
}
