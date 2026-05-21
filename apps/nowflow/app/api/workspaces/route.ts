import { NextResponse } from 'next/server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { ensureDefaultWorkflow } from '@/lib/workflows/default-workflow'
import { db } from '@/db'
import { workflow, workspace, workspaceMember } from '@/db/schema'

const logger = createLogger('workspacesAPI')

/**
 * Workspace API Route Handler
 *
 * Bu dosya workspace (çalışma alanı) yönetimi için API endpoint'lerini sağlar.
 * Workspace'ler kullanıcıların workflow'larını organize etmelerine ve
 * diğer kullanıcılarla işbirliği yapmalarına olanak tanır.
 *
 * Endpoints:
 * - GET /api/workspaces - Kullanıcının tüm workspace'lerini listeler
 * - POST /api/workspaces - Yeni workspace oluşturur
 */

/**
 * GET /api/workspaces
 *
 * Kullanıcının üyesi olduğu tüm workspace'leri getirir.
 * Eğer kullanıcının hiç workspace'i yoksa, otomatik olarak varsayılan bir workspace oluşturulur.
 *
 * @returns {Object} workspaces - Workspace listesi ve kullanıcının rolü
 * @returns {Array} workspaces.workspaces - Workspace dizisi
 * @returns {string} workspaces.workspaces[].id - Workspace ID
 * @returns {string} workspaces.workspaces[].name - Workspace adı
 * @returns {string} workspaces.workspaces[].ownerId - Workspace sahibinin ID'si
 * @returns {string} workspaces.workspaces[].role - Kullanıcının workspace'teki rolü
 * @returns {Date} workspaces.workspaces[].createdAt - Oluşturulma tarihi
 * @returns {Date} workspaces.workspaces[].updatedAt - Güncellenme tarihi
 *
 * @example
 * // İstek
 * GET /api/workspaces
 *
 * // Yanıt
 * {
 *   "workspaces": [
 *     {
 *       "id": "workspace-uuid",
 *       "name": "My Workspace",
 *       "ownerId": "user-uuid",
 *       "role": "owner",
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *       "updatedAt": "2024-01-01T00:00:00.000Z"
 *     }
 *   ]
 * }
 */
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all workspaces where the user is a member with a single join query
    const memberWorkspaces = await db
      .select({
        workspace: workspace,
        role: workspaceMember.role,
      })
      .from(workspaceMember)
      .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
      .where(eq(workspaceMember.userId, session.user.id))
      .orderBy(desc(workspaceMember.joinedAt))

    if (memberWorkspaces.length === 0) {
      // Create a default workspace for the user
      const defaultWorkspace = await createDefaultWorkspace(session.user.id, session.user.name)

      // Migrate existing workflows to the default workspace
      await migrateExistingWorkflows(session.user.id, defaultWorkspace.id)

      // Ensure a default workflow exists for new users
      await ensureDefaultWorkflow({
        userId: session.user.id,
        workspaceId: defaultWorkspace.id,
        userName: session.user.name,
        reason: 'workspaces:get-new',
      })

      return NextResponse.json({ workspaces: [defaultWorkspace] })
    }

    // If user has workspaces but might have orphaned workflows, migrate them
    await ensureWorkflowsHaveWorkspace(session.user.id, memberWorkspaces[0].workspace.id)

    // Ensure a default workflow exists if the user has none
    await ensureDefaultWorkflow({
      userId: session.user.id,
      workspaceId: memberWorkspaces[0].workspace.id,
      userName: session.user.name,
      reason: 'workspaces:get-existing',
    })

    // Format the response
    const workspaces = memberWorkspaces.map((row: any) => {
      const workspaceDetails = row.workspace
      const role = row.role
      return {
        ...workspaceDetails,
        role,
      }
    })

    return NextResponse.json({ workspaces })
  } catch (error) {
    logger.error('Error fetching workspaces:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch workspaces',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workspaces
 *
 * Yeni bir workspace oluşturur ve kullanıcıyı otomatik olarak owner rolüyle ekler.
 *
 * @param {Object} req.body - İstek gövdesi
 * @param {string} req.body.name - Workspace adı (zorunlu)
 *
 * @returns {Object} workspace - Oluşturulan workspace bilgileri
 * @returns {string} workspace.id - Workspace ID
 * @returns {string} workspace.name - Workspace adı
 * @returns {string} workspace.ownerId - Workspace sahibinin ID'si
 * @returns {string} workspace.role - Kullanıcının rolü (her zaman 'owner')
 * @returns {Date} workspace.createdAt - Oluşturulma tarihi
 * @returns {Date} workspace.updatedAt - Güncellenme tarihi
 *
 * @throws {401} Unauthorized - Kullanıcı oturum açmamış
 * @throws {400} Bad Request - Workspace adı eksik
 * @throws {500} Internal Server Error - Workspace oluşturma hatası
 *
 * @example
 * // İstek
 * POST /api/workspaces
 * {
 *   "name": "My New Workspace"
 * }
 *
 * // Yanıt
 * {
 *   "workspace": {
 *     "id": "workspace-uuid",
 *     "name": "My New Workspace",
 *     "ownerId": "user-uuid",
 *     "role": "owner",
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
export async function POST(req: Request) {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const newWorkspace = await createWorkspace(session.user.id, name)

    return NextResponse.json({ workspace: newWorkspace })
  } catch (error) {
    logger.error('Error creating workspace:', error)
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
  }
}

/**
 * Varsayılan workspace oluşturur
 *
 * Kullanıcının hiç workspace'i yoksa otomatik olarak çağrılır.
 * Workspace adı kullanıcı adından türetilir.
 *
 * @param {string} userId - Kullanıcı ID'si
 * @param {string|null} userName - Kullanıcı adı (opsiyonel)
 * @returns {Promise<Object>} Oluşturulan workspace
 */
async function createDefaultWorkspace(userId: string, userName?: string | null) {
  const workspaceName = userName ? `${userName}'s Workspace` : 'My Workspace'
  return createWorkspace(userId, workspaceName)
}

/**
 * Yeni workspace oluşturur ve kullanıcıyı owner olarak ekler
 *
 * Bu fonksiyon iki işlem yapar:
 * 1. Workspace tablosuna yeni kayıt ekler
 * 2. WorkspaceMember tablosuna kullanıcıyı 'owner' rolüyle ekler
 *
 * @param {string} userId - Workspace sahibinin kullanıcı ID'si
 * @param {string} name - Workspace adı
 * @returns {Promise<Object>} Oluşturulan workspace bilgileri
 *
 * @example
 * const workspace = await createWorkspace('user-123', 'My Team Workspace')
 * // Returns:
 * // {
 * //   id: 'workspace-uuid',
 * //   name: 'My Team Workspace',
 * //   ownerId: 'user-123',
 * //   role: 'owner',
 * //   createdAt: Date,
 * //   updatedAt: Date
 * // }
 */
async function createWorkspace(userId: string, name: string) {
  const workspaceId = crypto.randomUUID()
  const now = new Date()

  // Use transaction to prevent lock warnings and ensure atomicity
  await db.transaction(async (tx: any) => {
    // Create the workspace
    await tx.insert(workspace).values({
      id: workspaceId,
      name,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    })

    // Add the user as a member with owner role
    await tx.insert(workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId,
      userId,
      role: 'owner',
      joinedAt: now,
      updatedAt: now,
    })
  })

  // Return the workspace data directly instead of querying again
  return {
    id: workspaceId,
    name,
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
    role: 'owner',
  }
}

/**
 * Mevcut workflow'ları workspace'e taşır
 *
 * Workspace'e bağlı olmayan (orphan) workflow'ları belirtilen workspace'e taşır.
 * Bu fonksiyon genellikle kullanıcının ilk workspace'i oluşturulduğunda çağrılır.
 *
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} workspaceId - Hedef workspace ID'si
 * @returns {Promise<void>}
 *
 * @example
 * // Kullanıcının workspace'i yoksa ve 5 workflow'u varsa:
 * await migrateExistingWorkflows('user-123', 'workspace-456')
 * // Console: "Migrating 5 workflows to workspace workspace-456 for user user-123"
 */
async function migrateExistingWorkflows(userId: string, workspaceId: string) {
  // Use transaction to prevent lock warnings
  await db.transaction(async (tx: any) => {
    // Find all workflows that have no workspace ID
    const orphanedWorkflows = await tx
      .select({ id: workflow.id })
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNull(workflow.workspaceId)))

    if (orphanedWorkflows.length === 0) {
      return // No orphaned workflows to migrate
    }

    logger.debug(
      `Migrating ${orphanedWorkflows.length} workflows to workspace ${workspaceId} for user ${userId}`
    )

    // Bulk update all orphaned workflows at once
    await tx
      .update(workflow)
      .set({
        workspaceId: workspaceId,
        updatedAt: new Date(),
      })
      .where(and(eq(workflow.userId, userId), isNull(workflow.workspaceId)))
  })
}

