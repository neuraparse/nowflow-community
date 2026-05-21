/**
 * Auth configuration - re-exports from modular auth directory.
 *
 * This file exists for backward compatibility so that imports like
 * `import { auth, getSession } from '@/lib/auth'` continue to work.
 *
 * The actual implementation is split across:
 *   - auth/helpers.ts    (logger, stripe client, email wrapper)
 *   - auth/providers.ts  (OAuth provider configs)
 *   - auth/plugins.ts    (auth plugins configuration)
 *   - auth/callbacks.ts  (database hooks, email/password config, pages)
 *   - auth/types.ts      (auth-related types)
 *   - auth/index.ts      (composition root)
 */
export { auth, getSession, signIn, signUp } from './auth/index'
