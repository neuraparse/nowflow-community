/**
 * Atlassian OAuth provider configurations.
 *
 * Extracted from lib/auth/providers.ts. Order preserved from the original
 * genericOAuthProviders array.
 */
import { logger } from '../helpers'

export const ATLASSIAN_PROVIDERS = [
  {
    providerId: 'confluence',
    clientId: process.env.CONFLUENCE_CLIENT_ID as string,
    clientSecret: process.env.CONFLUENCE_CLIENT_SECRET as string,
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    userInfoUrl: 'https://api.atlassian.com/me',
    scopes: ['read:page:confluence', 'write:page:confluence', 'read:me', 'offline_access'],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    authentication: 'basic',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/confluence`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.atlassian.com/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Confluence user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()

        const now = new Date()

        return {
          id: profile.account_id,
          name: profile.name || profile.display_name || 'Confluence User',
          email: profile.email || `${profile.account_id}@atlassian.com`,
          image: profile.picture || null,
          emailVerified: true, // Assume verified since it's an Atlassian account
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Confluence getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'jira',
    clientId: process.env.JIRA_CLIENT_ID as string,
    clientSecret: process.env.JIRA_CLIENT_SECRET as string,
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    userInfoUrl: 'https://api.atlassian.com/me',
    scopes: [
      'read:jira-user',
      'read:jira-work',
      'write:jira-work',
      'write:issue:jira',
      'read:project:jira',
      'read:issue-type:jira',
      'read:me',
      'offline_access',
      'read:issue-meta:jira',
      'read:issue-security-level:jira',
      'read:issue.vote:jira',
      'read:issue.changelog:jira',
      'read:avatar:jira',
      'read:issue:jira',
      'read:status:jira',
      'read:user:jira',
      'read:field-configuration:jira',
      'read:issue-details:jira',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    authentication: 'basic',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/jira`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.atlassian.com/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Jira user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()

        const now = new Date()

        return {
          id: profile.account_id,
          name: profile.name || profile.display_name || 'Jira User',
          email: profile.email || `${profile.account_id}@atlassian.com`,
          image: profile.picture || null,
          emailVerified: true, // Assume verified since it's an Atlassian account
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Jira getUserInfo:', { error })
        return null
      }
    },
  },
]
