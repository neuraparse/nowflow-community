import { VonageIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const VonageBlock: BlockConfig = {
  type: 'vonage',
  name: 'Vonage',
  description: 'Send SMS, make voice calls, and manage communications',
  longDescription:
    'Integrate with Vonage Communications APIs to send SMS messages, make voice calls, verify phone numbers, and access video conferencing features. Power your communications with enterprise-grade API platform.',
  category: 'tools',
  bgColor: '#000000',
  icon: VonageIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Vonage Credentials',
      type: 'oauth-input',
      layout: 'full',
      provider: 'vonage',
      serviceId: 'vonage',
      requiredScopes: ['messages', 'voice', 'verify'],
      placeholder: 'Select Vonage account',
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'send_sms', label: 'Send SMS' },
        { id: 'send_whatsapp', label: 'Send WhatsApp Message' },
        { id: 'send_rcs', label: 'Send RCS Message' },
        { id: 'verify_number', label: 'Verify Phone Number' },
        { id: 'check_verification', label: 'Check Verification' },
        { id: 'make_voice_call', label: 'Make Voice Call' },
        { id: 'get_call_info', label: 'Get Call Info' },
      ],
      value: () => 'send_sms',
    },
    {
      id: 'to',
      title: 'To (Phone Number)',
      type: 'short-input',
      layout: 'half',
      placeholder: '+1234567890',
      condition: {
        field: 'operation',
        value: ['send_sms', 'send_whatsapp', 'send_rcs', 'verify_number', 'make_voice_call'],
      },
    },
    {
      id: 'from',
      title: 'From (Sender ID)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'YourBrand or +1234567890',
      condition: {
        field: 'operation',
        value: ['send_sms', 'send_whatsapp', 'send_rcs', 'make_voice_call'],
      },
    },
    {
      id: 'message',
      title: 'Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Your message here',
      condition: { field: 'operation', value: ['send_sms', 'send_whatsapp', 'send_rcs'] },
    },
    {
      id: 'requestId',
      title: 'Request ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter verification request ID',
      condition: { field: 'operation', value: 'check_verification' },
    },
    {
      id: 'code',
      title: 'Verification Code',
      type: 'short-input',
      layout: 'half',
      placeholder: '1234',
      condition: { field: 'operation', value: 'check_verification' },
    },
    {
      id: 'callId',
      title: 'Call ID (UUID)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      condition: { field: 'operation', value: 'get_call_info' },
    },
  ],
  tools: {
    access: ['vonage_api'],
    config: {
      tool: () => 'vonage_api',
      params: (params) => {
        const { credential, ...rest } = params as Record<string, any>
        return {
          credential,
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    to: { type: 'string', required: false },
    from: { type: 'string', required: false },
    message: { type: 'string', required: false },
    requestId: { type: 'string', required: false },
    code: { type: 'string', required: false },
    callId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
}
