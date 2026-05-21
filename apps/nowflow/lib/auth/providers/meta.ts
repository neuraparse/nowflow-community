/**
 * Meta OAuth provider configurations.
 *
 * Refactored to use `createOAuthProvider` from `_factory.ts`. All three
 * Meta providers (Facebook, Instagram, WhatsApp) share the same OAuth
 * endpoints, client credentials, and Graph API user-info shape — only the
 * scope set differs per surface.
 */
import { logger } from '../helpers'
import { buildProviderList, type OAuthProviderTemplate } from './_factory'

const META_AUTHORIZATION_URL = 'https://www.facebook.com/v24.0/dialog/oauth'
const META_TOKEN_URL = 'https://graph.facebook.com/v24.0/oauth/access_token'
const META_USERINFO_URL = 'https://graph.facebook.com/v24.0/me'

const buildMetaGetUserInfo = (label: string) => async (tokens: any) => {
  try {
    const response = await fetch(`${META_USERINFO_URL}?fields=id,name,email`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })

    if (!response.ok) {
      // Facebook surface: the original implementation logged status only here.
      if (label === 'Facebook') {
        logger.error('Error fetching Facebook user info:', {
          status: response.status,
          statusText: response.statusText,
        })
      }
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
    logger.error(`Error in Meta ${label} getUserInfo:`, { error })
    return null
  }
}

const META_TEMPLATES: OAuthProviderTemplate[] = [
  {
    providerId: 'meta-facebook',
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    authorizationUrl: META_AUTHORIZATION_URL,
    tokenUrl: META_TOKEN_URL,
    userInfoUrl: META_USERINFO_URL,
    scopes: [
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_show_list',
      'pages_manage_metadata',
      'pages_read_user_content',
      'business_management',
    ],
    extra: { responseType: 'code', accessType: 'offline' },
    getUserInfo: buildMetaGetUserInfo('Facebook'),
  },
  {
    providerId: 'meta-instagram',
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    authorizationUrl: META_AUTHORIZATION_URL,
    tokenUrl: META_TOKEN_URL,
    userInfoUrl: META_USERINFO_URL,
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ],
    extra: { responseType: 'code', accessType: 'offline' },
    getUserInfo: buildMetaGetUserInfo('Instagram'),
  },
  {
    providerId: 'meta-whatsapp',
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    authorizationUrl: META_AUTHORIZATION_URL,
    tokenUrl: META_TOKEN_URL,
    userInfoUrl: META_USERINFO_URL,
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management', 'business_management'],
    extra: { responseType: 'code', accessType: 'offline' },
    getUserInfo: buildMetaGetUserInfo('WhatsApp'),
  },
]

export const META_PROVIDERS = buildProviderList(META_TEMPLATES)
