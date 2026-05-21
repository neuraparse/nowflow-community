/**
 * Resolves secret references (e.g. workspace-scoped credentials) to
 * concrete values for the executor. Implementations are expected to scope
 * lookups by workspace / user as appropriate.
 */
export interface SecretProvider {
  get(key: string): Promise<string | undefined>
  has(key: string): Promise<boolean>
}
