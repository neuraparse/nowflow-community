/**
 * Google OAuth provider configurations.
 *
 * Extracted from lib/auth/providers.ts. Order preserved from the original
 * genericOAuthProviders array.
 */

export const GOOGLE_PROVIDERS = [
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
]
