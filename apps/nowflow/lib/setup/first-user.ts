import { hashPassword } from 'better-auth/crypto'
import { randomUUID } from 'crypto'
import { count, ne, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { ensureFreeSubscriptionForUser } from '@/lib/subscription-plan'
import { ensureDefaultWorkflow } from '@/lib/workflows/default-workflow'
import { db } from '@/db'
import { account, user, workspace, workspaceMember } from '@/db/schema'
import {
  type FirstUserInput,
  type NormalizedFirstUserInput,
  validateFirstUserInput,
} from './validation'

const logger = createLogger('FirstRunSetup')
const SETUP_LOCK_KEY = 'nowflow-first-user-setup'
const SYSTEM_USER_ROLE = 'system'
const setupCache = globalThis as typeof globalThis & {
  __nowflowFirstRunSetupStatus?: FirstRunSetupStatus
}

export class FirstRunSetupError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'FirstRunSetupError'
    this.status = status
    this.code = code
  }
}

export interface FirstRunSetupStatus {
  needsSetup: boolean
  userCount: number
}

export interface CreatedFirstUser {
  id: string
  name: string
  email: string
  role: string
}

export interface CreatedFirstWorkspace {
  id: string
  name: string
  role: 'owner'
}

export interface CreateFirstUserResult {
  user: CreatedFirstUser
  workspace: CreatedFirstWorkspace
  defaultWorkflowCreated: boolean
}

export function isFirstRunSetupError(error: unknown): error is FirstRunSetupError {
  return error instanceof FirstRunSetupError
}

function cacheFirstRunSetupStatus(status: FirstRunSetupStatus): FirstRunSetupStatus {
  setupCache.__nowflowFirstRunSetupStatus = status
  return status
}

export async function getFirstRunSetupStatus(): Promise<FirstRunSetupStatus> {
  if (setupCache.__nowflowFirstRunSetupStatus?.needsSetup === false) {
    return setupCache.__nowflowFirstRunSetupStatus
  }

  const [row] = await db
    .select({ count: count() })
    .from(user)
    .where(ne(user.role, SYSTEM_USER_ROLE))
  const userCount = Number(row?.count ?? 0)
  const status = {
    needsSetup: userCount === 0,
    userCount,
  }

  return status.needsSetup ? status : cacheFirstRunSetupStatus(status)
}

function validateOrThrow(input: FirstUserInput): NormalizedFirstUserInput {
  const validation = validateFirstUserInput(input)

  if (!validation.valid) {
    throw new FirstRunSetupError(400, 'INVALID_SETUP_INPUT', validation.errors[0])
  }

  return validation.value
}

export async function createFirstUser(input: FirstUserInput): Promise<CreateFirstUserResult> {
  const normalized = validateOrThrow(input)
  const passwordHash = await hashPassword(normalized.password)
  const now = new Date()

  const created = await db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${SETUP_LOCK_KEY}))`)

    const [userCountRow] = await tx
      .select({ count: count() })
      .from(user)
      .where(ne(user.role, SYSTEM_USER_ROLE))
    const userCount = Number(userCountRow?.count ?? 0)

    if (userCount > 0) {
      cacheFirstRunSetupStatus({
        needsSetup: false,
        userCount,
      })

      throw new FirstRunSetupError(
        409,
        'SETUP_ALREADY_COMPLETE',
        'Initial setup has already been completed.'
      )
    }

    const userId = randomUUID()
    const workspaceId = randomUUID()

    const [createdUser] = await tx
      .insert(user)
      .values({
        id: userId,
        name: normalized.name,
        email: normalized.email,
        emailVerified: true,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })

    if (!createdUser) {
      throw new FirstRunSetupError(500, 'USER_CREATE_FAILED', 'Failed to create the first user.')
    }

    await tx.insert(account).values({
      id: randomUUID(),
      accountId: createdUser.id,
      providerId: 'credential',
      userId: createdUser.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(workspace).values({
      id: workspaceId,
      name: normalized.workspaceName,
      ownerId: createdUser.id,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(workspaceMember).values({
      id: randomUUID(),
      workspaceId,
      userId: createdUser.id,
      role: 'owner',
      joinedAt: now,
      updatedAt: now,
    })

    return {
      user: createdUser,
      workspace: {
        id: workspaceId,
        name: normalized.workspaceName,
        role: 'owner' as const,
      },
    }
  })

  try {
    await ensureFreeSubscriptionForUser(created.user.id)
  } catch (error) {
    logger.error('Failed to create default subscription for first user', {
      error,
      userId: created.user.id,
    })
  }

  const defaultWorkflow = await ensureDefaultWorkflow({
    userId: created.user.id,
    workspaceId: created.workspace.id,
    userName: created.user.name,
    reason: 'first-run-setup',
  })

  logger.info('First-run setup completed', {
    userId: created.user.id,
    workspaceId: created.workspace.id,
    defaultWorkflowCreated: defaultWorkflow.created,
  })

  cacheFirstRunSetupStatus({
    needsSetup: false,
    userCount: 1,
  })

  return {
    ...created,
    defaultWorkflowCreated: defaultWorkflow.created,
  }
}
