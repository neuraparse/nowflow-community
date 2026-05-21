/**
 * One-shot migration script: encrypt plaintext webhook signing secrets.
 *
 * Background: `webhook.secret_key` was historically written as plaintext.
 * Sprint 2 introduced AES-256-GCM encryption at rest via
 * `lib/webhooks/secret.ts#encryptWebhookSecret`. The trigger handler still
 * accepts plaintext on read (logs a warning), but operators should run this
 * script once per environment to migrate every existing row to the canonical
 * `iv:ciphertext:authTag` envelope.
 *
 * Usage:
 *   tsx apps/nowflow/scripts/migrate-webhook-secrets.ts --dry-run   # report only
 *   tsx apps/nowflow/scripts/migrate-webhook-secrets.ts --yes       # commit updates
 *
 * Exit codes:
 *   0 - every plaintext row successfully migrated (or nothing to migrate)
 *   1 - one or more rows failed to encrypt / not in --yes mode with pending work
 */
import { eq, isNotNull } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { encryptWebhookSecret, isEncryptedSecret } from '@/lib/webhooks/secret'
import { db } from '@/db'
import { webhook } from '@/db/schema'

const logger = createLogger('migrate-webhook-secrets')

export type MigrationArgs = {
  dryRun: boolean
  yes: boolean
}

export type MigrationReport = {
  scanned: number
  alreadyEncrypted: number
  migrated: number
  failed: number
  failedIds: string[]
}

export function parseArgs(argv: string[]): MigrationArgs {
  return {
    dryRun: argv.includes('--dry-run'),
    yes: argv.includes('--yes'),
  }
}

export async function migrateWebhookSecrets(args: MigrationArgs): Promise<MigrationReport> {
  const report: MigrationReport = {
    scanned: 0,
    alreadyEncrypted: 0,
    migrated: 0,
    failed: 0,
    failedIds: [],
  }

  const rows = await db
    .select({ id: webhook.id, secretKey: webhook.secretKey })
    .from(webhook)
    .where(isNotNull(webhook.secretKey))

  for (const row of rows) {
    report.scanned++
    const stored = row.secretKey
    if (!stored) continue

    if (isEncryptedSecret(stored)) {
      report.alreadyEncrypted++
      continue
    }

    if (args.dryRun) {
      // Dry-run: count what we WOULD migrate without writing.
      report.migrated++
      continue
    }

    if (!args.yes) {
      // Without --yes, defer the row but treat it as pending so the script
      // exits non-zero and the operator notices unwritten work.
      report.failed++
      report.failedIds.push(row.id)
      continue
    }

    try {
      const encrypted = await encryptWebhookSecret(stored)
      await db
        .update(webhook)
        .set({ secretKey: encrypted, updatedAt: new Date() })
        .where(eq(webhook.id, row.id))
      report.migrated++
    } catch (err) {
      report.failed++
      report.failedIds.push(row.id)
      logger.error('Failed to encrypt webhook secret', {
        id: row.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return report
}

function printReport(report: MigrationReport, args: MigrationArgs) {
  logger.info('Webhook secret migration complete', {
    mode: args.dryRun ? 'dry-run' : args.yes ? 'commit' : 'pending (no --yes)',
    ...report,
  })
  // Also print a concise human-readable summary to stdout for CI logs.
  // eslint-disable-next-line no-console
  console.log(
    [
      `scanned=${report.scanned}`,
      `already-encrypted=${report.alreadyEncrypted}`,
      `migrated=${report.migrated}`,
      `failed=${report.failed}`,
      report.failedIds.length > 0 ? `failed-ids=${report.failedIds.join(',')}` : '',
    ]
      .filter(Boolean)
      .join(' ')
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.dryRun && !args.yes) {
    // eslint-disable-next-line no-console
    console.error(
      'Refusing to run without --dry-run or --yes. ' +
        'Re-invoke with --dry-run to preview, or --yes to commit.'
    )
    process.exit(1)
  }

  const report = await migrateWebhookSecrets(args)
  printReport(report, args)

  // Exit 1 if there's pending work (rows that need migration but the operator
  // didn't pass --yes), or if any row failed to migrate.
  const exitCode = report.failed > 0 ? 1 : 0
  process.exit(exitCode)
}

// Only auto-run when invoked as the entry point — keeps the module importable
// from tests without triggering the migration.
if (require.main === module) {
  main().catch((err) => {
    logger.error('Migration crashed', {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  })
}
