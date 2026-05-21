import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { user, workspace, workspaceMember } from '@/db/schema'

const logger = createLogger('membersAPI')

/**
 * Workspace Members API Route Handler
 *
 * Bu dosya workspace üye yönetimi için API endpoint'lerini sağlar.
 * Sadece workspace owner'ları üye ekleyebilir.
 *
 * Endpoints:
 * - POST /api/workspaces/members - Workspace'e yeni üye ekler
 *
 * Yetkilendirme:
 * - Sadece workspace owner'ları bu endpoint'i kullanabilir
 * - Eklenecek kullanıcı sistemde kayıtlı olmalıdır
 * - Kullanıcı zaten workspace üyesi olmamalıdır
 */

/**
 * POST /api/workspaces/members
 *
 * Workspace'e yeni bir üye ekler. Sadece workspace owner'ları bu işlemi yapabilir.
 *
 * İşlem Adımları:
 * 1. Kullanıcı kimlik doğrulaması yapılır
 * 2. İstek yapan kullanıcının workspace'te owner rolü olduğu kontrol edilir
 * 3. Eklenecek kullanıcı email ile aranır
 * 4. Kullanıcının zaten üye olup olmadığı kontrol edilir
 * 5. Kullanıcı workspace'e eklenir
 *
 * @param {Object} req.body - İstek gövdesi
 * @param {string} req.body.workspaceId - Workspace ID (zorunlu)
 * @param {string} req.body.userEmail - Eklenecek kullanıcının email adresi (zorunlu)
 * @param {string} req.body.role - Kullanıcının rolü (varsayılan: 'member', seçenekler: 'owner', 'admin', 'member')
 *
 * @returns {Object} success - Başarı durumu
 * @returns {boolean} success.success - İşlem başarılı mı
 *
 * @throws {401} Unauthorized - Kullanıcı oturum açmamış
 * @throws {400} Bad Request - Gerekli parametreler eksik veya kullanıcı zaten üye
 * @throws {403} Forbidden - Kullanıcının yeterli yetkisi yok (owner değil)
 * @throws {404} Not Found - Eklenecek kullanıcı bulunamadı
 * @throws {500} Internal Server Error - Üye ekleme hatası
 *
 * @example
 * // İstek
 * POST /api/workspaces/members
 * {
 *   "workspaceId": "workspace-uuid",
 *   "userEmail": "newuser@example.com",
 *   "role": "member"
 * }
 *
 * // Başarılı Yanıt
 * {
 *   "success": true
 * }
 *
 * // Hata Yanıtları
 * // 403 Forbidden
 * {
 *   "error": "Insufficient permissions"
 * }
 *
 * // 404 Not Found
 * {
 *   "error": "User not found"
 * }
 *
 * // 400 Bad Request
 * {
 *   "error": "User is already a member of this workspace"
 * }
 */
export async function POST(req: Request) {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { workspaceId, userEmail, role = 'member' } = body

    // Validate required fields
    if (!workspaceId || !userEmail) {
      return NextResponse.json(
        { error: 'Workspace ID and user email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'member']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: owner, admin, member' },
        { status: 400 }
      )
    }

    // Check if current user is an owner or admin of the workspace
    const currentUserMembership = await db
      .select()
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, workspaceId),
          eq(workspaceMember.userId, session.user.id)
        )
      )
      .then((rows: any) => rows[0])

    if (!currentUserMembership || currentUserMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Find user by email
    const targetUser = await db
      .select()
      .from(user)
      .where(eq(user.email, userEmail))
      .then((rows: any) => rows[0])

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(workspaceMember)
      .where(
        and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, targetUser.id))
      )
      .then((rows: any) => rows[0])

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      )
    }

    // Add user to workspace
    await db.insert(workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId,
      userId: targetUser.id,
      role,
      joinedAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error adding workspace member:', error)
    return NextResponse.json({ error: 'Failed to add workspace member' }, { status: 500 })
  }
}
