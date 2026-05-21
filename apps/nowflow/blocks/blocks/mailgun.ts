import { MailgunIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const MailgunBlock = defineBlock({
  type: 'mailgun',
  name: 'Mailgun',
  description: 'Powerful email API service for sending, receiving, and tracking emails.',
  longDescription:
    'Integrate with Mailgun to send transactional emails, manage mailing lists, track email performance, and handle inbound email routing. Mailgun is a developer-focused email service used by thousands of companies to send billions of emails with powerful APIs, flexible webhooks, and detailed analytics.',
  category: 'tools',
  bgColor: '#F06B66',
  icon: MailgunIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Mailgun API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Mailgun private API key',
      password: true,
    },
    {
      id: 'domain',
      title: 'Domain',
      type: 'short-input',
      layout: 'full',
      placeholder: 'mg.yourdomain.com',
    },
    {
      id: 'region',
      title: 'Region',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'US', label: 'US' },
        { id: 'EU', label: 'EU' },
      ],
      value: () => 'US',
    },
    createOperationDropdown({
      operations: [
        { id: 'send_email', label: 'Send Email' },
        { id: 'send_batch', label: 'Send Batch Emails' },
        { id: 'validate_email', label: 'Validate Email' },
        { id: 'get_stats', label: 'Get Stats' },
        { id: 'list_events', label: 'List Events' },
      ],
      defaultValue: 'send_email',
    }),
    {
      id: 'from',
      title: 'From',
      type: 'short-input',
      layout: 'half',
      placeholder: 'sender@yourdomain.com',
      condition: { field: 'operation', value: ['send_email', 'send_batch'] },
    },
    {
      id: 'to',
      title: 'To',
      type: 'short-input',
      layout: 'half',
      placeholder: 'recipient@example.com',
      condition: { field: 'operation', value: ['send_email', 'validate_email'] },
    },
    {
      id: 'subject',
      title: 'Subject',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Email subject',
      condition: { field: 'operation', value: ['send_email', 'send_batch'] },
    },
    {
      id: 'text',
      title: 'Text Body',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Plain text email body',
      condition: { field: 'operation', value: ['send_email', 'send_batch'] },
    },
    {
      id: 'html',
      title: 'HTML Body',
      type: 'code',
      layout: 'full',
      language: 'text',
      placeholder: '<html><body>HTML email content</body></html>',
      condition: { field: 'operation', value: ['send_email', 'send_batch'] },
    },
    {
      id: 'recipientVariables',
      title: 'Recipient Variables (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"user@example.com": {"name": "John", "id": "123"}}',
      condition: { field: 'operation', value: 'send_batch' },
    },
  ],
  tools: {
    access: ['mailgun_api'],
    config: {
      tool: () => 'mailgun_api',
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    domain: { type: 'string', required: true },
    region: { type: 'string', required: false },
    operation: { type: 'string', required: true },
    from: { type: 'string', required: false },
    to: { type: 'string', required: false },
    subject: { type: 'string', required: false },
    text: { type: 'string', required: false },
    html: { type: 'string', required: false },
    recipientVariables: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
