/**
 * Better-Auth `trustedProviders` list — controls which providers are allowed
 * to participate in account linking on sign-in (i.e. an existing email-bound
 * user can sign in via these providers without requiring a separate manual
 * link step).
 *
 * Extracted from `lib/auth/providers.ts` so the link-trust surface lives in
 * its own module. The canonical import path remains `from '@/lib/auth/providers'`
 * — the parent module re-exports `trustedProviders`.
 *
 * Adding a provider here does NOT enable it; it only declares that, if it
 * IS enabled (via `socialProviders` or `genericOAuthProviders`), its
 * authenticated identity may be linked to an existing user with a matching
 * verified email.
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
  'slack',
] as const
