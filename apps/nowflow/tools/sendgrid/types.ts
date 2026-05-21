export interface SendGridParams {
  apiKey: string
  operation: 'send_email' | 'send_template' | 'list_contacts' | 'add_contact'
  // Email params
  to: string
  from: string
  fromName?: string
  subject?: string
  htmlContent?: string
  textContent?: string
  // Template params
  templateId?: string
  dynamicTemplateData?: Record<string, any>
  // Contact params
  email?: string
  firstName?: string
  lastName?: string
  customFields?: Record<string, any>
  listIds?: string[]
}

export interface SendGridOutput {
  success: boolean
  data?: any
  messageId?: string
  error?: string
}
