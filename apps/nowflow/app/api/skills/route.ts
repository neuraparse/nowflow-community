import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { invalidateSkillBlocksCache } from '@/blocks'
import { db } from '@/db'
import { skill } from '@/db/schema'

const logger = createLogger('SkillsAPI')

// GET /api/skills - List installed skills
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ skills: [] })
    }

    const userId = session.user.id
    const skills = await db
      .select()
      .from(skill)
      .where(eq(skill.userId, userId))
      .orderBy(skill.createdAt)

    return NextResponse.json({ skills, total: skills.length })
  } catch (error: any) {
    logger.error('Failed to list skills', { error: error.message })
    return NextResponse.json({ skills: [], total: 0 })
  }
}

// POST /api/skills - Install a skill
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      version,
      description,
      author,
      category,
      tags,
      manifest,
      sourceType,
      sourceUrl,
      sourceRepository,
      configuration,
    } = body

    if (!name || !manifest) {
      return NextResponse.json(
        { error: 'Missing required fields: name, manifest' },
        { status: 400 }
      )
    }

    const [newSkill] = await db
      .insert(skill)
      .values({
        name,
        version: version || '0.1.0',
        description: description || '',
        author: author || '',
        category: category || 'custom',
        tags: tags || [],
        manifest: manifest || {},
        sourceType: sourceType || 'local',
        sourceUrl,
        sourceRepository,
        userId: session.user.id,
        configuration: configuration || {},
        enabled: true,
      })
      .returning()

    invalidateSkillBlocksCache()
    return NextResponse.json({ skill: newSkill }, { status: 201 })
  } catch (error: any) {
    logger.error('Failed to install skill', { error: error.message })
    return NextResponse.json({ error: 'Failed to install skill' }, { status: 500 })
  }
}

// DELETE /api/skills - Uninstall a skill (with ?id=xxx query param)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const skillId = request.nextUrl.searchParams.get('id')
    if (!skillId) {
      return NextResponse.json({ error: 'Missing skill id' }, { status: 400 })
    }

    await db.delete(skill).where(and(eq(skill.id, skillId), eq(skill.userId, session.user.id)))

    invalidateSkillBlocksCache()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Failed to uninstall skill', { error: error.message })
    return NextResponse.json({ error: 'Failed to uninstall skill' }, { status: 500 })
  }
}

// PATCH /api/skills - Update skill config/enabled (with ?id=xxx query param)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const skillId = request.nextUrl.searchParams.get('id')
    if (!skillId) {
      return NextResponse.json({ error: 'Missing skill id' }, { status: 400 })
    }

    const body = await request.json()
    const updates: Record<string, any> = { updatedAt: new Date() }
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.configuration) updates.configuration = body.configuration

    const [updated] = await db
      .update(skill)
      .set(updates)
      .where(and(eq(skill.id, skillId), eq(skill.userId, session.user.id)))
      .returning()

    invalidateSkillBlocksCache()
    return NextResponse.json({ skill: updated })
  } catch (error: any) {
    logger.error('Failed to update skill', { error: error.message })
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 })
  }
}
