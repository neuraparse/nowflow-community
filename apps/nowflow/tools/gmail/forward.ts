import { ToolConfig } from '../types'
import { GmailForwardParams, GmailToolResponse } from './types'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Convert a string to base64url encoding (RFC 4648)
 */
function toBase64Url(str: string): string {
  const base64 = Buffer.from(str).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Safely converts a value to a string for use as email body.
 */
function toBodyString(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    if (typeof value.content === 'string') return value.content
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export const gmailForwardTool: ToolConfig<GmailForwardParams, GmailToolResponse> = {
  id: 'gmail_forward',
  name: 'Gmail Forward',
  description: 'Forward an email in Gmail',
  version: '1.0.0',

  oauth: {
    required: true,
    provider: 'google-email',
    additionalScopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  },

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Access token for Gmail API',
    },
    messageId: {
      type: 'string',
      required: true,
      description: 'ID of the message to forward',
    },
    to: {
      type: 'string',
      required: true,
      description: 'Recipient email address to forward to',
    },
    body: {
      type: 'string',
      required: false,
      description: 'Optional additional message to include with the forwarded email',
    },
  },

  request: {
    url: () => `${GMAIL_API_BASE}/messages/send`,
    method: 'POST',
    headers: (params: GmailForwardParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
  },

  directExecution: async (params: GmailForwardParams): Promise<GmailToolResponse> => {
    // Step 1: Fetch the original message
    const messageResponse = await fetch(
      `${GMAIL_API_BASE}/messages/${params.messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!messageResponse.ok) {
      const errorData = await messageResponse.json()
      throw new Error(errorData.error?.message || 'Failed to fetch original message')
    }

    const originalMessage = await messageResponse.json()
    const headers = originalMessage.payload?.headers || []

    const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || ''
    const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || ''
    const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || ''
    const originalTo = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || ''

    // Extract original message body
    let originalBody = ''
    if (originalMessage.payload?.body?.data) {
      originalBody = Buffer.from(originalMessage.payload.body.data, 'base64').toString()
    } else if (originalMessage.payload?.parts) {
      const textPart = originalMessage.payload.parts.find(
        (part: any) => part.mimeType === 'text/plain'
      )
      if (textPart?.body?.data) {
        originalBody = Buffer.from(textPart.body.data, 'base64').toString()
      } else {
        const htmlPart = originalMessage.payload.parts.find(
          (part: any) => part.mimeType === 'text/html'
        )
        if (htmlPart?.body?.data) {
          originalBody = Buffer.from(htmlPart.body.data, 'base64').toString()
        }
      }
    }

    // Build forward subject
    const fwdSubject = subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`

    // Build forwarded message content
    const forwardedContent = [
      toBodyString(params.body),
      '',
      '---------- Forwarded message ----------',
      `From: ${from}`,
      `Date: ${date}`,
      `Subject: ${subject}`,
      `To: ${originalTo}`,
      '',
      originalBody,
    ].join('\n')

    // Step 2: Construct RFC 2822 forwarded email
    const email = [
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      `To: ${params.to}`,
      `Subject: ${fwdSubject}`,
      '',
      forwardedContent,
    ].join('\n')

    // Step 3: Send the forwarded email
    const sendResponse = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: toBase64Url(email),
      }),
    })

    const sendData = await sendResponse.json()

    if (!sendResponse.ok) {
      throw new Error(sendData.error?.message || 'Failed to forward email')
    }

    return {
      success: true,
      output: {
        content: `Email forwarded successfully to ${params.to}`,
        metadata: {
          id: sendData.id,
          threadId: sendData.threadId,
          labelIds: sendData.labelIds,
        },
      },
    }
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to forward email')
    }

    return {
      success: true,
      output: {
        content: 'Email forwarded successfully',
        metadata: {
          id: data.id,
          threadId: data.threadId,
          labelIds: data.labelIds,
        },
      },
    }
  },

  transformError: (error) => {
    if (error.error?.message) {
      if (
        error.error.message.includes('invalid authentication credentials') ||
        error.error.message.includes('Invalid Credentials')
      ) {
        return 'Gmail authentication failed. Please reconnect your Gmail account in Settings → Integrations, then try again.'
      }
      if (error.error.message.includes('Not Found')) {
        return 'Original message not found. Please check the message ID.'
      }
      if (error.error.message.includes('Invalid to header')) {
        return 'Invalid recipient email address. Please check the "To" field.'
      }
      return error.error.message
    }
    return error.message || 'An unexpected error occurred while forwarding email'
  },
}
