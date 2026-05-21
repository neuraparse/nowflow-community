import fs from 'node:fs/promises'
import path from 'node:path'
import 'server-only'

export type BackupSettings = {
  retentionCount: number
  maxAgeDays: number
}

export type BackupInfo = {
  name: string
  sizeBytes: number
  createdAt: string
  updatedAt: string
}

const DEFAULT_SETTINGS: BackupSettings = {
  retentionCount: 20,
  maxAgeDays: 30,
}

export function getBackupDir(): string {
  return process.env.DB_BACKUP_DIR || path.join(process.cwd(), 'data', 'db-backups')
}

export async function ensureBackupDir(): Promise<string> {
  const dir = getBackupDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export function getDbMaintenanceMaxBytes(): number {
  const raw = process.env.DB_RESTORE_MAX_BYTES
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return 500 * 1024 * 1024
}

export function assertValidBackupName(name: string): string {
  const normalized = name.trim()
  if (!normalized) throw new Error('Missing backup name')
  if (normalized.includes('/') || normalized.includes('\\')) throw new Error('Invalid backup name')
  if (!/^[a-zA-Z0-9._-]+\.sql$/i.test(normalized)) throw new Error('Invalid backup filename')
  return normalized
}

export async function getBackupPath(name: string): Promise<string> {
  const safeName = assertValidBackupName(name)
  const dir = await ensureBackupDir()
  return path.join(dir, safeName)
}

function settingsPath(dir: string): string {
  return path.join(dir, 'settings.json')
}

export async function readBackupSettings(): Promise<BackupSettings> {
  const dir = await ensureBackupDir()
  try {
    const raw = await fs.readFile(settingsPath(dir), 'utf8')
    const parsed = JSON.parse(raw) as Partial<BackupSettings>
    return {
      retentionCount:
        typeof parsed.retentionCount === 'number' && Number.isFinite(parsed.retentionCount)
          ? Math.max(0, Math.floor(parsed.retentionCount))
          : DEFAULT_SETTINGS.retentionCount,
      maxAgeDays:
        typeof parsed.maxAgeDays === 'number' && Number.isFinite(parsed.maxAgeDays)
          ? Math.max(0, Math.floor(parsed.maxAgeDays))
          : DEFAULT_SETTINGS.maxAgeDays,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function writeBackupSettings(next: Partial<BackupSettings>): Promise<BackupSettings> {
  const dir = await ensureBackupDir()
  const current = await readBackupSettings()
  const merged: BackupSettings = {
    retentionCount:
      typeof next.retentionCount === 'number' && Number.isFinite(next.retentionCount)
        ? Math.max(0, Math.floor(next.retentionCount))
        : current.retentionCount,
    maxAgeDays:
      typeof next.maxAgeDays === 'number' && Number.isFinite(next.maxAgeDays)
        ? Math.max(0, Math.floor(next.maxAgeDays))
        : current.maxAgeDays,
  }
  await fs.writeFile(settingsPath(dir), JSON.stringify(merged, null, 2) + '\n', 'utf8')
  return merged
}

export async function listBackups(): Promise<BackupInfo[]> {
  const dir = await ensureBackupDir()
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const sqlFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.sql'))

  const infos = await Promise.all(
    sqlFiles.map(async (entry) => {
      const full = path.join(dir, entry.name)
      const stat = await fs.stat(full)
      return {
        name: entry.name,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      } satisfies BackupInfo
    })
  )

  infos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return infos
}

export async function acquireDbMaintenanceLock(
  kind: 'restore' | 'backup'
): Promise<{ lockPath: string }> {
  const dir = await ensureBackupDir()
  const lockPath = path.join(dir, `.db-${kind}.lock`)
  try {
    const handle = await fs.open(lockPath, 'wx')
    await handle.writeFile(
      JSON.stringify(
        {
          kind,
          pid: process.pid,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ) + '\n'
    )
    await handle.close()
  } catch (error) {
    const isEexist =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as any).code === 'EEXIST'

    if (isEexist) {
      const ttlRaw = process.env.DB_MAINTENANCE_LOCK_TTL_MS
      const ttlMs = ttlRaw ? Number.parseInt(ttlRaw, 10) : NaN
      const effectiveTtlMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 60 * 60 * 1000

      try {
        const stat = await fs.stat(lockPath)
        const ageMs = Date.now() - stat.mtimeMs
        if (ageMs > effectiveTtlMs) {
          await fs.unlink(lockPath)
          return await acquireDbMaintenanceLock(kind)
        }
      } catch {
        // If we can't stat/unlink, fall through to a standard "in progress" error.
      }
    }

    const message = error instanceof Error ? error.message : 'Failed to acquire lock'
    throw new Error(`${kind === 'restore' ? 'Restore' : 'Backup'} already in progress (${message})`)
  }
  return { lockPath }
}

export async function releaseDbMaintenanceLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath)
  } catch {
    // ignore
  }
}

export async function applyBackupRetention(): Promise<{
  deleted: string[]
  kept: string[]
  settings: BackupSettings
}> {
  const settings = await readBackupSettings()
  const backups = await listBackups()

  const deleted: string[] = []
  const kept: string[] = []
  const now = Date.now()

  const tooOldThreshold =
    settings.maxAgeDays > 0 ? now - settings.maxAgeDays * 24 * 60 * 60 * 1000 : null

  // Start with newest first (listBackups already sorted).
  for (let i = 0; i < backups.length; i++) {
    const backup = backups[i]
    const updatedAtMs = new Date(backup.updatedAt).getTime()

    const overCount = settings.retentionCount > 0 && i >= settings.retentionCount
    const tooOld = tooOldThreshold !== null && updatedAtMs < tooOldThreshold

    if (overCount || tooOld) {
      try {
        await fs.unlink(await getBackupPath(backup.name))
        deleted.push(backup.name)
      } catch {
        // Best-effort cleanup; keep listing stable even if deletion fails.
      }
    } else {
      kept.push(backup.name)
    }
  }

  return { deleted, kept, settings }
}
