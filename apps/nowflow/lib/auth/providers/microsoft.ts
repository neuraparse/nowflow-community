/**
 * Microsoft OAuth provider configurations.
 *
 * Extracted from lib/auth/providers.ts. Order preserved from the original
 * genericOAuthProviders array.
 */
import { logger } from '../helpers'

export const MICROSOFT_PROVIDERS = [
  {
    providerId: 'microsoft-teams',
    clientId: process.env.MICROSOFT_CLIENT_ID as string,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access', // Required for refresh token
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/Chat.ReadWrite',
      'https://graph.microsoft.com/Channel.ReadBasic.All',
      'https://graph.microsoft.com/ChannelMessage.Send',
      'https://graph.microsoft.com/Team.ReadBasic.All',
      'https://graph.microsoft.com/TeamMember.Read.All',
      'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Files.ReadWrite.All',
      'https://graph.microsoft.com/Directory.Read.All',
      'https://graph.microsoft.com/TeamsActivity.Read',
      'https://graph.microsoft.com/TeamSettings.ReadWrite.All',
      'https://graph.microsoft.com/TeamsApp.Read.All',
      'https://graph.microsoft.com/Notifications.ReadWrite.CreatedByApp',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/microsoft-teams`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Microsoft user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id,
          name: profile.displayName || profile.userPrincipalName,
          email: profile.mail || profile.userPrincipalName,
          image: null, // Microsoft Graph doesn't provide profile images in basic user info
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Microsoft Teams getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'microsoft-outlook',
    clientId: process.env.MICROSOFT_CLIENT_ID as string,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Contacts.ReadWrite',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/microsoft-outlook`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id,
          name: profile.displayName || profile.userPrincipalName,
          email: profile.mail || profile.userPrincipalName,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Microsoft Outlook getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'microsoft-onedrive',
    clientId: process.env.MICROSOFT_CLIENT_ID as string,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/Files.ReadWrite.All',
      'https://graph.microsoft.com/Sites.ReadWrite.All',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/microsoft-onedrive`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id,
          name: profile.displayName || profile.userPrincipalName,
          email: profile.mail || profile.userPrincipalName,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Microsoft OneDrive getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'microsoft-sharepoint',
    clientId: process.env.MICROSOFT_CLIENT_ID as string,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/Sites.ReadWrite.All',
      'https://graph.microsoft.com/Files.ReadWrite.All',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/microsoft-sharepoint`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id,
          name: profile.displayName || profile.userPrincipalName,
          email: profile.mail || profile.userPrincipalName,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Microsoft SharePoint getUserInfo:', { error })
        return null
      }
    },
  },
]
