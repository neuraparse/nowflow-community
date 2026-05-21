import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { form, formSubmission } from '@/db/schema'

const logger = createLogger('InterfaceDetailAPI')

/**
 * GET /api/interfaces/[id] - Get a single form with its submissions
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const [existingForm] = await db
      .select()
      .from(form)
      .where(and(eq(form.id, id), eq(form.userId, session.user.id)))
      .limit(1)

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Fetch submissions
    const submissions = await db
      .select()
      .from(formSubmission)
      .where(eq(formSubmission.formId, id))
      .orderBy(desc(formSubmission.createdAt))

    return NextResponse.json({
      form: existingForm,
      submissions,
    })
  } catch (error) {
    logger.error('Error fetching form:', error)
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 })
  }
}

/**
 * PATCH /api/interfaces/[id] - Update form fields, settings, or status
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const updates = await req.json()

    // Verify ownership
    const [existingForm] = await db
      .select()
      .from(form)
      .where(and(eq(form.id, id), eq(form.userId, session.user.id)))
      .limit(1)

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    const allowedFields: Record<string, boolean> = {
      name: true,
      description: true,
      status: true,
      fields: true,
      settings: true,
      workflowId: true,
      dataTableId: true,
      isPublic: true,
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields[key]) {
        updateData[key] = value
      }
    }

    await db.update(form).set(updateData).where(eq(form.id, id))

    // Fetch updated form
    const [updatedForm] = await db.select().from(form).where(eq(form.id, id)).limit(1)

    return NextResponse.json({ form: updatedForm })
  } catch (error) {
    logger.error('Error updating form:', error)
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 })
  }
}

/**
 * DELETE /api/interfaces/[id] - Delete a form
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const [existingForm] = await db
      .select()
      .from(form)
      .where(and(eq(form.id, id), eq(form.userId, session.user.id)))
      .limit(1)

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    await db.delete(form).where(eq(form.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting form:', error)
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 })
  }
}
