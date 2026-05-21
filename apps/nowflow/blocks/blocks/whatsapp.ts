import { WhatsAppIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface WhatsAppBlockOutput extends ToolResponse {
  output: {
    success: boolean
    messageId?: string
    error?: string
  }
}

export const WhatsAppBlock: BlockConfig<WhatsAppBlockOutput> = {
  type: 'whatsapp',
  name: 'WhatsApp',
  description: 'Send WhatsApp messages',
  longDescription:
    'Send messages to WhatsApp users using the WhatsApp Business API. Requires WhatsApp Business API configuration.',
  category: 'tools',
  bgColor: '#25D366',
  icon: WhatsAppIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'WhatsApp Business Account',
      type: 'oauth-input',
      layout: 'full',
      provider: 'meta-whatsapp',
      serviceId: 'meta-whatsapp',
      requiredScopes: [
        'whatsapp_business_messaging',
        'whatsapp_business_management',
        'business_management',
      ],
      placeholder: 'Select Meta account for WhatsApp Business',
    },
    {
      id: 'action',
      title: 'Action',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'list_phone_numbers', label: 'List Phone Numbers' },
        { id: 'send_message', label: 'Send Message' },
      ],
    },
    {
      id: 'businessAccountId',
      title: 'WhatsApp Business Account ID (Optional)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'WhatsApp Business Account ID (WABA ID)',
      condition: { field: 'action', value: 'list_phone_numbers' },
    },
    {
      id: 'phoneNumber',
      title: 'Recipient Phone Number',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter phone number with country code (e.g., +1234567890)',
      condition: { field: 'action', value: 'send_message' },
    },
    {
      id: 'message',
      title: 'Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter your message',
      condition: { field: 'action', value: 'send_message' },
    },
    {
      id: 'phoneNumberId',
      title: 'WhatsApp Phone Number ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Your WhatsApp Business Phone Number ID',
      condition: { field: 'action', value: 'send_message' },
    },
  ],
  tools: {
    access: ['whatsapp_send_message', 'whatsapp_list_phone_numbers'],
    config: {
      tool: (params) => {
        switch (params.action) {
          case 'list_phone_numbers':
            return 'whatsapp_list_phone_numbers'
          case 'send_message':
          default:
            return 'whatsapp_send_message'
        }
      },
      params: (params) => {
        const { credential, phoneNumber, message, phoneNumberId, businessAccountId, action } =
          params

        if (action === 'list_phone_numbers') {
          return {
            accessToken: credential?.accessToken,
            businessAccountId: businessAccountId?.trim() || undefined,
          }
        }

        return {
          phoneNumber,
          message,
          phoneNumberId,
          accessToken: credential?.accessToken,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'json', required: true },
    action: { type: 'string', required: true },
    businessAccountId: { type: 'string', required: false },
    phoneNumber: { type: 'string', required: false },
    message: { type: 'string', required: false },
    phoneNumberId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        messageId: 'string',
        error: 'string',
      },
    },
  },
}
