import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'

const logger = createLogger('WhatsAppListPhoneNumbersTool')

export interface WhatsAppListPhoneNumbersParams {
  accessToken: string
  businessAccountId?: string
}

export interface WhatsAppPhoneNumber {
  id: string
  display_phone_number: string
  verified_name: string
  code_verification_status: string
  quality_rating: string
  platform: string
  throughput: {
    level: string
  }
}

export interface WhatsAppBusinessAccount {
  id: string
  name: string
  phone_numbers: WhatsAppPhoneNumber[]
}

export interface WhatsAppListPhoneNumbersResponse {
  success: boolean
  output: {
    business_accounts: WhatsAppBusinessAccount[]
    phone_numbers: WhatsAppPhoneNumber[]
  }
  error?: string
}

export const listPhoneNumbersTool: ToolConfig<
  WhatsAppListPhoneNumbersParams,
  WhatsAppListPhoneNumbersResponse
> = {
  id: 'whatsapp_list_phone_numbers',
  name: 'WhatsApp List Phone Numbers',
  description: 'Get list of WhatsApp Business Phone Numbers',
  version: '1.0.0',

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Meta Business Access Token',
      requiredForToolCall: true,
    },
    businessAccountId: {
      type: 'string',
      required: false,
      description: 'Specific WhatsApp Business Account ID',
    },
  },

  request: {
    url: (params) => {
      if (params.businessAccountId) {
        return `https://graph.facebook.com/v24.0/${params.businessAccountId}/phone_numbers`
      }
      return 'https://graph.facebook.com/v24.0/me/businesses'
    },
    method: 'GET',
    headers: (params) => ({
      Authorization: `Bearer ${params.accessToken}`,
    }),
    query: (params) => {
      if (params.businessAccountId) {
        return {
          fields:
            'id,display_phone_number,verified_name,code_verification_status,quality_rating,platform,throughput',
        }
      }
      return {
        fields:
          'id,name,whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,code_verification_status,quality_rating,platform,throughput}}',
      }
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        data.error?.message || `Failed to fetch WhatsApp phone numbers (HTTP ${response.status})`
      logger.error('WhatsApp API error:', data)
      throw new Error(errorMessage)
    }

    let business_accounts: WhatsAppBusinessAccount[] = []
    let phone_numbers: WhatsAppPhoneNumber[] = []

    if (data.data && Array.isArray(data.data)) {
      if (data.data[0]?.display_phone_number) {
        // Direct phone numbers query
        phone_numbers = data.data
      } else {
        // Business accounts query
        business_accounts = data.data
          .filter((business: any) => business.whatsapp_business_accounts)
          .flatMap((business: any) => business.whatsapp_business_accounts)

        phone_numbers = business_accounts.flatMap((account) => account.phone_numbers || [])
      }
    }

    return {
      success: true,
      output: {
        business_accounts,
        phone_numbers,
      },
      error: undefined,
    }
  },

  transformError: (error) => {
    logger.error('WhatsApp list phone numbers error:', { error })
    return `Failed to fetch WhatsApp phone numbers: ${error.message || 'Unknown error occurred'}`
  },
}
