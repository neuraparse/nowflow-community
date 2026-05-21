/**
 * Feature flag / experiment gate for the executor. Hosts wire this to their
 * flag system (LaunchDarkly, PostHog, config, etc.).
 */
export interface ExperimentProvider {
  isEnabled(flag: string, context?: Record<string, unknown>): boolean
  variant?(flag: string, context?: Record<string, unknown>): string | undefined
}
