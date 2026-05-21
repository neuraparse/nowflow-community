import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('VoiceAgentService')

export interface VoiceAgentConfig {
  accountSid: string
  authToken: string
  fromNumber: string
  voiceProvider?: 'openai' | 'elevenlabs' | 'google' | 'deepgram'
  voiceId?: string
  aiModel?: string
  greetingMessage?: string
  webhookBaseUrl: string
}

export interface CallOptions {
  to: string
  greetingMessage?: string
  voiceId?: string
  workflowId?: string
  callbackUrl?: string
}

export interface CallResult {
  success: boolean
  callSid?: string
  status?: string
  error?: string
}

type CallState = 'greeting' | 'conversation' | 'hold' | 'voicemail' | 'transferring' | 'ended'

export class VoiceAgentService {
  private config: VoiceAgentConfig
  private twilioBaseUrl: string

  constructor(config: VoiceAgentConfig) {
    this.config = config
    this.twilioBaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}`
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')}`
  }

  /** Initiate an outbound call via Twilio */
  async startCall(options: CallOptions): Promise<CallResult> {
    try {
      const twimlUrl =
        `${this.config.webhookBaseUrl}/api/voice/webhook?action=greeting` +
        `&greeting=${encodeURIComponent(options.greetingMessage || this.config.greetingMessage || 'Hello, how can I help you?')}` +
        (options.workflowId ? `&workflowId=${encodeURIComponent(options.workflowId)}` : '')

      const body = new URLSearchParams()
      body.append('To', options.to)
      body.append('From', this.config.fromNumber)
      body.append('Url', twimlUrl)
      if (options.callbackUrl) {
        body.append('StatusCallback', options.callbackUrl)
        body.append('StatusCallbackEvent', 'initiated ringing answered completed')
      }

      const response = await fetch(`${this.twilioBaseUrl}/Calls.json`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      const data = await response.json()
      if (!response.ok) {
        logger.error('Failed to start call:', data)
        return { success: false, error: data.message || 'Failed to initiate call' }
      }

      logger.info('Call initiated:', data.sid)
      return { success: true, callSid: data.sid, status: data.status }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('startCall error:', msg)
      return { success: false, error: msg }
    }
  }

  /** Handle webhook for incoming calls and return TwiML */
  handleIncomingCall(greetingMessage?: string, workflowId?: string): string {
    const greeting =
      greetingMessage || this.config.greetingMessage || 'Hello, how can I help you today?'
    const gatherUrl =
      `${this.config.webhookBaseUrl}/api/voice/webhook?action=gather` +
      (workflowId ? `&workflowId=${encodeURIComponent(workflowId)}` : '')

    return this.generateTwiML('greeting', {
      message: greeting,
      gatherUrl,
    })
  }

  /** STT -> AI Processing -> TTS pipeline */
  async processVoiceInput(
    speechResult: string,
    workflowId?: string,
    callSid?: string
  ): Promise<string> {
    try {
      logger.info(`Processing voice input for call ${callSid}: "${speechResult}"`)

      // In production this would invoke the workflow execution engine.
      // For now we return a TwiML that speaks a placeholder and re-gathers.
      const aiResponse = await this.getAIResponse(speechResult, workflowId)

      const gatherUrl =
        `${this.config.webhookBaseUrl}/api/voice/webhook?action=gather` +
        (workflowId ? `&workflowId=${encodeURIComponent(workflowId)}` : '')

      return this.generateTwiML('conversation', {
        message: aiResponse,
        gatherUrl,
      })
    } catch (error) {
      logger.error('processVoiceInput error:', error)
      return this.generateTwiML('conversation', {
        message: 'I encountered an error processing your request. Please try again.',
        gatherUrl: `${this.config.webhookBaseUrl}/api/voice/webhook?action=gather`,
      })
    }
  }

  /** Generate TwiML responses for various call states */
  generateTwiML(state: CallState, options: Record<string, string> = {}): string {
    switch (state) {
      case 'greeting':
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          `  <Say voice="Polly.Joanna">${escapeXml(options.message || 'Hello')}</Say>`,
          `  <Gather input="speech" action="${escapeXml(options.gatherUrl || '')}" method="POST" speechTimeout="auto" language="en-US">`,
          '    <Say voice="Polly.Joanna">Please go ahead.</Say>',
          '  </Gather>',
          '  <Say voice="Polly.Joanna">I didn\'t hear anything. Goodbye.</Say>',
          '</Response>',
        ].join('\n')

      case 'conversation':
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          `  <Say voice="Polly.Joanna">${escapeXml(options.message || '')}</Say>`,
          `  <Gather input="speech" action="${escapeXml(options.gatherUrl || '')}" method="POST" speechTimeout="auto" language="en-US">`,
          '    <Say voice="Polly.Joanna">Is there anything else?</Say>',
          '  </Gather>',
          '  <Say voice="Polly.Joanna">Thank you for calling. Goodbye.</Say>',
          '</Response>',
        ].join('\n')

      case 'hold':
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          '  <Say voice="Polly.Joanna">Please hold while I transfer you.</Say>',
          `  <Play loop="3">${escapeXml(options.holdMusicUrl || '')}</Play>`,
          '</Response>',
        ].join('\n')

      case 'voicemail':
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          `  <Say voice="Polly.Joanna">${escapeXml(options.message || 'Please leave a message after the beep.')}</Say>`,
          `  <Record maxLength="120" action="${escapeXml(options.callbackUrl || '')}" transcribe="true" />`,
          '</Response>',
        ].join('\n')

      case 'transferring':
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          '  <Say voice="Polly.Joanna">Transferring you now.</Say>',
          `  <Dial>${escapeXml(options.transferTo || '')}</Dial>`,
          '</Response>',
        ].join('\n')

      case 'ended':
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          `  <Say voice="Polly.Joanna">${escapeXml(options.message || 'Thank you for calling. Goodbye.')}</Say>`,
          '  <Hangup/>',
          '</Response>',
        ].join('\n')

      default:
        return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'
    }
  }

  /** Transfer the call to a human agent */
  async transferCall(callSid: string, transferTo: string): Promise<CallResult> {
    try {
      const twiml = this.generateTwiML('transferring', { transferTo })

      const body = new URLSearchParams()
      body.append('Twiml', twiml)

      const response = await fetch(`${this.twilioBaseUrl}/Calls/${callSid}.json`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      const data = await response.json()
      if (!response.ok) {
        return { success: false, error: data.message || 'Transfer failed' }
      }

      logger.info(`Call ${callSid} transferred to ${transferTo}`)
      return { success: true, callSid, status: 'transferring' }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('transferCall error:', msg)
      return { success: false, error: msg }
    }
  }

  /** Gracefully end the call */
  async endCall(callSid: string, farewellMessage?: string): Promise<CallResult> {
    try {
      const twiml = this.generateTwiML('ended', {
        message: farewellMessage || 'Thank you for calling. Goodbye.',
      })

      const body = new URLSearchParams()
      body.append('Twiml', twiml)
      body.append('Status', 'completed')

      const response = await fetch(`${this.twilioBaseUrl}/Calls/${callSid}.json`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      const data = await response.json()
      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to end call' }
      }

      logger.info(`Call ${callSid} ended`)
      return { success: true, callSid, status: 'completed' }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('endCall error:', msg)
      return { success: false, error: msg }
    }
  }

  /** Get AI response for the given user input (integrates with workflow engine) */
  private async getAIResponse(userInput: string, _workflowId?: string): Promise<string> {
    // Placeholder: in production, this would trigger the workflow execution engine
    // passing the transcribed speech as input and returning the AI-generated response.
    logger.info(`AI processing input: "${userInput}"`)
    return `I heard you say: "${userInput}". How else can I help?`
  }
}

/** Escape special XML characters to prevent injection in TwiML */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
