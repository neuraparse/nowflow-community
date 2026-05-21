import { ShieldCheck } from 'lucide-react'
import { BlockConfig } from '../types'

export const PIIMaskBlock: BlockConfig = {
  type: 'pii_mask',
  name: 'PII Masking',
  description: 'Detect and mask personally identifiable information',
  longDescription:
    'Automatically detect and mask PII (emails, phone numbers, credit cards, SSNs, etc.) in text data. Supports multiple masking modes: asterisk, hash, redact, or remove.',
  category: 'blocks',
  isUtility: true,
  bgColor: '#DC2626',
  icon: ShieldCheck as any,
  subBlocks: [
    {
      id: 'input',
      title: 'Input Text',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter text or reference a variable containing text to scan for PII...',
    },
    {
      id: 'maskingMode',
      title: 'Masking Mode',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Asterisk (***)', id: 'asterisk' },
        { label: 'Hash ([EMAIL_HASH_abc123])', id: 'hash' },
        { label: 'Redact ([EMAIL_REDACTED])', id: 'redact' },
        { label: 'Remove (delete PII)', id: 'remove' },
      ],
    },
    {
      id: 'piiTypes',
      title: 'PII Types to Detect',
      type: 'checkbox-list',
      layout: 'full',
      options: [
        { label: 'Email', id: 'email' },
        { label: 'Phone Number', id: 'phone' },
        { label: 'Credit Card', id: 'credit_card' },
        { label: 'SSN', id: 'ssn' },
        { label: 'IP Address', id: 'ip_address' },
        { label: 'Date of Birth', id: 'date_of_birth' },
        { label: 'Passport', id: 'passport' },
        { label: 'TC Kimlik (Turkish ID)', id: 'tc_kimlik' },
      ],
    },
    {
      id: 'exemptFields',
      title: 'Exempt Fields (comma-separated)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., metadata.source, config.webhook_url',
    },
  ],
  tools: {
    access: ['pii_detect_and_mask'],
    config: {
      tool: () => 'pii_detect_and_mask',
      params: (params) => ({
        input: params.input,
        maskingMode: params.maskingMode || 'asterisk',
        piiTypes: params.piiTypes || ['email', 'phone', 'credit_card', 'ssn'],
        exemptFields: params.exemptFields
          ? params.exemptFields.split(',').map((f: string) => f.trim())
          : [],
      }),
    },
  },
  inputs: {
    input: { type: 'string', required: true },
    maskingMode: { type: 'string', required: false },
    piiTypes: { type: 'json', required: false },
    exemptFields: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        maskedText: 'string',
        hasPII: 'boolean',
        matchCount: 'number',
        matches: 'json',
      } as any,
    },
  },
}
