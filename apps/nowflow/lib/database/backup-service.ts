import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import 'server-only'
import {
  acquireDbMaintenanceLock,
  applyBackupRetention,
  ensureBackupDir,
  releaseDbMaintenanceLock,
} from '@/lib/database/backup-store'
import {
  getPgBinaryMajorVersion,
  getPgConnectionFromEnv,
  getServerMajorVersion,
  resolvePgBinary,
} from '@/lib/database/pg-utils'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DatabaseBackupService')

function isoFilenameFragment() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export async function createSavedBackup(): Promise<{
  backup: { name: string; sizeBytes: number; createdAt: string; updatedAt: string }
  retention: Awaited<ReturnType<typeof applyBackupRetention>>
}> {
  const lock = await acquireDbMaintenanceLock('backup')
  try {
    const pg = getPgConnectionFromEnv()
    const serverMajor = await getServerMajorVersion(pg.connectionString)
    const pgDumpBinary = resolvePgBinary('pg_dump', serverMajor)
    const pgDumpMajor = getPgBinaryMajorVersion(pgDumpBinary)

    if (serverMajor && pgDumpMajor && pgDumpMajor < serverMajor) {
      throw new Error(
        `pg_dump version (${pgDumpMajor}) is older than server (${serverMajor}). Install Postgres client ${serverMajor}+ or set PG_DUMP_PATH.`
      )
    }

    const dir = await ensureBackupDir()
    const name = `nowflow-db-backup-${isoFilenameFragment()}.sql`
    const fullPath = path.join(dir, name)

    const args = [
      '--host',
      pg.host,
      '--port',
      pg.port,
      '--username',
      pg.user,
      '--dbname',
      pg.database,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
    ]

    const child = spawn(pgDumpBinary, args, {
      env: {
        ...process.env,
        LANG: process.env.LANG || 'C',
        LC_ALL: process.env.LC_ALL || 'C',
        ...(pg.password ? { PGPASSWORD: pg.password } : {}),
        ...(pg.sslmode ? { PGSSLMODE: pg.sslmode } : {}),
        PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '30',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stderrChunks: Buffer[] = []
    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk)
      if (stderrChunks.reduce((n, b) => n + b.length, 0) > 64 * 1024) {
        stderrChunks.splice(0, stderrChunks.length - 2)
      }
    })

    const out = createWriteStream(fullPath, { flags: 'wx' })
    try {
      await pipeline(child.stdout, out)
    } catch (err) {
      child.kill('SIGTERM')
      throw err
    }

    const exitCode: number = await new Promise((resolve, reject) => {
      child.on('error', reject)
      child.on('close', (code) => resolve(code ?? 1))
    })

    if (exitCode !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
      try {
        await fs.unlink(fullPath)
      } catch {}
      throw new Error(stderr || `pg_dump exited with code ${exitCode}`)
    }

    const stat = await fs.stat(fullPath)
    const retention = await applyBackupRetention()

    logger.info('Created saved backup', { name, bytes: stat.size })

    return {
      backup: {
        name,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      },
      retention,
    }
  } finally {
    await releaseDbMaintenanceLock(lock.lockPath)
  }
}
