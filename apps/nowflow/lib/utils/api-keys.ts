/**
 * API key generation + rotation helpers.
 *
 * Extracted from `lib/utils.ts` so the API-key surface lives in a focused
 * module. Callers should import from `@/lib/utils` (the canonical entry —
 * re-exports these symbols) unless they're inside this package.
 */
import { nanoid } from 'nanoid'

/** Generates a standardized API key with the 'nowflow_' prefix. */
export function generateApiKey(): string {
  return `nowflow_${nanoid(32)}`
}

/**
 * Round-robin select a configured rotating API key for a provider.
 * Pulls from `<PROVIDER>_API_KEY_{1,2,3}` env vars, distributes via the
 * current minute (stateless, no state writes).
 *
 * @throws Error if no keys are configured for the provider.
 */
export function getRotatingApiKey(provider: string): string {
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new Error(`No rotation implemented for provider: ${provider}`)
  }

  const keys: string[] = []

  if (provider === 'openai') {
    if (process.env.OPENAI_API_KEY_1) keys.push(process.env.OPENAI_API_KEY_1)
    if (process.env.OPENAI_API_KEY_2) keys.push(process.env.OPENAI_API_KEY_2)
    if (process.env.OPENAI_API_KEY_3) keys.push(process.env.OPENAI_API_KEY_3)
  } else if (provider === 'anthropic') {
    if (process.env.ANTHROPIC_API_KEY_1) keys.push(process.env.ANTHROPIC_API_KEY_1)
    if (process.env.ANTHROPIC_API_KEY_2) keys.push(process.env.ANTHROPIC_API_KEY_2)
    if (process.env.ANTHROPIC_API_KEY_3) keys.push(process.env.ANTHROPIC_API_KEY_3)
  }

  if (keys.length === 0) {
    throw new Error(
      `No API keys configured for rotation. Please configure ${provider.toUpperCase()}_API_KEY_1, ${provider.toUpperCase()}_API_KEY_2, or ${provider.toUpperCase()}_API_KEY_3.`
    )
  }

  const currentMinute = new Date().getMinutes()
  const keyIndex = currentMinute % keys.length

  return keys[keyIndex]
}
