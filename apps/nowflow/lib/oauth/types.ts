import { ReactNode } from 'react'

// Define the base OAuth provider type
export type OAuthProvider =
  | 'google'
  | 'github'
  | 'x'
  | 'supabase'
  | 'confluence'
  | 'airtable'
  | 'notion'
  | 'jira'
  | 'microsoft'
  | 'teams'
  | 'meta'
  | 'linkedin'
  | 'sap'
  | 'figma'
  | 'canva'
  | 'bitbucket'
  | 'adobe'
  | 'quickbooks'
  | 'xero'
  | 'freshbooks'
  | 'zoho_books'
  | 'miro'
  | 'loom'
  | 'basecamp'
  | 'smartsheet'
  | 'coda'
  | 'klaviyo'
  | 'convertkit'
  | 'contentful'
  | 'sanity'
  | 'vercel'
  | 'planetscale'
  | 'segment'
  | 'zoho_crm'
  | 'copper'
  | 'close'
  | 'wrike'
  | 'gusto'
  | 'bamboohr'
  | 'wise'
  | 'stripe'
  | 'binance'
  | 'coinbase'
  | 'robinhood'
  | string
export type OAuthService =
  | 'google'
  | 'google-email'
  | 'google-drive'
  | 'google-docs'
  | 'google-sheets'
  | 'google-calendar'
  | 'google-youtube'
  | 'google-forms'
  | 'github'
  | 'x'
  | 'supabase'
  | 'confluence'
  | 'airtable'
  | 'notion'
  | 'jira'
  | 'microsoft'
  | 'teams'
  | 'microsoft-onedrive'
  | 'microsoft-outlook'
  | 'microsoft-sharepoint'
  | 'meta-facebook'
  | 'meta-instagram'
  | 'meta-whatsapp'
  | 'linkedin'
  | 'sap-s4hana'
  | 'sap-successfactors'
  | 'sap-concur'
  | 'sap-ariba'
  | 'sap-fieldglass'
  | 'sap-business-one'
  | 'figma'
  | 'canva'
  | 'bitbucket'
  | 'adobe-cc'

// Define the interface for OAuth provider configuration
export interface OAuthProviderConfig {
  id: OAuthProvider
  name: string
  icon: (props: { className?: string }) => ReactNode
  services: Record<string, OAuthServiceConfig>
  defaultService: string
}

// Define the interface for OAuth service configuration
export interface OAuthServiceConfig {
  id: string
  name: string
  description: string
  providerId: string
  icon: (props: { className?: string }) => ReactNode
  baseProviderIcon: (props: { className?: string }) => ReactNode
  scopes: string[]
}

// Interface for credential objects
export interface Credential {
  id: string
  name: string
  provider: OAuthProvider
  serviceId?: string
  lastUsed?: string
  isDefault?: boolean
}

// Interface for provider configuration
export interface ProviderConfig {
  baseProvider: string
  featureType: string
}
