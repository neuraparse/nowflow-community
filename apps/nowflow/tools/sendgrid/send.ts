import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { SendGridOutput, SendGridParams } from './types'

const logger = createLogger('SendGrid Tool')

export const sendGridSendTool: ToolConfig<SendGridParams, SendGridOutput> = {
  id: 'sendgrid_send',
  name: 'SendGrid Email',
  description:
    'Send emails and manage contacts using SendGrid API v3. Supports templates and dynamic content.',
  version: '1.0.0',

  params: {
    apiKey: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'SendGrid API Key',
    },
    operation: {
      type: 'string',
      required: true,
      description: 'Operation to perform',
    },
    to: {
      type: 'string',
      required: false,
      description: 'Recipient email address(es), comma-separated for multiple',
    },
    from: {
      type: 'string',
      required: false,
      description: 'Sender email address (must be verified in SendGrid)',
    },
    fromName: {
      type: 'string',
      required: false,
      description: 'Sender display name',
    },
    subject: {
      type: 'string',
      required: false,
      description: 'Email subject line',
    },
    htmlContent: {
      type: 'string',
      required: false,
      description: 'HTML content of the email',
    },
    textContent: {
      type: 'string',
      required: false,
      description: 'Plain text content of the email',
    },
    templateId: {
      type: 'string',
      required: false,
      description: 'SendGrid Dynamic Template ID (d-xxxxx)',
    },
    dynamicTemplateData: {
      type: 'object',
      required: false,
      description: 'Dynamic data for template variables',
    },
    email: {
      type: 'string',
      required: false,
      description: 'Contact email for add_contact',
    },
    firstName: {
      type: 'string',
      required: false,
      description: 'Contact first name',
    },
    lastName: {
      type: 'string',
      required: false,
      description: 'Contact last name',
    },
    listIds: {
      type: 'array',
      required: false,
      description: 'List IDs to add contact to',
    },
  },

  request: {
    url: (params) => {
      const baseUrl = 'https://api.sendgrid.com/v3'
      switch (params.operation) {
        case 'send_email':
        case 'send_template':
          return `${baseUrl}/mail/send`
        case 'list_contacts':
          return `${baseUrl}/marketing/contacts`
        case 'add_contact':
          return `${baseUrl}/marketing/contacts`
        default:
          return `${baseUrl}/mail/send`
      }
    },
    method: (params) => {
      switch (params.operation) {
        case 'list_contacts':
          return 'GET'
        default:
          return 'PUT' // SendGrid uses PUT for add_contact, POST for send
      }
    },
    headers: (params) => ({
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    }),
    body: (params) => {
      if (params.operation === 'send_email' || params.operation === 'send_template') {
        const recipients = params.to?.split(',').map((email) => ({ email: email.trim() })) || []
        const body: any = {
          personalizations: [{ to: recipients }],
          from: { email: params.from, name: params.fromName || params.from },
        }

        if (params.operation === 'send_template' && params.templateId) {
          body.template_id = params.templateId
          if (params.dynamicTemplateData) {
            body.personalizations[0].dynamic_template_data = params.dynamicTemplateData
          }
        } else {
          body.subject = params.subject
          body.content = []
          if (params.textContent)
            body.content.push({ type: 'text/plain', value: params.textContent })
          if (params.htmlContent)
            body.content.push({ type: 'text/html', value: params.htmlContent })
        }
        return body
      }

      if (params.operation === 'add_contact') {
        return {
          list_ids: params.listIds || [],
          contacts: [
            {
              email: params.email,
              first_name: params.firstName,
              last_name: params.lastName,
              ...params.customFields,
            },
          ],
        }
      }

      return {}
    },
  },

  transformResponse: async (response) => {
    // SendGrid returns 202 for successful email send with no body
    if (response.status === 202) {
      const messageId = response.headers.get('X-Message-Id') || 'sent'
      return { success: true, messageId, data: { status: 'accepted' } }
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      logger.error('SendGrid API error:', data)
      throw new Error(data.errors?.[0]?.message || `SendGrid error: ${response.status}`)
    }
    return { success: true, data }
  },

  transformError: (error) => {
    logger.error('SendGrid tool error:', error)
    return `SendGrid operation failed: ${error.message || 'Unknown error'}`
  },
}
