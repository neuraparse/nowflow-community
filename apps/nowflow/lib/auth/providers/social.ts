/**
 * Better-Auth `socialProviders` configuration.
 *
 * Extracted from `lib/auth/providers.ts` so the social-login surface
 * (GitHub + Google email/profile) lives in a focused module. The canonical
 * import path remains `from '@/lib/auth/providers'` — the parent module
 * re-exports `socialProviders`.
 *
 * Each provider config is conditionally included based on env-var presence
 * so the betterAuth runtime simply doesn't see a provider whose credentials
 * aren't configured.
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
