import { ToolConfig } from '../types'
import { GmailSendParams, GmailToolResponse } from './types'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Convert a string to base64url encoding (RFC 4648)
 * This is required by Gmail API for the raw message format
 */
function toBase64Url(str: string): string {
  // First convert to base64
  const base64 = Buffer.from(str).toString('base64')
  // Then convert to base64url by replacing characters and removing padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Safely converts a value to a string for use as email body.
 * Handles agent response objects, plain strings, and other types.
 */
function toBodyString(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    // Agent response objects typically have a `content` field with the actual text
    if (typeof value.content === 'string') return value.content
    // Fallback: stringify the object so the user gets readable JSON instead of [Object object]
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export const gmailSendTool: ToolConfig<GmailSendParams, GmailToolResponse> = {
  id: 'gmail_send',
  name: 'Gmail Send',
  description: 'Send emails using Gmail',
  version: '1.0.0',

  oauth: {
    required: true,
    provider: 'google-email',
    additionalScopes: ['https://www.googleapis.com/auth/gmail.send'],
  },

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Access token for Gmail API',
    },
    to: {
      type: 'string',
      required: true,
      description: 'Recipient email address',
    },
    subject: {
      type: 'string',
      required: true,
      description: 'Email subject',
    },
    body: {
      type: 'string',
      required: true,
      description: 'Email body content',
    },
  },

  request: {
    url: () => `${GMAIL_API_BASE}/messages/send`,
    method: 'POST',
    headers: (params: GmailSendParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
    body: (params: GmailSendParams): Record<string, any> => {
      const email = [
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        '',
        toBodyString(params.body),
      ].join('\n')

      return {
        raw: toBase64Url(email),
      }
    },
  },

  transformResponse: async (response) => {
    let data: any
    try {
      data = await response.json()
    } catch (e) {
      console.error('[Gmail Send] Failed to parse response as JSON:', e)
      throw new Error('Invalid response from Gmail API')
    }

    console.log('[Gmail Send] Response status:', response.status)
    console.log('[Gmail Send] Response data:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[Gmail Send] API error response:', JSON.stringify(data, null, 2))
      throw new Error(data.error?.message || 'Failed to send email')
    }

    return {
      success: true,
      output: {
        content: 'Email sent successfully',
        metadata: {
          id: data.id,
          threadId: data.threadId,
          labelIds: data.labelIds,
        },
      },
    }
  },

  transformError: (error) => {
    // Log the full error for debugging
    console.error('[Gmail Send] Error details:', JSON.stringify(error, null, 2))

    // Handle Google API error format
    if (error.error?.message) {
      const errorMessage = error.error.message
      if (
        errorMessage.includes('invalid authentication credentials') ||
        errorMessage.includes('Invalid Credentials')
      ) {
        return 'Gmail authentication failed. Please reconnect your Gmail account in Settings → Integrations, then try again.'
      }
      if (errorMessage.includes('quota')) {
        return 'Gmail API quota exceeded. Please try again later.'
      }
      if (errorMessage.includes('Invalid to header')) {
        return 'Invalid recipient email address. Please check the "To" field.'
      }
      if (errorMessage.includes('Recipient address required')) {
        return 'Recipient email address is required.'
      }
      return errorMessage
    }

    // Handle other error formats
    if (error.message) {
      if (
        error.message.includes('invalid authentication credentials') ||
        error.message.includes('Invalid Credentials')
      ) {
        return 'Gmail authentication failed. Please reconnect your Gmail account in Settings → Integrations, then try again.'
      }
      return error.message
    }

    // Fallback error message
    return 'An unexpected error occurred while sending email. Please check your credentials and try again.'
  },
}
