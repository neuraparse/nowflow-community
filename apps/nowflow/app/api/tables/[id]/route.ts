import { NextResponse } from 'next/server'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getColumnMapping, reverseMapRowData } from '@/lib/tables/schema-sync'
import { db } from '@/db'
import { dataTable, dataTableColumn, dataTableRow } from '@/db/schema'

const logger = createLogger('TableDetailAPI')

/**
 * GET /api/tables/[id] - Get table with columns and rows
 *
 * Lookup mode: ?lookupColumn=email&lookupValue=alice@example.com
 * Returns { found: boolean, row: {...} | null }
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)

    // Get table with ownership check
    const [table] = await db
      .select()
      .from(dataTable)
      .where(and(eq(dataTable.id, id), eq(dataTable.userId, session.user.id)))
      .limit(1)

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // --- Lookup / Exists mode ---
    const lookupColumn = searchParams.get('lookupColumn')
    const lookupValue = searchParams.get('lookupValue')

    if (lookupColumn && lookupValue !== null) {
      const { mapping, reverseMapping } = await getColumnMapping(id)
      const colId = mapping[lookupColumn]

      if (!colId) {
        return NextResponse.json({
          found: false,
          row: null,
          error: `Column "${lookupColumn}" not found`,
        })
      }

      const [row] = await db
        .select()
        .from(dataTableRow)
        .where(
          and(
            eq(dataTableRow.tableId, id),
            sql`${dataTableRow.data}->>${colId} ILIKE ${lookupValue}`
          )
        )
        .limit(1)

      const friendlyData = row
        ? reverseMapRowData(row.data as Record<string, any>, reverseMapping)
        : null

      return NextResponse.json({
        found: !!row,
        row: row ? { ...row, data: friendlyData } : null,
      })
    }

    // --- Standard paginated query mode ---
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const sortColumn = searchParams.get('sortColumn')
    const sortDirection = searchParams.get('sortDirection') || 'asc'
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    // Get columns
    const columns = await db
      .select()
      .from(dataTableColumn)
      .where(eq(dataTableColumn.tableId, id))
      .orderBy(asc(dataTableColumn.order))

    // Build WHERE conditions for rows
    const rowConditions: ReturnType<typeof eq>[] = [eq(dataTableRow.tableId, id) as any]
    if (search) {
      // Full-text search across all JSONB values
      rowConditions.push(sql`${dataTableRow.data}::text ILIKE ${'%' + search + '%'}` as any)
    }
    const rowWhere = and(...(rowConditions as any))

    // Get rows with pagination
    const rows = await db
      .select()
      .from(dataTableRow)
      .where(rowWhere)
      .orderBy(
        sortColumn
          ? sortDirection === 'desc'
            ? desc(dataTableRow.order)
            : asc(dataTableRow.order)
          : asc(dataTableRow.order)
      )
      .limit(limit)
      .offset(offset)

    // Get total count (respects search filter)
    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(dataTableRow)
      .where(rowWhere)

    return NextResponse.json({
      table,
      columns,
      rows,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    })
  } catch (error) {
    logger.error('Error fetching table:', error)
    return NextResponse.json({ error: 'Failed to fetch table' }, { status: 500 })
  }
}

/**
 * PATCH /api/tables/[id] - Update table metadata
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
    const [table] = await db
      .select()
      .from(dataTable)
      .where(and(eq(dataTable.id, id), eq(dataTable.userId, session.user.id)))
      .limit(1)

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const allowedFields: Record<string, any> = {}
    if (updates.name) allowedFields.name = updates.name
    if (updates.description !== undefined) allowedFields.description = updates.description
    if (updates.icon) allowedFields.icon = updates.icon
    if (updates.isArchived !== undefined) allowedFields.isArchived = updates.isArchived
    allowedFields.updatedAt = new Date()

    await db.update(dataTable).set(allowedFields).where(eq(dataTable.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error updating table:', error)
    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 })
  }
}
