import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workspace, workspaceMember } from '@/db/schema'

const logger = createLogger('ResearchConsentAPI')

const bodySchema = z.object({
  consent: z.boolean(),
})

async function requireOwner(workspaceId: string, userId: string) {
  const membership = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)))
    .then((rows: any) => rows[0])

  if (!membership) return { ok: false as const, status: 404, error: 'Workspace not found' }
  if (membership.role !== 'owner')
    return {
      ok: false as const,
      status: 403,
      error: 'Only the workspace owner can set research consent',
    }

  return { ok: true as const }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db
      .select()
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, id), eq(workspaceMember.userId, session.user.id)))
      .then((rows: any) => rows[0])

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const ws = await db
      .select({
        id: workspace.id,
        researchConsent: workspace.researchConsent,
        researchConsentAt: workspace.researchConsentAt,
      })
      .from(workspace)
      .where(eq(workspace.id, id))
      .then((rows: any) => rows[0])

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({
      workspaceId: ws.id,
      researchConsent: ws.researchConsent,
      researchConsentAt: ws.researchConsentAt,
    })
  } catch (error) {
    logger.error('Error reading research consent', error)
    return NextResponse.json({ error: 'Failed to read consent' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const guard = await requireOwner(id, session.user.id)
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const now = new Date()
    await db
      .update(workspace)
      .set({
        researchConsent: parsed.data.consent,
        researchConsentAt: now,
        updatedAt: now,
      })
      .where(eq(workspace.id, id))

    logger.info('Research consent updated', {
      workspaceId: id,
      userId: session.user.id,
      consent: parsed.data.consent,
    })

    return NextResponse.json({
      workspaceId: id,
      researchConsent: parsed.data.consent,
      researchConsentAt: now.toISOString(),
    })
  } catch (error) {
    logger.error('Error updating research consent', error)
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 })
  }
}
