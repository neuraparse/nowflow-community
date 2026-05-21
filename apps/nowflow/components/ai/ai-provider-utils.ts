const PROVIDER_ICONS: Record<string, string> = {
  ollama: '🦙',
  openai: '🤖',
  anthropic: '🧠',
  groq: '⚡',
  together: '🤝',
}

export const getProviderIcon = (provider: string): string => PROVIDER_ICONS[provider] ?? '❓'

export const getProviderStatusBadgeClass = (available: boolean): string =>
  available
    ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
    : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
