import { logger } from './helpers'

/**
 * Social providers configuration for betterAuth's socialProviders option.
 */
export const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID as string,
          clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
          scopes: ['user:email', 'repo'],
        },
      }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          scopes: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
          ],
        },
      }
    : {}),
}

/**
 * Generic OAuth provider configurations for the genericOAuth plugin.
 */
export const genericOAuthProviders = [
  {
    providerId: 'github-repo',
    clientId: process.env.GITHUB_REPO_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_REPO_CLIENT_SECRET as string,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    accessType: 'offline',
    prompt: 'consent',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'repo', 'read:user', 'workflow'],
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/github-repo`,
    getUserInfo: async (tokens: any) => {
      try {
        // Fetch user profile
        const profileResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'User-Agent': 'nowflow',
          },
        })

        if (!profileResponse.ok) {
          logger.error('Failed to fetch GitHub profile', {
            status: profileResponse.status,
            statusText: profileResponse.statusText,
          })
          throw new Error(`Failed to fetch GitHub profile: ${profileResponse.statusText}`)
        }

        const profile = await profileResponse.json()

        // If email is null, fetch emails separately
        if (!profile.email) {
          const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              'User-Agent': 'nowflow',
            },
          })

          if (emailsResponse.ok) {
            const emails = await emailsResponse.json()

            // Find primary email or use the first one
            const primaryEmail =
              emails.find(
                (email: { primary: boolean; email: string; verified: boolean }) => email.primary
              ) || emails[0]
            if (primaryEmail) {
              profile.email = primaryEmail.email
              // Add information about email verification
              profile.emailVerified = primaryEmail.verified || false
            }
          } else {
            logger.warn('Failed to fetch GitHub emails', {
              status: emailsResponse.status,
              statusText: emailsResponse.statusText,
            })
          }
        }

        const now = new Date()

        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          emailVerified: profile.emailVerified || false,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in GitHub getUserInfo', { error })
        throw error
      }
    },
  },

  // Google providers for different purposes
  {
    providerId: 'google-email',
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    accessType: 'offline',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/google-email`,
  },
  {
    providerId: 'google-calendar',
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    accessType: 'offline',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
    ],
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/google-calendar`,
  },
  {
    providerId: 'google-drive',
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    accessType: 'offline',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
    ],
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/google-drive`,
  },
  {
    providerId: 'google-docs',
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    accessType: 'offline',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
    ],
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/google-docs`,
  },
  {
    providerId: 'google-sheets',
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    accessType: 'offline',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/google-sheets`,
  },
  {
    providerId: 'google-youtube',
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    accessType: 'offline',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/google-youtube`,
  },
  {
    providerId: 'google-forms',
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    accessType: 'offline',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/forms.responses.readonly',
      'https://www.googleapis.com/auth/forms.body.readonly',
    ],
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/google-forms`,
  },

  // Supabase provider
  {
    providerId: 'supabase',
    clientId: process.env.SUPABASE_CLIENT_ID as string,
    clientSecret: process.env.SUPABASE_CLIENT_SECRET as string,
    authorizationUrl: 'https://api.supabase.com/v1/oauth/authorize',
    tokenUrl: 'https://api.supabase.com/v1/oauth/token',
    // Supabase doesn't have a standard userInfo endpoint that works with our flow,
    // so we use a dummy URL and rely on our custom getUserInfo implementation
    userInfoUrl: 'https://dummy-not-used.supabase.co',
    scopes: ['database.read', 'database.write', 'projects.read'],
    responseType: 'code',
    pkce: true,
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/supabase`,
    getUserInfo: async (tokens: any) => {
      try {
        logger.info('Creating Supabase user profile from token data')

        // Extract user identifier from tokens if possible
        let userId = 'supabase-user'
        if (tokens.idToken) {
          try {
            // Try to decode the JWT to get user information
            const decodedToken = JSON.parse(
              Buffer.from(tokens.idToken.split('.')[1], 'base64').toString()
            )
            if (decodedToken.sub) {
              userId = decodedToken.sub
            }
          } catch (e) {
            logger.warn('Failed to decode Supabase ID token', { error: e })
          }
        }

        // Generate a unique enough identifier
        const uniqueId = `${userId}-${Date.now()}`

        const now = new Date()

        // Create a synthetic user profile since we can't fetch one
        return {
          id: uniqueId,
          name: 'Supabase User',
          email: `${uniqueId.replace(/[^a-zA-Z0-9]/g, '')}@supabase.user`,
          image: null,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error creating Supabase user profile:', { error })
        return null
      }
    },
  },

  // X provider
  {
    providerId: 'x',
    clientId: process.env.X_CLIENT_ID as string,
    clientSecret: process.env.X_CLIENT_SECRET as string,
    authorizationUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    userInfoUrl: 'https://api.x.com/2/users/me',
    accessType: 'offline',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    pkce: true,
    responseType: 'code',
    prompt: 'consent',
    authentication: 'basic',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/x`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch(
          'https://api.x.com/2/users/me?user.fields=profile_image_url,username,name,verified',
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          }
        )

        if (!response.ok) {
          logger.error('Error fetching X user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()

        if (!profile.data) {
          logger.error('Invalid X profile response:', profile)
          return null
        }

        const now = new Date()

        return {
          id: profile.data.id,
          name: profile.data.name || 'X User',
          email: `${profile.data.username}@x.com`, // Create synthetic email with username
          image: profile.data.profile_image_url,
          emailVerified: profile.data.verified || false,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in X getUserInfo:', { error })
        return null
      }
    },
  },

  // Confluence provider
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

  // Jira provider
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

  // Airtable provider
  {
    providerId: 'airtable',
    clientId: process.env.AIRTABLE_CLIENT_ID as string,
    clientSecret: process.env.AIRTABLE_CLIENT_SECRET as string,
    authorizationUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
    userInfoUrl: 'https://api.airtable.com/v0/meta/whoami',
    scopes: ['data.records:read', 'data.records:write', 'user.email:read', 'webhook:manage'],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    authentication: 'basic',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/airtable`,
  },

  // Notion provider
  {
    providerId: 'notion',
    clientId: process.env.NOTION_CLIENT_ID as string,
    clientSecret: process.env.NOTION_CLIENT_SECRET as string,
    authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    userInfoUrl: 'https://api.notion.com/v1/users/me',
    scopes: ['workspace.content', 'workspace.name', 'page.read', 'page.write'],
    responseType: 'code',
    pkce: false, // Notion doesn't support PKCE
    accessType: 'offline',
    authentication: 'basic',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/notion`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.notion.com/v1/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Notion-Version': '2022-06-28', // Specify the Notion API version
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Notion user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.bot?.owner?.user?.id || profile.id,
          name: profile.name || profile.bot?.owner?.user?.name || 'Notion User',
          email: profile.person?.email || `${profile.id}@notion.user`,
          image: null, // Notion API doesn't provide profile images
          emailVerified: profile.person?.email ? true : false,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Notion getUserInfo:', { error })
        return null
      }
    },
  },

  // Microsoft Teams provider
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

  // Microsoft Outlook provider
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

  // Microsoft OneDrive provider
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

  // Microsoft SharePoint provider
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

  // Meta Facebook provider
  {
    providerId: 'meta-facebook',
    clientId: process.env.META_APP_ID as string,
    clientSecret: process.env.META_APP_SECRET as string,
    authorizationUrl: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v24.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/v24.0/me',
    scopes: [
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_show_list',
      'pages_manage_metadata',
      'pages_read_user_content',
      'business_management',
    ],
    responseType: 'code',
    accessType: 'offline',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/meta-facebook`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://graph.facebook.com/v24.0/me?fields=id,name,email', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Facebook user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email || `${profile.id}@meta.user`,
          image: null,
          emailVerified: !!profile.email,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Meta Facebook getUserInfo:', { error })
        return null
      }
    },
  },

  // Meta Instagram provider
  {
    providerId: 'meta-instagram',
    clientId: process.env.META_APP_ID as string,
    clientSecret: process.env.META_APP_SECRET as string,
    authorizationUrl: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v24.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/v24.0/me',
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ],
    responseType: 'code',
    accessType: 'offline',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/meta-instagram`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://graph.facebook.com/v24.0/me?fields=id,name,email', {
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
          name: profile.name,
          email: profile.email || `${profile.id}@meta.user`,
          image: null,
          emailVerified: !!profile.email,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Meta Instagram getUserInfo:', { error })
        return null
      }
    },
  },

  // Meta WhatsApp provider
  {
    providerId: 'meta-whatsapp',
    clientId: process.env.META_APP_ID as string,
    clientSecret: process.env.META_APP_SECRET as string,
    authorizationUrl: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v24.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/v24.0/me',
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management', 'business_management'],
    responseType: 'code',
    accessType: 'offline',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/meta-whatsapp`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://graph.facebook.com/v24.0/me?fields=id,name,email', {
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
          name: profile.name,
          email: profile.email || `${profile.id}@meta.user`,
          image: null,
          emailVerified: !!profile.email,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Meta WhatsApp getUserInfo:', { error })
        return null
      }
    },
  },

  // LinkedIn provider (using OIDC discovery)
  {
    providerId: 'linkedin',
    clientId: process.env.LINKEDIN_CLIENT_ID as string,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET as string,
    discoveryUrl: 'https://www.linkedin.com/oauth/.well-known/openid-configuration',
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/linkedin`,
  },

  // SAP S/4HANA provider
  {
    providerId: 'sap-s4hana',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'API_SALES_ORDER_SRV_0001',
      'API_BUSINESS_PARTNER',
      'API_MATERIAL_STOCK_SRV',
      'API_PRODUCTION_ORDER_2_SRV',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-s4hana`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching SAP S/4HANA user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || profile.display_name || 'SAP S/4HANA User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP S/4HANA getUserInfo:', { error })
        return null
      }
    },
  },

  // SAP SuccessFactors provider
  {
    providerId: 'sap-successfactors',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: ['user_management', 'employee_central', 'recruiting', 'performance_goals', 'learning'],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-successfactors`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
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
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP SuccessFactors User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP SuccessFactors getUserInfo:', { error })
        return null
      }
    },
  },

  // SAP Concur provider
  {
    providerId: 'sap-concur',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'expense.report.read',
      'expense.report.write',
      'travel.request.read',
      'travel.request.write',
      'invoice.read',
      'invoice.write',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-concur`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
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
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Concur User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Concur getUserInfo:', { error })
        return null
      }
    },
  },

  // SAP Ariba provider
  {
    providerId: 'sap-ariba',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'procurement.read',
      'procurement.write',
      'supplier.read',
      'supplier.write',
      'sourcing.read',
      'contract.read',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-ariba`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
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
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Ariba User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Ariba getUserInfo:', { error })
        return null
      }
    },
  },

  // SAP Fieldglass provider
  {
    providerId: 'sap-fieldglass',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'worker.read',
      'worker.write',
      'job_posting.read',
      'job_posting.write',
      'timesheet.read',
      'invoice.read',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-fieldglass`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
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
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Fieldglass User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Fieldglass getUserInfo:', { error })
        return null
      }
    },
  },

  // SAP Business One provider
  {
    providerId: 'sap-business-one',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'sl.businesspartner',
      'sl.items',
      'sl.orders',
      'sl.invoices',
      'sl.inventory',
      'sl.generalledger',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-business-one`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
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
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Business One User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Business One getUserInfo:', { error })
        return null
      }
    },
  },

  // Figma provider (Updated 2025 - using granular scopes)
  {
    providerId: 'figma',
    clientId: process.env.FIGMA_CLIENT_ID as string,
    clientSecret: process.env.FIGMA_CLIENT_SECRET as string,
    authorizationUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    userInfoUrl: 'https://api.figma.com/v1/me',
    scopes: [
      'file_content:read',
      'file_metadata:read',
      'file_comments:write',
      'file_comments:read',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/figma`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.figma.com/v1/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Figma user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id,
          name: profile.handle || 'Figma User',
          email: profile.email || `${profile.id}@figma.user`,
          image: profile.img_url || null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Figma getUserInfo:', { error })
        return null
      }
    },
  },

  // Canva provider
  {
    providerId: 'canva',
    clientId: process.env.CANVA_CLIENT_ID as string,
    clientSecret: process.env.CANVA_CLIENT_SECRET as string,
    authorizationUrl: 'https://www.canva.com/api/oauth/authorize',
    tokenUrl: 'https://api.canva.com/rest/v1/oauth/token',
    userInfoUrl: 'https://api.canva.com/rest/v1/users/me',
    scopes: [
      'design:content:read',
      'design:content:write',
      'design:meta:read',
      'asset:read',
      'asset:write',
      'folder:read',
      'folder:write',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/canva`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.canva.com/rest/v1/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Canva user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const data = await response.json()
        const profile = data.user
        const now = new Date()

        return {
          id: profile.id,
          name: profile.display_name || 'Canva User',
          email: profile.email || `${profile.id}@canva.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Canva getUserInfo:', { error })
        return null
      }
    },
  },

  // Bitbucket provider (Part of Atlassian - Updated 2025)
  {
    providerId: 'bitbucket',
    clientId: process.env.BITBUCKET_CLIENT_ID as string,
    clientSecret: process.env.BITBUCKET_CLIENT_SECRET as string,
    authorizationUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    userInfoUrl: 'https://api.bitbucket.org/2.0/user',
    scopes: ['account', 'repository', 'repository:write', 'pullrequest', 'pullrequest:write'],
    responseType: 'code',
    pkce: false, // Bitbucket OAuth 2.0 supports PKCE but not required
    accessType: 'offline',
    prompt: 'consent',
    authentication: 'basic', // Bitbucket uses Basic Auth for token endpoint
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/bitbucket`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.bitbucket.org/2.0/user', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Bitbucket user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()

        // Fetch email separately
        const emailResponse = await fetch('https://api.bitbucket.org/2.0/user/emails', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        let email = `${profile.username}@bitbucket.user`
        if (emailResponse.ok) {
          const emailData = await emailResponse.json()
          const primaryEmail = emailData.values?.find((e: any) => e.is_primary)
          if (primaryEmail) {
            email = primaryEmail.email
          }
        }

        const now = new Date()

        return {
          id: profile.uuid,
          name: profile.display_name || profile.username,
          email,
          image: profile.links?.avatar?.href || null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Bitbucket getUserInfo:', { error })
        return null
      }
    },
  },

  // Adobe Creative Cloud provider (Updated 2025 - OAuth Server-to-Server)
  {
    providerId: 'adobe-cc',
    clientId: process.env.ADOBE_CLIENT_ID as string,
    clientSecret: process.env.ADOBE_CLIENT_SECRET as string,
    authorizationUrl: 'https://ims-na1.adobelogin.com/ims/authorize/v2',
    tokenUrl: 'https://ims-na1.adobelogin.com/ims/token/v3',
    userInfoUrl: 'https://ims-na1.adobelogin.com/ims/userinfo/v2',
    scopes: ['openid', 'creative_sdk', 'AdobeID', 'profile', 'email'],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/adobe-cc`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://ims-na1.adobelogin.com/ims/userinfo/v2', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching Adobe user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.sub || profile.user_id,
          name: profile.name || 'Adobe User',
          email: profile.email || `${profile.sub}@adobe.user`,
          image: null,
          emailVerified: profile.email_verified || true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Adobe getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'quickbooks',
    clientId: process.env.QUICKBOOKS_CLIENT_ID as string,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET as string,
    authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    userInfoUrl: 'https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
    scopes: ['com.intuit.quickbooks.accounting', 'openid', 'profile', 'email'],
    responseType: 'code',
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/quickbooks`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch(
          'https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          }
        )
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.sub,
          name: profile.givenName || 'QuickBooks User',
          email: profile.email || `${profile.sub}@quickbooks.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in QuickBooks getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'xero',
    clientId: process.env.XERO_CLIENT_ID as string,
    clientSecret: process.env.XERO_CLIENT_SECRET as string,
    authorizationUrl: 'https://login.xero.com/identity/connect/authorize',
    tokenUrl: 'https://identity.xero.com/connect/token',
    userInfoUrl: 'https://api.xero.com/api.xro/2.0/Organisation',
    scopes: [
      'openid',
      'profile',
      'email',
      'accounting.transactions',
      'accounting.contacts',
      'accounting.settings',
      'offline_access',
    ],
    responseType: 'code',
    pkce: true,
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/xero`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.xero.com/connections', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const connections = await response.json()
        const now = new Date()
        return {
          id: connections[0]?.tenantId || 'xero-user',
          name: connections[0]?.tenantName || 'Xero User',
          email: `${connections[0]?.tenantId}@xero.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Xero getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'freshbooks',
    clientId: process.env.FRESHBOOKS_CLIENT_ID as string,
    clientSecret: process.env.FRESHBOOKS_CLIENT_SECRET as string,
    authorizationUrl: 'https://auth.freshbooks.com/oauth/authorize',
    tokenUrl: 'https://auth.freshbooks.com/oauth/token',
    userInfoUrl: 'https://api.freshbooks.com/auth/api/v1/users/me',
    scopes: [
      'user:profile:read',
      'user:clients:read',
      'user:clients:write',
      'user:invoices:read',
      'user:invoices:write',
    ],
    responseType: 'code',
    accessType: 'offline',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/freshbooks`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const data = await response.json()
        const profile = data.response
        const now = new Date()
        return {
          id: profile.id.toString(),
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in FreshBooks getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'zoho_books',
    clientId: process.env.ZOHO_BOOKS_CLIENT_ID as string,
    clientSecret: process.env.ZOHO_BOOKS_CLIENT_SECRET as string,
    authorizationUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    userInfoUrl: 'https://accounts.zoho.com/oauth/user/info',
    scopes: ['ZohoBooks.fullaccess.all'],
    responseType: 'code',
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/zoho_books`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://accounts.zoho.com/oauth/user/info', {
          headers: {
            Authorization: `Zoho-oauthtoken ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.ZUID,
          name: `${profile.First_Name} ${profile.Last_Name}`,
          email: profile.Email,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Zoho Books getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'miro',
    clientId: process.env.MIRO_CLIENT_ID as string,
    clientSecret: process.env.MIRO_CLIENT_SECRET as string,
    authorizationUrl: 'https://miro.com/oauth/authorize',
    tokenUrl: 'https://api.miro.com/v1/oauth/token',
    userInfoUrl: 'https://api.miro.com/v2/users/me',
    scopes: ['boards:read', 'boards:write'],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/miro`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.miro.com/v2/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.id,
          name: profile.name || 'Miro User',
          email: profile.email || `${profile.id}@miro.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Miro getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'loom',
    clientId: process.env.LOOM_CLIENT_ID as string,
    clientSecret: process.env.LOOM_CLIENT_SECRET as string,
    authorizationUrl: 'https://www.loom.com/oauth/authorize',
    tokenUrl: 'https://api.loom.com/v1/oauth/token',
    userInfoUrl: 'https://api.loom.com/v1/users/me',
    scopes: ['video:read', 'video:write'],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/loom`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.loom.com/v1/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.id.toString(),
          name: profile.name || 'Loom User',
          email: profile.email || `${profile.id}@loom.user`,
          image: profile.photo_url || null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Loom getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'basecamp',
    clientId: process.env.BASECAMP_CLIENT_ID as string,
    clientSecret: process.env.BASECAMP_CLIENT_SECRET as string,
    authorizationUrl: 'https://launchpad.37signals.com/authorization/new',
    tokenUrl: 'https://launchpad.37signals.com/authorization/token',
    userInfoUrl: 'https://launchpad.37signals.com/authorization.json',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/basecamp`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://launchpad.37signals.com/authorization.json', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const data = await response.json()
        const now = new Date()
        return {
          id: data.identity.id.toString(),
          name: data.identity.first_name + ' ' + data.identity.last_name,
          email: data.identity.email_address,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Basecamp getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'smartsheet',
    clientId: process.env.SMARTSHEET_CLIENT_ID as string,
    clientSecret: process.env.SMARTSHEET_CLIENT_SECRET as string,
    authorizationUrl: 'https://app.smartsheet.com/b/authorize',
    tokenUrl: 'https://api.smartsheet.com/2.0/token',
    userInfoUrl: 'https://api.smartsheet.com/2.0/users/me',
    scopes: ['READ_SHEETS', 'WRITE_SHEETS', 'READ_USERS', 'DELETE_SHEETS', 'SHARE_SHEETS'],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/smartsheet`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.smartsheet.com/2.0/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.id.toString(),
          name: profile.firstName + ' ' + profile.lastName,
          email: profile.email,
          image: profile.profileImage?.imageUrl || null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Smartsheet getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'coda',
    clientId: process.env.CODA_CLIENT_ID as string,
    clientSecret: process.env.CODA_CLIENT_SECRET as string,
    authorizationUrl: 'https://coda.io/oauth/authorize',
    tokenUrl: 'https://coda.io/oauth/token',
    userInfoUrl: 'https://coda.io/apis/v1/whoami',
    scopes: ['readonly', 'write'],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/coda`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://coda.io/apis/v1/whoami', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.loginId,
          name: profile.name,
          email: profile.loginId,
          image: profile.pictureUrl || null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Coda getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'klaviyo',
    clientId: process.env.KLAVIYO_CLIENT_ID as string,
    clientSecret: process.env.KLAVIYO_CLIENT_SECRET as string,
    authorizationUrl: 'https://www.klaviyo.com/oauth/authorize',
    tokenUrl: 'https://a.klaviyo.com/oauth/token',
    userInfoUrl: 'https://a.klaviyo.com/api/accounts/',
    scopes: [
      'profiles:read',
      'profiles:write',
      'campaigns:read',
      'campaigns:write',
      'metrics:read',
    ],
    responseType: 'code',
    pkce: true,
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/klaviyo`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://a.klaviyo.com/api/accounts/', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            revision: '2024-10-15',
          },
        })
        if (!response.ok) return null
        const data = await response.json()
        const profile = data.data[0]
        const now = new Date()
        return {
          id: profile.id,
          name: profile.attributes.test_account ? 'Klaviyo Test' : 'Klaviyo User',
          email:
            profile.attributes.contact_information?.default_sender?.email ||
            `${profile.id}@klaviyo.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Klaviyo getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'convertkit',
    clientId: process.env.CONVERTKIT_CLIENT_ID as string,
    clientSecret: process.env.CONVERTKIT_CLIENT_SECRET as string,
    authorizationUrl: 'https://app.kit.com/oauth/authorize',
    tokenUrl: 'https://app.kit.com/oauth/token',
    userInfoUrl: 'https://api.kit.com/v4/account',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/convertkit`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.kit.com/v4/account', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const data = await response.json()
        const now = new Date()
        return {
          id: data.account_id.toString(),
          name: data.name || 'ConvertKit User',
          email: data.primary_email_address,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in ConvertKit getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'contentful',
    clientId: process.env.CONTENTFUL_CLIENT_ID as string,
    clientSecret: process.env.CONTENTFUL_CLIENT_SECRET as string,
    authorizationUrl: 'https://be.contentful.com/oauth/authorize',
    tokenUrl: 'https://be.contentful.com/oauth/token',
    userInfoUrl: 'https://api.contentful.com/users/me',
    scopes: ['content_management_manage'],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/contentful`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.contentful.com/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.sys.id,
          name: `${profile.firstName} ${profile.lastName}`,
          email: profile.email,
          image: profile.avatarUrl || null,
          emailVerified: profile.activated,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Contentful getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'sanity',
    clientId: process.env.SANITY_CLIENT_ID as string,
    clientSecret: process.env.SANITY_CLIENT_SECRET as string,
    authorizationUrl: 'https://api.sanity.io/v2021-06-07/auth/oauth/authorize',
    tokenUrl: 'https://api.sanity.io/v2021-06-07/auth/oauth/token',
    userInfoUrl: 'https://api.sanity.io/v2021-06-07/users/me',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sanity`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.sanity.io/v2021-06-07/users/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.id,
          name: profile.name || 'Sanity User',
          email: profile.email || `${profile.id}@sanity.user`,
          image: profile.profileImage || null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Sanity getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'vercel',
    clientId: process.env.VERCEL_CLIENT_ID as string,
    clientSecret: process.env.VERCEL_CLIENT_SECRET as string,
    authorizationUrl: 'https://vercel.com/oauth/authorize',
    tokenUrl: 'https://api.vercel.com/v2/oauth/access_token',
    userInfoUrl: 'https://api.vercel.com/v2/user',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/vercel`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.vercel.com/v2/user', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const data = await response.json()
        const profile = data.user
        const now = new Date()
        return {
          id: profile.uid,
          name: profile.name || profile.username,
          email: profile.email,
          image: profile.avatar || null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Vercel getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'planetscale',
    clientId: process.env.PLANETSCALE_CLIENT_ID as string,
    clientSecret: process.env.PLANETSCALE_CLIENT_SECRET as string,
    authorizationUrl: 'https://auth.planetscale.com/oauth/authorize',
    tokenUrl: 'https://auth.planetscale.com/oauth/token',
    userInfoUrl: 'https://api.planetscale.com/v1/user',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/planetscale`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.planetscale.com/v1/user', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.id,
          name: profile.display_name || 'PlanetScale User',
          email: profile.email,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in PlanetScale getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'segment',
    clientId: process.env.SEGMENT_CLIENT_ID as string,
    clientSecret: process.env.SEGMENT_CLIENT_SECRET as string,
    authorizationUrl: 'https://app.segment.com/oauth/authorize',
    tokenUrl: 'https://api.segmentapis.com/oauth/token',
    userInfoUrl: 'https://api.segmentapis.com/me',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/segment`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.segmentapis.com/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.user.id,
          name: profile.user.name || 'Segment User',
          email: profile.user.email,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Segment getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'zoho_crm',
    clientId: process.env.ZOHO_CRM_CLIENT_ID as string,
    clientSecret: process.env.ZOHO_CRM_CLIENT_SECRET as string,
    authorizationUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    userInfoUrl: 'https://accounts.zoho.com/oauth/user/info',
    scopes: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
    responseType: 'code',
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/zoho_crm`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://accounts.zoho.com/oauth/user/info', {
          headers: {
            Authorization: `Zoho-oauthtoken ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.ZUID,
          name: `${profile.First_Name || ''} ${profile.Last_Name || ''}`.trim() || 'Zoho User',
          email: profile.Email,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Zoho CRM getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'copper',
    clientId: process.env.COPPER_CLIENT_ID as string,
    clientSecret: process.env.COPPER_CLIENT_SECRET as string,
    authorizationUrl: 'https://app.copper.com/oauth/authorize',
    tokenUrl: 'https://app.copper.com/oauth/token',
    userInfoUrl: 'https://api.copper.com/developer_api/v1/account',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/copper`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.copper.com/developer_api/v1/account', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': 'oauth-user@copper.com',
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.id?.toString() || 'copper-user',
          name: profile.name || 'Copper User',
          email: profile.email || 'oauth-user@copper.com',
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Copper getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'close',
    clientId: process.env.CLOSE_CLIENT_ID as string,
    clientSecret: process.env.CLOSE_CLIENT_SECRET as string,
    authorizationUrl: 'https://app.close.com/oauth2/authorize',
    tokenUrl: 'https://api.close.com/oauth2/token',
    userInfoUrl: 'https://api.close.com/api/v1/me',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/close`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.close.com/api/v1/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.id,
          name: profile.name || profile.email || 'Close User',
          email: profile.email,
          image: profile.image,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Close getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'wrike',
    clientId: process.env.WRIKE_CLIENT_ID as string,
    clientSecret: process.env.WRIKE_CLIENT_SECRET as string,
    authorizationUrl: 'https://www.wrike.com/oauth2/authorize/v4',
    tokenUrl: 'https://www.wrike.com/oauth2/token',
    userInfoUrl: 'https://www.wrike.com/api/v4/contacts',
    scopes: ['Default', 'wsReadWrite'],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/wrike`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://www.wrike.com/api/v4/contacts?me=true', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const contact = profile.data?.[0]
        const now = new Date()
        return {
          id: contact?.id || 'wrike-user',
          name: `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || 'Wrike User',
          email: contact?.profiles?.[0]?.email || 'oauth-user@wrike.com',
          image: contact?.avatarUrl,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Wrike getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'gusto',
    clientId: process.env.GUSTO_CLIENT_ID as string,
    clientSecret: process.env.GUSTO_CLIENT_SECRET as string,
    authorizationUrl: 'https://api.gusto.com/oauth/authorize',
    tokenUrl: 'https://api.gusto.com/oauth/token',
    userInfoUrl: 'https://api.gusto.com/v1/me',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/gusto`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.gusto.com/v1/me', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profile = await response.json()
        const now = new Date()
        return {
          id: profile.uuid || 'gusto-user',
          name: profile.name || profile.email || 'Gusto User',
          email: profile.email,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Gusto getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'bamboohr',
    clientId: process.env.BAMBOOHR_CLIENT_ID as string,
    clientSecret: process.env.BAMBOOHR_CLIENT_SECRET as string,
    authorizationUrl: 'https://api.bamboohr.com/oauth2/authorize',
    tokenUrl: 'https://api.bamboohr.com/oauth2/token',
    userInfoUrl: 'https://api.bamboohr.com/api/gateway.php/v1/employees/directory',
    scopes: [],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/bamboohr`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch(
          'https://api.bamboohr.com/api/gateway.php/v1/employees/directory',
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          }
        )
        if (!response.ok) return null
        const profile = await response.json()
        const employee = profile.employees?.[0]
        const now = new Date()
        return {
          id: employee?.id?.toString() || 'bamboohr-user',
          name:
            `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'BambooHR User',
          email: employee?.workEmail || 'oauth-user@bamboohr.com',
          image: employee?.photoUrl,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in BambooHR getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'wise',
    clientId: process.env.WISE_CLIENT_ID as string,
    clientSecret: process.env.WISE_CLIENT_SECRET as string,
    authorizationUrl: 'https://api.wise.com/oauth/authorize',
    tokenUrl: 'https://api.wise.com/oauth/token',
    userInfoUrl: 'https://api.wise.com/v1/profiles',
    scopes: ['transfers', 'balances', 'profiles'],
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/wise`,
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.wise.com/v1/profiles', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const profiles = await response.json()
        const profile = profiles?.[0]
        const now = new Date()
        return {
          id: profile?.id?.toString() || 'wise-user',
          name:
            profile?.fullName ||
            profile?.details?.firstName + ' ' + profile?.details?.lastName ||
            'Wise User',
          email: profile?.details?.email || 'oauth-user@wise.com',
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Wise getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'stripe',
    clientId: process.env.STRIPE_CLIENT_ID as string,
    clientSecret: process.env.STRIPE_CLIENT_SECRET as string,
    authorizationUrl: 'https://connect.stripe.com/oauth/authorize',
    tokenUrl: 'https://api.stripe.com/v1/oauth/token',
    userInfoUrl: 'https://api.stripe.com/v1/account',
    scopes: ['read_write'], // Available scopes: 'read_only' or 'read_write'
    responseType: 'code',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/stripe`,
    // Stripe Connect OAuth supports prefilling user data via stripe_user parameters:
    // stripe_user[email], stripe_user[url], stripe_user[country], stripe_user[phone_number],
    // stripe_user[business_name], stripe_user[business_type], stripe_user[first_name],
    // stripe_user[last_name], stripe_user[dob_day/month/year], stripe_user[street_address]
    getUserInfo: async (tokens: any) => {
      try {
        const response = await fetch('https://api.stripe.com/v1/account', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })
        if (!response.ok) return null
        const account = await response.json()
        const now = new Date()
        return {
          id: account.id,
          name:
            account.business_profile?.name ||
            account.email ||
            account.settings?.dashboard?.display_name ||
            'Stripe User',
          email: account.email,
          image: null,
          emailVerified: account.email ? true : false,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in Stripe getUserInfo:', { error })
        return null
      }
    },
  },
]

/**
 * Trusted providers list for account linking.
 */
export const trustedProviders = [
  'google',
  'github',
  'email-password',
  'confluence',
  'supabase',
  'x',
  'notion',
  'microsoft-teams',
  'microsoft-outlook',
  'microsoft-onedrive',
  'microsoft-sharepoint',
  'linkedin',
  'sap-s4hana',
  'sap-successfactors',
  'sap-concur',
  'sap-ariba',
  'sap-fieldglass',
  'sap-business-one',
  'figma',
  'canva',
  'bitbucket',
  'adobe-cc',
  'zoho_crm',
  'copper',
  'close',
  'wrike',
  'gusto',
  'bamboohr',
  'wise',
  'stripe',
] as const
