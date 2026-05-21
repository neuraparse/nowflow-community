import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('OAuth')

/**
 * Refresh an OAuth token
 * This is a server-side utility function to refresh OAuth tokens
 * @param providerId The provider ID (e.g., 'google-drive')
 * @param refreshToken The refresh token to use
 * @returns Object containing the new access token and expiration time in seconds, or null if refresh failed
 */
export async function refreshOAuthToken(
  providerId: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number; refreshToken: string } | null> {
  try {
    // Get the provider from the providerId (e.g., 'google-drive' -> 'google')
    const provider = providerId.split('-')[0]

    // Determine the token endpoint based on the provider
    let tokenEndpoint: string
    let clientId: string | undefined
    let clientSecret: string | undefined
    let useBasicAuth = false

    switch (provider) {
      case 'google':
        tokenEndpoint = 'https://oauth2.googleapis.com/token'
        clientId = process.env.GOOGLE_CLIENT_ID
        clientSecret = process.env.GOOGLE_CLIENT_SECRET
        break
      case 'github':
        tokenEndpoint = 'https://github.com/login/oauth/access_token'
        clientId = process.env.GITHUB_CLIENT_ID
        clientSecret = process.env.GITHUB_CLIENT_SECRET
        break
      case 'x':
        tokenEndpoint = 'https://api.x.com/2/oauth2/token'
        clientId = process.env.X_CLIENT_ID
        clientSecret = process.env.X_CLIENT_SECRET
        useBasicAuth = true
        break
      case 'confluence':
        tokenEndpoint = 'https://auth.atlassian.com/oauth/token'
        clientId = process.env.CONFLUENCE_CLIENT_ID
        clientSecret = process.env.CONFLUENCE_CLIENT_SECRET
        useBasicAuth = true
        break
      case 'jira':
        tokenEndpoint = 'https://auth.atlassian.com/oauth/token'
        clientId = process.env.JIRA_CLIENT_ID
        clientSecret = process.env.JIRA_CLIENT_SECRET
        useBasicAuth = true
        break
      case 'airtable':
        tokenEndpoint = 'https://airtable.com/oauth2/v1/token'
        clientId = process.env.AIRTABLE_CLIENT_ID
        clientSecret = process.env.AIRTABLE_CLIENT_SECRET
        useBasicAuth = true
        break
      case 'supabase':
        tokenEndpoint = 'https://api.supabase.com/v1/oauth/token'
        clientId = process.env.SUPABASE_CLIENT_ID
        clientSecret = process.env.SUPABASE_CLIENT_SECRET
        break
      case 'notion':
        tokenEndpoint = 'https://api.notion.com/v1/oauth/token'
        clientId = process.env.NOTION_CLIENT_ID
        clientSecret = process.env.NOTION_CLIENT_SECRET
        break
      case 'meta':
        tokenEndpoint = 'https://graph.facebook.com/v21.0/oauth/access_token'
        clientId = process.env.META_APP_ID
        clientSecret = process.env.META_APP_SECRET
        break
      case 'microsoft':
        tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
        clientId = process.env.MICROSOFT_CLIENT_ID
        clientSecret = process.env.MICROSOFT_CLIENT_SECRET
        break
      case 'linkedin':
        tokenEndpoint = 'https://www.linkedin.com/oauth/v2/accessToken'
        clientId = process.env.LINKEDIN_CLIENT_ID
        clientSecret = process.env.LINKEDIN_CLIENT_SECRET
        break
      case 'sap':
        // SAP BTP uses XSUAA for OAuth
        // Token endpoint format: https://{subdomain}.authentication.{region}.hana.ondemand.com/oauth/token
        tokenEndpoint =
          process.env.SAP_TOKEN_ENDPOINT ||
          'https://authentication.sap.hana.ondemand.com/oauth/token'
        clientId = process.env.SAP_CLIENT_ID
        clientSecret = process.env.SAP_CLIENT_SECRET
        break
      case 'quickbooks':
        tokenEndpoint = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
        clientId = process.env.QUICKBOOKS_CLIENT_ID
        clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
        useBasicAuth = true
        break
      case 'xero':
        tokenEndpoint = 'https://identity.xero.com/connect/token'
        clientId = process.env.XERO_CLIENT_ID
        clientSecret = process.env.XERO_CLIENT_SECRET
        useBasicAuth = true
        break
      case 'freshbooks':
        tokenEndpoint = 'https://auth.freshbooks.com/oauth/token'
        clientId = process.env.FRESHBOOKS_CLIENT_ID
        clientSecret = process.env.FRESHBOOKS_CLIENT_SECRET
        break
      case 'zoho_books':
        tokenEndpoint = 'https://accounts.zoho.com/oauth/v2/token'
        clientId = process.env.ZOHO_BOOKS_CLIENT_ID
        clientSecret = process.env.ZOHO_BOOKS_CLIENT_SECRET
        break
      case 'miro':
        tokenEndpoint = 'https://api.miro.com/v1/oauth/token'
        clientId = process.env.MIRO_CLIENT_ID
        clientSecret = process.env.MIRO_CLIENT_SECRET
        useBasicAuth = true
        break
      case 'loom':
        tokenEndpoint = 'https://api.loom.com/v1/oauth/token'
        clientId = process.env.LOOM_CLIENT_ID
        clientSecret = process.env.LOOM_CLIENT_SECRET
        break
      case 'basecamp':
        tokenEndpoint = 'https://launchpad.37signals.com/authorization/token'
        clientId = process.env.BASECAMP_CLIENT_ID
        clientSecret = process.env.BASECAMP_CLIENT_SECRET
        break
      case 'smartsheet':
        tokenEndpoint = 'https://api.smartsheet.com/2.0/token'
        clientId = process.env.SMARTSHEET_CLIENT_ID
        clientSecret = process.env.SMARTSHEET_CLIENT_SECRET
        break
      case 'coda':
        tokenEndpoint = 'https://coda.io/oauth/token'
        clientId = process.env.CODA_CLIENT_ID
        clientSecret = process.env.CODA_CLIENT_SECRET
        break
      case 'klaviyo':
        tokenEndpoint = 'https://a.klaviyo.com/oauth/token'
        clientId = process.env.KLAVIYO_CLIENT_ID
        clientSecret = process.env.KLAVIYO_CLIENT_SECRET
        break
      case 'convertkit':
        tokenEndpoint = 'https://app.kit.com/oauth/token'
        clientId = process.env.CONVERTKIT_CLIENT_ID
        clientSecret = process.env.CONVERTKIT_CLIENT_SECRET
        break
      case 'contentful':
        tokenEndpoint = 'https://be.contentful.com/oauth/token'
        clientId = process.env.CONTENTFUL_CLIENT_ID
        clientSecret = process.env.CONTENTFUL_CLIENT_SECRET
        break
      case 'sanity':
        tokenEndpoint = 'https://api.sanity.io/v2021-06-07/auth/oauth/token'
        clientId = process.env.SANITY_CLIENT_ID
        clientSecret = process.env.SANITY_CLIENT_SECRET
        break
      case 'vercel':
        tokenEndpoint = 'https://api.vercel.com/v2/oauth/access_token'
        clientId = process.env.VERCEL_CLIENT_ID
        clientSecret = process.env.VERCEL_CLIENT_SECRET
        break
      case 'planetscale':
        tokenEndpoint = 'https://auth.planetscale.com/oauth/token'
        clientId = process.env.PLANETSCALE_CLIENT_ID
        clientSecret = process.env.PLANETSCALE_CLIENT_SECRET
        break
      case 'segment':
        tokenEndpoint = 'https://api.segmentapis.com/oauth/token'
        clientId = process.env.SEGMENT_CLIENT_ID
        clientSecret = process.env.SEGMENT_CLIENT_SECRET
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    if (!clientId || !clientSecret) {
      throw new Error(`Missing client credentials for provider: ${provider}`)
    }

    // Prepare request headers and body
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(provider === 'github' && {
        Accept: 'application/json',
      }),
    }

    // Prepare request body
    const bodyParams: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }

    // For Airtable, check if we have both client ID and secret
    if (provider === 'airtable') {
      // Airtable requires Basic Auth with client ID and secret in the Authorization header
      // Do not include client_id or client_secret in the body when using Basic Auth
      if (clientId && clientSecret) {
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        headers['Authorization'] = `Basic ${basicAuth}`

        // Make sure to include refresh_token in body params but not client_id/client_secret
        // This ensures we're not sending credentials in both header and body
        delete bodyParams.client_id
        delete bodyParams.client_secret
      } else {
        throw new Error('Both client ID and client secret are required for Airtable OAuth')
      }
    } else if (
      provider === 'x' ||
      provider === 'confluence' ||
      provider === 'jira' ||
      provider === 'quickbooks' ||
      provider === 'xero' ||
      provider === 'miro'
    ) {
      // Handle providers that require Basic Auth
      // X, Atlassian services (Confluence, Jira), QuickBooks, Xero, Miro
      const authString = `${clientId}:${clientSecret}`
      const basicAuth = Buffer.from(authString).toString('base64')
      headers['Authorization'] = `Basic ${basicAuth}`

      // When using Basic Auth, don't include client_id in body
      delete bodyParams.client_id
      delete bodyParams.client_secret
    } else {
      // For other providers, use the general approach
      if (useBasicAuth) {
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        headers['Authorization'] = `Basic ${basicAuth}`
      }

      if (!useBasicAuth) {
        bodyParams.client_id = clientId
        bodyParams.client_secret = clientSecret
      }
    }

    // Refresh the token
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams(bodyParams).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorType: string | undefined

      // Try to parse the error as JSON for better diagnostics
      try {
        const errorData = JSON.parse(errorText)
        errorType = errorData?.error || errorData?.error_description
      } catch (e) {
        // Keep raw provider responses out of logs and thrown errors.
      }

      logger.error('Token refresh failed:', {
        status: response.status,
        errorType,
        provider,
      })
      throw new Error(`Failed to refresh token: ${response.status}`)
    }

    const data = await response.json()

    // Extract token and expiration (different providers may use different field names)
    const accessToken = data.access_token

    // Many providers rotate refresh tokens on each refresh
    let newRefreshToken = null
    const providersWithRefreshTokenRotation = [
      'airtable',
      'confluence',
      'jira',
      'quickbooks',
      'xero',
      'freshbooks',
      'zoho_books',
      'miro',
      'loom',
      'basecamp',
      'smartsheet',
      'coda',
      'klaviyo',
      'convertkit',
      'contentful',
      'sanity',
      'vercel',
      'planetscale',
      'segment',
      'zoho_crm',
      'copper',
      'close',
      'wrike',
      'gusto',
      'bamboohr',
      'wise',
      'stripe',
    ]

    if (providersWithRefreshTokenRotation.includes(provider) && data.refresh_token) {
      newRefreshToken = data.refresh_token
      logger.info(`Received new refresh token from ${provider}`)
    }

    // Get expiration time - use provider's value or default to 1 hour (3600 seconds)
    // Different providers use different names for this field
    const expiresIn = data.expires_in || data.expiresIn || 3600

    if (!accessToken) {
      logger.warn('No access token found in refresh response', {
        provider,
        responseKeys: Object.keys(data || {}),
      })
      return null
    }

    logger.info('Token refreshed successfully with expiration', {
      expiresIn,
      hasNewRefreshToken: !!newRefreshToken,
      provider,
    })

    return {
      accessToken,
      expiresIn,
      refreshToken: newRefreshToken || refreshToken, // Return new refresh token if available
    }
  } catch (error) {
    logger.error('Error refreshing token:', { error })
    return null
  }
}
