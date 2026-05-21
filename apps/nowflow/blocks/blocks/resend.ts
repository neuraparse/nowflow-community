import { ResendIcon } from '@/components/icons'
import { createOperationDropdown, createSimpleToolConfig, defineBlock } from '../helpers'

export const ResendBlock = defineBlock({
  type: 'resend',
  name: 'Resend',
  description: 'Modern email API for developers',
  longDescription:
    'Integrate with Resend for transactional emails, developer-friendly email infrastructure, React email templates, and email analytics. Built for modern development workflows with API key authentication.',
  category: 'tools',
  bgColor: '#000000',
  icon: ResendIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Resend API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Resend API key',
    },
    createOperationDropdown({
      operations: [
        { id: 'send_email', label: 'Send Email' },
        { id: 'get_email', label: 'Get Email' },
        { id: 'list_emails', label: 'List Emails' },
        { id: 'create_domain', label: 'Create Domain' },
        { id: 'list_domains', label: 'List Domains' },
        { id: 'create_api_key', label: 'Create API Key' },
        { id: 'list_api_keys', label: 'List API Keys' },
      ],
      defaultValue: 'send_email',
    }),
    {
      id: 'from',
      title: 'From',
      type: 'short-input',
      layout: 'full',
      placeholder: 'you@example.com',
      condition: { field: 'operation', value: 'send_email' },
    },
    {
      id: 'to',
      title: 'To',
      type: 'short-input',
      layout: 'full',
      placeholder: 'recipient@example.com',
      condition: { field: 'operation', value: 'send_email' },
    },
    {
      id: 'subject',
      title: 'Subject',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Email subject',
      condition: { field: 'operation', value: 'send_email' },
    },
    {
      id: 'html',
      title: 'HTML Content',
      type: 'long-input',
      layout: 'full',
      placeholder: '<p>Email content</p>',
      condition: { field: 'operation', value: 'send_email' },
    },
    {
      id: 'emailId',
      title: 'Email ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter email ID',
      condition: { field: 'operation', value: 'get_email' },
    },
    {
      id: 'domainName',
      title: 'Domain Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'example.com',
      condition: { field: 'operation', value: 'create_domain' },
    },
  ],
  tools: {
    access: ['resend_api'],
    config: createSimpleToolConfig('resend_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    from: { type: 'string', required: false },
    to: { type: 'string', required: false },
    subject: { type: 'string', required: false },
    html: { type: 'string', required: false },
    emailId: { type: 'string', required: false },
    domainName: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
