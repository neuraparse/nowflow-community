import { eq } from 'drizzle-orm'
import { decryptSecret } from '@/lib/utils'
import { db } from '@/db'
import { environment } from '@/db/schema'

export async function getUserEnvDecrypted(userId: string): Promise<Record<string, string>> {
  const [row] = await db.select().from(environment).where(eq(environment.userId, userId)).limit(1)
  if (!row?.variables) return {}

  const variables = row.variables as Record<string, string>
  const decryptedEntries = await Promise.all(
    Object.entries(variables).map(async ([key, encryptedValue]) => {
      try {
        const { decrypted } = await decryptSecret(encryptedValue)
        return [key, decrypted] as const
      } catch {
        // If it isn't encrypted (legacy/plain), keep as-is
        return [key, encryptedValue] as const
      }
    })
  )

  return Object.fromEntries(decryptedEntries)
}

export async function buildEffectiveEnvVars(options: {
  userId?: string
  workflowId?: string
  executionMode?: string
  extra?: Record<string, string>
}): Promise<Record<string, string>> {
  const userEnv = options.userId ? await getUserEnvDecrypted(options.userId) : {}

  const result: Record<string, string> = {
    ...(options.extra || {}),
    ...userEnv,
  }

  if (options.workflowId) {
    result.WORKFLOW_ID = options.workflowId
  }
  if (options.executionMode) {
    result.EXECUTION_MODE = options.executionMode
  }

  return result
}

export function resolveTemplateEnvOrThrow(template: string, env: Record<string, string>) {
  const matches = template.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return template

  let resolved = template
  for (const match of matches) {
    const key = match.slice(2, -2).trim()
    const value = env[key]
    if (value === undefined) {
      throw new Error(`Environment variable "${key}" was not found`)
    }
    resolved = resolved.replace(match, value)
  }

  return resolved
}
