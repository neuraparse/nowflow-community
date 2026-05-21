/**
 * Barrel export for the execution namespace.
 *
 * Currently a single-module domain (env-var resolution + decryption +
 * template `{{ENV.X}}` interpolation). Wrapped in a barrel so future
 * additions (rate-limit + cost-budget + cancellation) plug in cleanly.
 */

export { buildEffectiveEnvVars, getUserEnvDecrypted, resolveTemplateEnvOrThrow } from './env-vars'
