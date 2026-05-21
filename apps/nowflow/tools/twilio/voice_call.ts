import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('Twilio Voice Call Tool')

export interface TwilioVoiceCallParams {
  action: 'make_call' | 'answer_call' | 'transfer_call' | 'end_call' | 'play_audio' | 'gather_input'
  accountSid: string
  authToken: string
  fromNumber: string
  toNumber?: string
  callSid?: string
  twimlUrl?: string
  transferTo?: string
  audioUrl?: string
  message?: string
  gatherInput?: 'speech' | 'dtmf' | 'speech dtmf'
  gatherTimeout?: number
  webhookUrl?: string
}

export interface TwilioVoiceCallOutput extends ToolResponse {
  output: {
    success: boolean
    callSid?: string
    status?: string
    error?: string
  }
}

export const voiceCallTool: ToolConfig<TwilioVoiceCallParams, TwilioVoiceCallOutput> = {
  id: 'twilio_voice_call',
  name: 'Twilio Voice Call',
  description: 'Make and manage voice calls using the Twilio API.',
  version: '1.0.0',

  params: {
    action: {
      type: 'string',
      required: true,
      description:
        'Action to perform: make_call, answer_call, transfer_call, end_call, play_audio, gather_input',
    },
    accountSid: {
      type: 'string',
      required: true,
      description: 'Twilio Account SID',
      requiredForToolCall: true,
    },
    authToken: {
      type: 'string',
      required: true,
      description: 'Twilio Auth Token',
      requiredForToolCall: true,
    },
    fromNumber: {
      type: 'string',
      required: true,
      description: 'Twilio phone number to place the call from',
    },
    toNumber: {
      type: 'string',
      required: false,
      description: 'Destination phone number (required for make_call)',
    },
    callSid: {
      type: 'string',
      required: false,
      description:
        'Call SID for modifying an in-progress call (transfer, end, play_audio, gather_input)',
    },
    twimlUrl: {
      type: 'string',
      required: false,
      description: 'URL returning TwiML instructions for the call',
    },
    transferTo: {
      type: 'string',
      required: false,
      description: 'Phone number to transfer the call to',
    },
    audioUrl: {
      type: 'string',
      required: false,
      description: 'URL of audio file to play during the call',
    },
    message: {
      type: 'string',
      required: false,
      description: 'Text message to speak during the call (TTS)',
    },
    gatherInput: {
      type: 'string',
      required: false,
      default: 'speech',
      description: 'Type of input to gather: speech, dtmf, or both',
    },
    gatherTimeout: {
      type: 'number',
      required: false,
      default: 5,
      description: 'Seconds to wait for input before timing out',
    },
    webhookUrl: {
      type: 'string',
      required: false,
      description: 'Webhook URL for call status callbacks',
    },
  },

  request: {
    url: (params) => {
      if (!params.accountSid) throw new Error('Twilio Account SID is required')
      const base = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}`
      if (params.action === 'make_call') return `${base}/Calls.json`
      if (params.callSid) return `${base}/Calls/${params.callSid}.json`
      return `${base}/Calls.json`
    },
    method: 'POST',
    headers: (params) => {
      if (!params.accountSid || !params.authToken)
        throw new Error('Twilio credentials are required')
      const auth = Buffer.from(`${params.accountSid}:${params.authToken}`).toString('base64')
      return {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    },
    body: (params) => {
      const form = new URLSearchParams()

      switch (params.action) {
        case 'make_call': {
          if (!params.toNumber) throw new Error('toNumber is required for make_call')
          form.append('To', params.toNumber)
          form.append('From', params.fromNumber)
          if (params.twimlUrl) {
            form.append('Url', params.twimlUrl)
          } else {
            const msg = params.message || 'Hello, this is an automated call.'
            form.append('Twiml', `<Response><Say>${msg}</Say></Response>`)
          }
          if (params.webhookUrl) {
            form.append('StatusCallback', params.webhookUrl)
            form.append('StatusCallbackEvent', 'initiated ringing answered completed')
          }
          break
        }

        case 'answer_call': {
          const twiml = params.message
            ? `<Response><Say>${params.message}</Say></Response>`
            : '<Response><Say>Hello</Say></Response>'
          form.append('Twiml', twiml)
          break
        }

        case 'transfer_call': {
          if (!params.transferTo) throw new Error('transferTo is required for transfer_call')
          form.append(
            'Twiml',
            `<Response><Say>Transferring you now.</Say><Dial>${params.transferTo}</Dial></Response>`
          )
          break
        }

        case 'end_call': {
          form.append('Status', 'completed')
          break
        }

        case 'play_audio': {
          if (params.audioUrl) {
            form.append('Twiml', `<Response><Play>${params.audioUrl}</Play></Response>`)
          } else if (params.message) {
            form.append('Twiml', `<Response><Say>${params.message}</Say></Response>`)
          }
          break
        }

        case 'gather_input': {
          const inputType = params.gatherInput || 'speech'
          const timeout = params.gatherTimeout || 5
          const actionUrl = params.webhookUrl || ''
          form.append(
            'Twiml',
            `<Response><Gather input="${inputType}" timeout="${timeout}" action="${actionUrl}" method="POST">` +
              `<Say>${params.message || 'Please provide your input.'}</Say>` +
              `</Gather></Response>`
          )
          break
        }

        default:
          throw new Error(`Unknown action: ${params.action}`)
      }

      return { body: form.toString() }
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.message || `Twilio API error (HTTP ${response.status})`
      logger.error('Twilio voice API error:', data)
      throw new Error(errorMessage)
    }

    logger.info('Twilio voice response:', data.sid, data.status)
    return {
      success: true,
      output: {
        success: true,
        callSid: data.sid,
        status: data.status,
      },
      error: undefined,
    }
  },

  transformError: (error) => {
    logger.error('Twilio voice tool error:', { error })
    return `Voice call failed: ${error.message || 'Unknown error occurred'}`
  },
}
