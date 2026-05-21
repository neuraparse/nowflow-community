import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateWebhookSecrets, parseArgs } from '../migrate-webhook-secrets'

const { selectRowsRef, updateCalls } = vi.hoisted(() => ({
  selectRowsRef: { value: [] as Array<{ id: string; secretKey: string | null }> },
  updateCalls: [] as Array<{ id: string; secretKey: string }>,
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _eq: true, a, b })),
  isNotNull: vi.fn((c) => ({ _isNotNull: true, c })),
}))

vi.mock('@/db/schema', () => ({
  webhook: {
    id: 'webhook.id',
    secretKey: 'webhook.secret_key',
    updatedAt: 'webhook.updated_at',
  },
}))

vi.mock('@/db', () => {
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => Promise.resolve(selectRowsRef.value)),
  }
  const updateChain: any = {
    set: vi.fn((values: any) => {
      updateChain._set = values
      return updateChain
    }),
    where: vi.fn((predicate: any) => {
      // The predicate is `and(userId, eq(webhook.id, X))` but our mock for `eq`
      // returns the literal. Last mock call is the row id.
      const id = (predicate as any)?.b ?? 'unknown'
      updateCalls.push({ id, secretKey: updateChain._set.secretKey })
      return Promise.resolve()
    }),
  }
  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    },
  }
})

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-key-deterministic-do-not-use-in-prod'
})

beforeEach(() => {
  selectRowsRef.value = []
  updateCalls.length = 0
})

describe('parseArgs', () => {
  it('detects --dry-run', () => {
    expect(parseArgs(['--dry-run'])).toEqual({ dryRun: true, yes: false })
  })
  it('detects --yes', () => {
    expect(parseArgs(['--yes'])).toEqual({ dryRun: false, yes: true })
  })
  it('handles both flags', () => {
    expect(parseArgs(['--dry-run', '--yes'])).toEqual({ dryRun: true, yes: true })
  })
  it('handles empty args', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, yes: false })
  })
})

describe('migrateWebhookSecrets', () => {
  it('reports zero work when no rows have a secretKey', async () => {
    selectRowsRef.value = []
    const report = await migrateWebhookSecrets({ dryRun: true, yes: false })
    expect(report).toEqual({
      scanned: 0,
      alreadyEncrypted: 0,
      migrated: 0,
      failed: 0,
      failedIds: [],
    })
  })

  it('skips rows already in encrypted format', async () => {
    // Build a real encrypted-format value via the helper.
    const { encryptWebhookSecret } = await import('@/lib/webhooks/secret')
    const encrypted = await encryptWebhookSecret('plaintext')
    selectRowsRef.value = [{ id: 'w-1', secretKey: encrypted }]
    const report = await migrateWebhookSecrets({ dryRun: true, yes: false })
    expect(report.scanned).toBe(1)
    expect(report.alreadyEncrypted).toBe(1)
    expect(report.migrated).toBe(0)
    expect(updateCalls).toHaveLength(0)
  })

  it('counts plaintext rows in dry-run without writing', async () => {
    selectRowsRef.value = [
      { id: 'w-1', secretKey: 'plaintext-a' },
      { id: 'w-2', secretKey: 'plaintext-b' },
    ]
    const report = await migrateWebhookSecrets({ dryRun: true, yes: false })
    expect(report.scanned).toBe(2)
    expect(report.migrated).toBe(2)
    expect(report.failed).toBe(0)
    expect(updateCalls).toHaveLength(0) // no writes in dry-run
  })

  it('treats pending rows as failed when --yes is missing (non-dry-run)', async () => {
    selectRowsRef.value = [{ id: 'w-1', secretKey: 'plaintext' }]
    const report = await migrateWebhookSecrets({ dryRun: false, yes: false })
    expect(report.scanned).toBe(1)
    expect(report.failed).toBe(1)
    expect(report.failedIds).toEqual(['w-1'])
    expect(updateCalls).toHaveLength(0)
  })

  it('encrypts and writes plaintext rows when --yes is supplied', async () => {
    selectRowsRef.value = [
      { id: 'w-1', secretKey: 'plaintext-1' },
      { id: 'w-2', secretKey: 'plaintext-2' },
    ]
    const report = await migrateWebhookSecrets({ dryRun: false, yes: true })
    expect(report.scanned).toBe(2)
    expect(report.migrated).toBe(2)
    expect(report.failed).toBe(0)
    expect(updateCalls).toHaveLength(2)
    // Verify the values written are the encrypted envelope (not plaintext).
    const { isEncryptedSecret, decryptWebhookSecret } = await import('@/lib/webhooks/secret')
    for (const call of updateCalls) {
      expect(isEncryptedSecret(call.secretKey)).toBe(true)
    }
    expect(await decryptWebhookSecret(updateCalls[0].secretKey)).toBe('plaintext-1')
    expect(await decryptWebhookSecret(updateCalls[1].secretKey)).toBe('plaintext-2')
  })

  it('skips rows whose secretKey is null/empty', async () => {
    selectRowsRef.value = [
      { id: 'w-1', secretKey: null },
      { id: 'w-2', secretKey: '' },
      { id: 'w-3', secretKey: 'plaintext' },
    ]
    const report = await migrateWebhookSecrets({ dryRun: false, yes: true })
    expect(report.scanned).toBe(3)
    expect(report.migrated).toBe(1)
    expect(updateCalls).toHaveLength(1)
  })
})
