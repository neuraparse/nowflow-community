import { ToolConfig } from '../types'
import { OutlookMailSendResponse } from './types'

export interface OutlookMailSendParams {
  credential: string
  accessToken?: string
  to: string
  subject: string
  body: string
  contentType?: 'HTML' | 'Text'
  cc?: string
  bcc?: string
}

export const outlook_mail_send: ToolConfig<
  OutlookMailSendParams,
  { success: boolean; output: { result: OutlookMailSendResponse }; error?: string }
> = {
  id: 'outlook_mail_send',
  name: 'Outlook Mail Send',
  description: 'Send an email via Outlook using Microsoft Graph API',
  version: '1.0.0',
  oauth: {
    required: true,
    provider: 'microsoft-outlook',
    additionalScopes: ['https://graph.microsoft.com/Mail.Send'],
  },
  params: {
    credential: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'OAuth credential ID for Outlook',
    },
    accessToken: {
      type: 'string',
      required: false,
      description: 'Access token (resolved from credential)',
    },
    to: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Recipient email address (comma-separated for multiple)',
    },
    subject: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Email subject',
    },
    body: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Email body content',
    },
    contentType: {
      type: 'string',
      required: false,
      description: 'Content type: HTML or Text',
      default: 'HTML',
    },
    cc: {
      type: 'string',
      required: false,
      description: 'CC recipients (comma-separated)',
    },
    bcc: {
      type: 'string',
      required: false,
      description: 'BCC recipients (comma-separated)',
    },
  },
  request: {
    url: () => 'https://graph.microsoft.com/v1.0/me/sendMail',
    method: 'POST',
    headers: (params) => {
      if (!params.accessToken) throw new Error('Access token is required')

      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    },
    body: (params) => {
      const toRecipients = params.to.split(',').map((email) => ({
        emailAddress: { address: email.trim() },
      }))

      const ccRecipients = params.cc
        ? params.cc.split(',').map((email) => ({ emailAddress: { address: email.trim() } }))
        : []

      const bccRecipients = params.bcc
        ? params.bcc.split(',').map((email) => ({ emailAddress: { address: email.trim() } }))
        : []

      return {
        message: {
          subject: params.subject,
          body: {
            contentType: params.contentType || 'HTML',
            content: params.body,
          },
          toRecipients,
          ...(ccRecipients.length > 0 ? { ccRecipients } : {}),
          ...(bccRecipients.length > 0 ? { bccRecipients } : {}),
        },
        saveToSentItems: true,
      }
    },
  },
  transformResponse: async (response) => {
    // Log response for debugging
    console.log('[Outlook Send] Response status:', response.status)

    // Handle successful responses
    if (response.status === 202 || response.status === 200) {
      return {
        success: true,
        output: { result: { success: true, message: 'Email sent successfully' } },
        error: undefined,
      }
    }

    // Handle error responses
    let errorData: any = null
    try {
      errorData = await response.json()
      console.error('[Outlook Send] Error response:', JSON.stringify(errorData, null, 2))
    } catch (e) {
      console.error('[Outlook Send] Failed to parse error response:', e)
    }

    // Throw error with details for transformError to handle
    const errorMessage =
      errorData?.error?.message ||
      errorData?.error_description ||
      `HTTP ${response.status}: ${response.statusText}`
    throw new Error(errorMessage)
  },

  transformError: (error) => {
    // Log the full error for debugging
    console.error('[Outlook Send] Error details:', JSON.stringify(error, null, 2))

    // Handle Microsoft Graph API error format
    if (error.error?.message) {
      const errorMessage = error.error.message

      // Authentication errors
      if (
        errorMessage.includes('invalid authentication credentials') ||
        errorMessage.includes('Invalid Credentials') ||
        errorMessage.includes('UnauthorizedAccessException') ||
        errorMessage.includes('Access token has expired') ||
        errorMessage.includes('CompactToken parsing failed')
      ) {
        return 'Outlook authentication failed. Please reconnect your Outlook account in Settings → Integrations, then try again.'
      }

      // Mailbox not found errors
      if (
        errorMessage.includes('MailboxNotEnabledForRESTAPI') ||
        errorMessage.includes('MailboxNotFound') ||
        errorMessage.includes('ErrorMailboxStoreUnavailable')
      ) {
        return 'Outlook mailbox not found or not enabled. Please ensure you have a valid Microsoft 365 license with Exchange Online.'
      }

      // Permission errors
      if (
        errorMessage.includes('Insufficient privileges') ||
        errorMessage.includes('Access Denied')
      ) {
        return 'Insufficient permissions to send email. Please reconnect your Outlook account and grant the required permissions.'
      }

      // Quota errors
      if (errorMessage.includes('quota') || errorMessage.includes('throttled')) {
        return 'Outlook API quota exceeded. Please try again later.'
      }

      // Invalid recipient
      if (
        errorMessage.includes('Invalid recipient') ||
        errorMessage.includes('recipient address')
      ) {
        return 'Invalid recipient email address. Please check the "To" field.'
      }

      // Return the error message as-is
      return errorMessage
    }

    // Handle other error formats
    if (error.message) {
      if (
        error.message.includes('invalid authentication credentials') ||
        error.message.includes('Invalid Credentials') ||
        error.message.includes('401')
      ) {
        return 'Outlook authentication failed. Please reconnect your Outlook account in Settings → Integrations, then try again.'
      }
      if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        return 'Microsoft Graph API error. This may indicate: (1) Your account lacks a Microsoft 365 license with Exchange Online, (2) Your mailbox is not yet provisioned, or (3) Insufficient API permissions. Please verify your account settings and try again.'
      }
      return error.message
    }

    // Fallback error message
    return 'An unexpected error occurred while sending email. Please check your credentials and try again.'
  },
}
