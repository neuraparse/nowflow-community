'use client'

import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from 'react'
import type { FlagKey } from '@/lib/feature-flags'

/**
 * Snapshot of resolved flag values shared through React context. Servers
 * compute these once per request (via `isFeatureEnabled`) and hand them to the
 * provider so clients never block the render to ask. Missing keys default to
 * `false` which keeps SSR fail-safe.
 */
export type FeatureFlagSnapshot = Partial<Record<FlagKey, boolean>>

type FeatureFlagContextValue = {
  snapshot: FeatureFlagSnapshot
  subscribe?: (listener: () => void) => () => void
  getSnapshot?: () => FeatureFlagSnapshot
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null)

export type FeatureFlagProviderProps = {
  /** Pre-resolved flag values. Typically produced on the server. */
  flags?: FeatureFlagSnapshot
  /**
   * Optional live-update hooks for long-lived clients. When provided,
   * {@link useFeatureFlag} subscribes via `useSyncExternalStore` so flips
   * propagate without a remount.
   */
  subscribe?: (listener: () => void) => () => void
  getSnapshot?: () => FeatureFlagSnapshot
  children: ReactNode
}

/**
 * Wrap the client tree with this provider from a server component so SSR
 * hydration sees the same values as the first client render. When no provider
 * is present, every flag evaluates to `false` — safer than leaking a
 * half-rolled-out feature to everyone during hydration.
 */
export function FeatureFlagProvider({
  flags,
  subscribe,
  getSnapshot,
  children,
}: FeatureFlagProviderProps) {
  const value: FeatureFlagContextValue = {
    snapshot: flags ?? {},
    subscribe,
    getSnapshot,
  }
  return createElement(FeatureFlagContext.Provider, { value }, children)
}

/**
 * Read a single feature flag. Returns `false` when:
 *   - No provider is mounted (SSR without wiring, or a misconfigured tree).
 *   - The flag is absent from the snapshot.
 * This matches the server-side fail-safe so UI never "flashes" a gated
 * feature on first paint.
 */
export function useFeatureFlag(flag: FlagKey): boolean {
  const ctx = useContext(FeatureFlagContext)

  const snapshot = useSyncExternalStore(
    ctx?.subscribe ?? noopSubscribe,
    () => (ctx?.getSnapshot ? ctx.getSnapshot() : (ctx?.snapshot ?? EMPTY)),
    () => EMPTY
  )

  return snapshot[flag] === true
}

const EMPTY: FeatureFlagSnapshot = Object.freeze({})

function noopSubscribe(): () => void {
  return () => {}
}
