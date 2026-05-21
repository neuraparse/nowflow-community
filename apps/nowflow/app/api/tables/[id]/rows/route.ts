import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { dataTable, dataTableRow } from '@/db/schema'

const logger = createLogger('TableRowsAPI')

/**
 * POST /api/tables/[id]/rows - Create a new row
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { data } = await req.json()

    // Verify ownership
    const [table] = await db
      .select()
      .from(dataTable)
      .where(and(eq(dataTable.id, id), eq(dataTable.userId, session.user.id)))
      .limit(1)

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const rowId = crypto.randomUUID()
    const now = new Date()

    await db.transaction(async (tx: any) => {
      // Get current max order
      const [maxOrder] = await tx
        .select({ max: sql`COALESCE(MAX("order"), -1)` })
        .from(dataTableRow)
        .where(eq(dataTableRow.tableId, id))

      await tx.insert(dataTableRow).values({
        id: rowId,
        tableId: id,
        data: data || {},
        order: (maxOrder?.max ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      })

      // Update row count
      await tx
        .update(dataTable)
        .set({
          rowCount: sql`${dataTable.rowCount} + 1`,
          updatedAt: now,
        })
        .where(eq(dataTable.id, id))
    })

    return NextResponse.json({
      row: { id: rowId, tableId: id, data, createdAt: now, updatedAt: now },
    })
  } catch (error) {
    logger.error('Error creating row:', error)
    return NextResponse.json({ error: 'Failed to create row' }, { status: 500 })
  }
}

/**
 * PATCH /api/tables/[id]/rows - Update a row
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { rowId, data } = await req.json()

    if (!rowId) {
      return NextResponse.json({ error: 'Row ID is required' }, { status: 400 })
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

    // Get existing row data and merge
    const [existingRow] = await db
      .select()
      .from(dataTableRow)
      .where(and(eq(dataTableRow.id, rowId), eq(dataTableRow.tableId, id)))
      .limit(1)

    if (!existingRow) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 })
    }

    const mergedData = { ...(existingRow.data as Record<string, any>), ...data }

    await db
      .update(dataTableRow)
      .set({ data: mergedData, updatedAt: new Date() })
      .where(eq(dataTableRow.id, rowId))

    return NextResponse.json({ success: true, data: mergedData })
  } catch (error) {
    logger.error('Error updating row:', error)
    return NextResponse.json({ error: 'Failed to update row' }, { status: 500 })
  }
}

/**
 * DELETE /api/tables/[id]/rows - Delete row(s)
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const rowId = searchParams.get('rowId')

    if (!rowId) {
      return NextResponse.json({ error: 'Row ID is required' }, { status: 400 })
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

    await db.transaction(async (tx: any) => {
      await tx
        .delete(dataTableRow)
        .where(and(eq(dataTableRow.id, rowId), eq(dataTableRow.tableId, id)))

      await tx
        .update(dataTable)
        .set({
          rowCount: sql`GREATEST(${dataTable.rowCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(dataTable.id, id))
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting row:', error)
    return NextResponse.json({ error: 'Failed to delete row' }, { status: 500 })
  }
}