/**
 * Tüm workflow'ların bir workspace'e bağlı olduğundan emin olur
 *
 * Workspace'e bağlı olmayan workflow'ları varsayılan workspace'e taşır.
 * Bu fonksiyon her workspace listesi çekildiğinde çağrılır ve
 * orphan workflow'ları otomatik olarak düzeltir.
 *
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} defaultWorkspaceId - Varsayılan workspace ID'si
 * @returns {Promise<void>}
 *
 * @example
 * await ensureWorkflowsHaveWorkspace('user-123', 'workspace-456')
 * // Orphan workflow'lar varsa otomatik olarak workspace-456'ya taşınır
 */
async function ensureWorkflowsHaveWorkspace(userId: string, defaultWorkspaceId: string) {
  // Use transaction to prevent lock warnings
  await db.transaction(async (tx: any) => {
    // First check if there are any orphaned workflows
    const orphanedWorkflows = await tx
      .select()
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNull(workflow.workspaceId)))

    if (orphanedWorkflows.length > 0) {
      // Directly update any workflows that don't have a workspace ID in a single query
      await tx
        .update(workflow)
        .set({
          workspaceId: defaultWorkspaceId,
          updatedAt: new Date(),
        })
        .where(and(eq(workflow.userId, userId), isNull(workflow.workspaceId)))

      logger.debug(`Fixed ${orphanedWorkflows.length} orphaned workflows for user ${userId}`)
    }
  })
}
