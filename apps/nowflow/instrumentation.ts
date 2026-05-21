/**
 * Next.js instrumentation hook — runs once on server start.
 *
 * Validates critical runtime configuration (ENCRYPTION_KEY) so the app
 * refuses to boot in production with missing/default secrets instead of
 * silently falling back to an insecure key.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEncryptionKey } = await import('./lib/ai/encryption')
    validateEncryptionKey()

    // Snapshot the code-runner topology once so operators can see which
    // execution backend is live (Freestyle, QuickJS, …) without curl'ing a
    // healthcheck. The dispatcher's `logRunnerSnapshotOnce` is idempotent.
    const { logRunnerSnapshotOnce } = await import('./lib/code-execution')
    logRunnerSnapshotOnce()
  }
}
