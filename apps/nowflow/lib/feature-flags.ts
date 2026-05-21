export const featureFlags = {} as const

export type FlagKey = keyof typeof featureFlags

export function isFeatureEnabled(_flag: FlagKey): boolean {
  return false
}
