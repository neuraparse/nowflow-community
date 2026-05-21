import { spawnSync } from 'node:child_process'
import postgres from 'postgres'
import 'server-only'

export type PgConnectionInfo = {
  connectionString: string
  host: string
  port: string
  user: string
  password: string
  database: string
  sslmode?: string
}

export function getPgConnectionFromEnv(): PgConnectionInfo {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error('Missing POSTGRES_URL/DATABASE_URL')

  const url = new URL(connectionString)
  const database = url.pathname.replace(/^\//, '')
  if (!database) throw new Error('Database name missing in connection string')

  return {
    connectionString,
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    database,
    sslmode: url.searchParams.get('sslmode') || undefined,
  }
}

export async function getServerMajorVersion(connectionString: string): Promise<number | null> {
  const sql = postgres(connectionString, { prepare: false, max: 1 })
  try {
    const result = await sql<{ server_version_num: string }[]>`SHOW server_version_num`
    const versionNum = Number.parseInt(result?.[0]?.server_version_num || '', 10)
    if (!Number.isFinite(versionNum)) return null
    return Math.floor(versionNum / 10000)
  } catch {
    return null
  } finally {
    await sql.end({ timeout: 2 })
  }
}

function parseBinaryMajorVersion(versionOutput: string): number | null {
  // Examples:
  // - "pg_dump (PostgreSQL) 16.11 (Debian 16.11-1.pgdg13+1)"
  // - "psql (PostgreSQL) 16.1"
  const match = versionOutput.match(/\b(PostgreSQL)\)\s+(\d+)\./i)
  if (!match) return null
  const major = Number.parseInt(match[2], 10)
  return Number.isFinite(major) ? major : null
}

export function getPgBinaryMajorVersion(binaryPath: string): number | null {
  const res = spawnSync(binaryPath, ['--version'], { encoding: 'utf8', timeout: 2000 })
  const out = (res.stdout || '') + (res.stderr || '')
  if (!out.trim()) return null
  return parseBinaryMajorVersion(out)
}

export function resolvePgBinary(name: 'pg_dump' | 'psql', serverMajor: number | null): string {
  const envOverride = name === 'pg_dump' ? process.env.PG_DUMP_PATH : process.env.PSQL_PATH

  const candidates = [
    ...(envOverride ? [envOverride] : []),
    name,
    ...(serverMajor
      ? [
          // Common Linux layouts
          `/usr/lib/postgresql/${serverMajor}/bin/${name}`,
          `/usr/pgsql-${serverMajor}/bin/${name}`,
          // Sometimes available as version-suffixed binary
          `${name}${serverMajor}`,
        ]
      : []),
  ]

  type Candidate = { path: string; major: number | null }
  const parsed: Candidate[] = candidates.map((path) => ({
    path,
    major: getPgBinaryMajorVersion(path),
  }))
  const usable = parsed.filter((c) => c.major !== null) as { path: string; major: number }[]

  if (!serverMajor) return usable[0]?.path || envOverride || name

  // Prefer exact match; otherwise pick the newest available that is >= server major.
  const exact = usable.find((c) => c.major === serverMajor)
  if (exact) return exact.path

  const newerOrEqual = usable
    .filter((c) => c.major >= serverMajor)
    .sort((a, b) => b.major - a.major)
  if (newerOrEqual[0]) return newerOrEqual[0].path

  return envOverride || name
}
