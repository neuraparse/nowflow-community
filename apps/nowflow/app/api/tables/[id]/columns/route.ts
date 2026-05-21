import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { dataTable, dataTableColumn } from '@/db/schema'

const logger = createLogger('TableColumnsAPI')

/**
 * POST /api/tables/[id]/columns - Add a new column
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { name, type, options, aiConfig } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'Column name is required' }, { status: 400 })
    }

    // Verify ownership
    const [table] = await db
      .select()
      .from(dataTable)
      .where(and(eq(dataTable.id, id), eq(dataTable.userId, session.user.id)))
      .limit(1)

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // Get max order
    const [maxOrder] = await db
      .select({ max: sql`COALESCE(MAX("order"), -1)` })
      .from(dataTableColumn)
      .where(eq(dataTableColumn.tableId, id))

    const columnId = crypto.randomUUID()
    const now = new Date()

    await db.insert(dataTableColumn).values({
      id: columnId,
      tableId: id,
      name,
      type: type || 'text',
      order: (maxOrder?.max ?? -1) + 1,
      options: options ? JSON.stringify(options) : null,
      aiConfig: aiConfig ? JSON.stringify(aiConfig) : null,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      column: {
        id: columnId,
        tableId: id,
        name,
        type: type || 'text',
        order: (maxOrder?.max ?? -1) + 1,
      },
    })
  } catch (error) {
    logger.error('Error creating column:', error)
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 })
  }
}

/**
 * PATCH /api/tables/[id]/columns - Update a column
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { columnId, name, type, options, aiConfig, width, order } = await req.json()

    if (!columnId) {
      return NextResponse.json({ error: 'Column ID is required' }, { status: 400 })
    }

    // Verify table ownership
    const [table] = await db
      .select()
      .from(dataTable)
      .where(and(eq(dataTable.id, id), eq(dataTable.userId, session.user.id)))
      .limit(1)

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (name !== undefined) updates.name = name
    if (type !== undefined) updates.type = type
    if (options !== undefined) updates.options = JSON.stringify(options)
    if (aiConfig !== undefined) updates.aiConfig = JSON.stringify(aiConfig)
    if (width !== undefined) updates.width = width
    if (order !== undefined) updates.order = order

    await db
      .update(dataTableColumn)
      .set(updates)
      .where(and(eq(dataTableColumn.id, columnId), eq(dataTableColumn.tableId, id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error updating column:', error)
    return NextResponse.json({ error: 'Failed to update column' }, { status: 500 })
  }
}

/**
 * DELETE /api/tables/[id]/columns - Delete a column
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const columnId = searchParams.get('columnId')

    if (!columnId) {
      return NextResponse.json({ error: 'Column ID is required' }, { status: 400 })
    }

    // Verify table ownership
    const [table] = await db
      .select()
      .from(dataTable)
      .where(and(eq(dataTable.id, id), eq(dataTable.userId, session.user.id)))
      .limit(1)

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    await db
      .delete(dataTableColumn)
      .where(and(eq(dataTableColumn.id, columnId), eq(dataTableColumn.tableId, id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting column:', error)
    return NextResponse.json({ error: 'Failed to delete column' }, { status: 500 })
  }
}
