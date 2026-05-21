import { ToolConfig } from '../types'
import { GmailReplyParams, GmailToolResponse } from './types'

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

export const gmailReplyTool: ToolConfig<GmailReplyParams, GmailToolResponse> = {
  id: 'gmail_reply',
  name: 'Gmail Reply',
  description: 'Reply to an email in Gmail',
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
      description: 'ID of the message to reply to',
    },
    body: {
      type: 'string',
      required: true,
      description: 'Reply body content',
    },
    replyAll: {
      type: 'boolean',
      required: false,
      description: 'Reply to all recipients',
    },
  },

  // We need directExecution because reply requires fetching the original message first
  request: {
    url: () => `${GMAIL_API_BASE}/messages/send`,
    method: 'POST',
    headers: (params: GmailReplyParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
  },

  directExecution: async (params: GmailReplyParams): Promise<GmailToolResponse> => {
    // Step 1: Fetch the original message to get threadId and headers
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
    const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || ''
    const messageIdHeader =
      headers.find((h: any) => h.name.toLowerCase() === 'message-id')?.value || ''
    const references = headers.find((h: any) => h.name.toLowerCase() === 'references')?.value || ''

    // Determine reply recipients
    let replyTo = from
    if (params.replyAll) {
      // Combine from and to, removing duplicates
      const allRecipients = [from, to].filter(Boolean).join(', ')
      replyTo = allRecipients
    }

    // Build reply subject
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`

    // Build References header for threading
    const referencesHeader = references ? `${references} ${messageIdHeader}` : messageIdHeader

    // Step 2: Construct RFC 2822 reply email
    const emailLines = [
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      `To: ${replyTo}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageIdHeader}`,
      `References: ${referencesHeader}`,
      '',
      toBodyString(params.body),
    ]

    const email = emailLines.join('\n')

    // Step 3: Send the reply in the same thread
    const sendResponse = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: toBase64Url(email),
        threadId: originalMessage.threadId,
      }),
    })

    const sendData = await sendResponse.json()

    if (!sendResponse.ok) {
      throw new Error(sendData.error?.message || 'Failed to send reply')
    }

    return {
      success: true,
      output: {
        content: `Reply sent successfully${params.replyAll ? ' (to all)' : ''}`,
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
      throw new Error(data.error?.message || 'Failed to send reply')
    }

    return {
      success: true,
      output: {
        content: 'Reply sent successfully',
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
      return error.error.message
    }
    return error.message || 'An unexpected error occurred while sending reply'
  },
}
