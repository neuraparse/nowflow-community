import { NextResponse } from 'next/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { form, formSubmission } from '@/db/schema'

const logger = createLogger('InterfacesAPI')

/**
 * GET /api/interfaces - List all forms for the current user/workspace
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    const conditions = [eq(form.userId, session.user.id)]
    if (workspaceId) {
      conditions.push(eq(form.workspaceId, workspaceId))
    }

    const forms = await db
      .select()
      .from(form)
      .where(and(...conditions))
      .orderBy(desc(form.updatedAt))

    // Get submission counts for each form
    const formsWithMeta = await Promise.all(
      forms.map(async (f: any) => {
        const [countResult] = await db
          .select({ count: sql`count(*)` })
          .from(formSubmission)
          .where(eq(formSubmission.formId, f.id))

        return {
          ...f,
          submissionCount: Number(countResult?.count ?? 0),
        }
      })
    )

    return NextResponse.json({ forms: formsWithMeta })
  } catch (error) {
    logger.error('Error fetching forms:', error)
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 })
  }
}

/**
 * POST /api/interfaces - Create a new form
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      name,
      description,
      workspaceId,
      fields: initialFields,
      settings: initialSettings,
    } = await req.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const formId = crypto.randomUUID()
    const now = new Date()

    // Generate a URL-friendly slug from the name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const slug = `${baseSlug}-${formId.slice(0, 8)}`

    const defaultFields =
      initialFields?.length > 0
        ? initialFields
        : [
            {
              id: crypto.randomUUID(),
              type: 'text',
              label: 'Name',
              placeholder: 'Enter your name',
              required: true,
              options: [],
              validation: {},
            },
            {
              id: crypto.randomUUID(),
              type: 'email',
              label: 'Email',
              placeholder: 'Enter your email',
              required: true,
              options: [],
              validation: {},
            },
          ]

    const defaultSettings = {
      submitButtonText: 'Submit',
      successMessage: 'Thank you for your submission!',
      redirectUrl: '',
      theme: 'light',
      branding: true,
      ...initialSettings,
    }

    await db.insert(form).values({
      id: formId,
      userId: session.user.id,
      workspaceId: workspaceId || null,
      name,
      description: description || null,
      slug,
      status: 'draft',
      fields: defaultFields,
      settings: defaultSettings,
      submitCount: 0,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      form: {
        id: formId,
        name,
        description,
        slug,
        status: 'draft',
        fields: defaultFields,
        settings: defaultSettings,
        workspaceId,
        createdAt: now,
        updatedAt: now,
      },
    })
  } catch (error) {
    logger.error('Error creating form:', error)
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 })
  }
}

/**
 * DELETE /api/interfaces?id={formId} - Delete a form
 */
export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const formId = searchParams.get('id')

    if (!formId) {
      return NextResponse.json({ error: 'Form ID is required' }, { status: 400 })
    }

    // Verify ownership
    const [existingForm] = await db
      .select()
      .from(form)
      .where(and(eq(form.id, formId), eq(form.userId, session.user.id)))
      .limit(1)

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    await db.delete(form).where(eq(form.id, formId))

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting form:', error)
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 })
  }
}
