import { OAUTH_PROVIDERS } from './providers'
import { OAuthProvider, OAuthServiceConfig, ProviderConfig } from './types'

// Helper function to get a service by provider and service ID
export function getServiceByProviderAndId(
  provider: OAuthProvider,
  serviceId?: string
): OAuthServiceConfig {
  const providerConfig = OAUTH_PROVIDERS[provider]
  if (!providerConfig) {
    throw new Error(`Provider ${provider} not found`)
  }

  if (!serviceId) {
    return providerConfig.services[providerConfig.defaultService]
  }

  return (
    providerConfig.services[serviceId] || providerConfig.services[providerConfig.defaultService]
  )
}

// Helper function to determine service ID from scopes
export function getServiceIdFromScopes(provider: OAuthProvider, scopes: string[]): string {
  const providerConfig = OAUTH_PROVIDERS[provider]
  if (!providerConfig) {
    return provider
  }

  if (provider === 'google') {
    if (scopes.some((scope) => scope.includes('gmail') || scope.includes('mail'))) {
      return 'gmail'
    } else if (scopes.some((scope) => scope.includes('drive'))) {
      return 'google-drive'
    } else if (scopes.some((scope) => scope.includes('docs'))) {
      return 'google-docs'
    } else if (scopes.some((scope) => scope.includes('sheets'))) {
      return 'google-sheets'
    } else if (scopes.some((scope) => scope.includes('calendar'))) {
      return 'google-calendar'
    } else if (scopes.some((scope) => scope.includes('forms'))) {
      return 'google-forms'
    }
  } else if (provider === 'github') {
    return 'github'
  } else if (provider === 'supabase') {
    return 'supabase'
  } else if (provider === 'x') {
    return 'x'
  } else if (provider === 'confluence') {
    return 'confluence'
  } else if (provider === 'jira') {
    return 'jira'
  } else if (provider === 'airtable') {
    return 'airtable'
  } else if (provider === 'notion') {
    return 'notion'
  } else if (provider === 'microsoft') {
    if (
      scopes.some(
        (scope) => scope.includes('Teams') || scope.includes('Chat') || scope.includes('Channel')
      )
    ) {
      return 'microsoft-teams'
    } else if (
      scopes.some(
        (scope) =>
          scope.includes('Mail') || scope.includes('Calendars') || scope.includes('Contacts')
      )
    ) {
      return 'microsoft-outlook'
    } else if (scopes.some((scope) => scope.includes('Files') && !scope.includes('Sites'))) {
      return 'microsoft-onedrive'
    } else if (scopes.some((scope) => scope.includes('Sites'))) {
      return 'microsoft-sharepoint'
    }
  } else if (provider === 'meta') {
    if (scopes.some((scope) => scope.includes('instagram'))) {
      return 'meta-instagram'
    } else if (scopes.some((scope) => scope.includes('whatsapp'))) {
      return 'meta-whatsapp'
    } else {
      return 'meta-facebook'
    }
  } else if (provider === 'linkedin') {
    return 'linkedin'
  } else if (provider === 'figma') {
    return 'figma'
  } else if (provider === 'canva') {
    return 'canva'
  } else if (provider === 'bitbucket') {
    return 'bitbucket'
  } else if (provider === 'adobe') {
    return 'adobe-cc'
  } else if (provider === 'sap') {
    if (
      scopes.some(
        (scope) =>
          scope.includes('API_SALES_ORDER') ||
          scope.includes('API_BUSINESS_PARTNER') ||
          scope.includes('API_MATERIAL_STOCK')
      )
    ) {
      return 's4hana'
    } else if (
      scopes.some(
        (scope) =>
          scope.includes('employee_central') ||
          scope.includes('recruiting') ||
          scope.includes('user_management')
      )
    ) {
      return 'successfactors'
    } else if (scopes.some((scope) => scope.includes('expense') || scope.includes('travel'))) {
      return 'concur'
    } else if (
      scopes.some(
        (scope) =>
          scope.includes('procurement') || scope.includes('supplier') || scope.includes('sourcing')
      )
    ) {
      return 'ariba'
    } else if (
      scopes.some(
        (scope) =>
          scope.includes('worker') || scope.includes('job_posting') || scope.includes('timesheet')
      )
    ) {
      return 'fieldglass'
    } else if (scopes.some((scope) => scope.includes('sl.'))) {
      return 'business-one'
    }
  }

  return providerConfig.defaultService
}

// Helper function to get provider ID from service ID
export function getProviderIdFromServiceId(serviceId: string): string {
  for (const provider of Object.values(OAUTH_PROVIDERS)) {
    for (const [id, service] of Object.entries(provider.services)) {
      if (id === serviceId) {
        return service.providerId
      }
    }
  }

  // Default fallback
  return serviceId
}

/**
 * Parse a provider string into its base provider and feature type
 * This is a server-safe utility that can be used in both client and server code
 */
export function parseProvider(provider: OAuthProvider): ProviderConfig {
  // Handle compound providers (e.g., 'google-email' -> { baseProvider: 'google', featureType: 'email' })
  const [base, feature] = provider.split('-')

  if (feature) {
    return {
      baseProvider: base,
      featureType: feature,
    }
  }

  // For simple providers, use 'default' as feature type
  return {
    baseProvider: provider,
    featureType: 'default',
  }
}
