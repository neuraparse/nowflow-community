import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { applyMapping, syncColumnsAndGetMapping } from '@/lib/tables/schema-sync'
import { db } from '@/db'
import { dataTable, dataTableRow } from '@/db/schema'

const logger = createLogger('BulkUpdateAPI')

/**
 * PATCH /api/tables/[id]/bulk-update
 *
 * Update all rows where a column matches a given value.
 *
 * Body:
 * {
 *   filterColumn: string          // column name to filter by (e.g. "status")
 *   filterValue: string           // value to match (e.g. "pending")
 *   updateData: Record<string, any> // data to merge into matching rows
 *   createMissingColumns?: boolean  // default: true
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   updatedRows: number
 * }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { filterColumn, filterValue, updateData, createMissingColumns = true } = body

    if (!filterColumn || filterValue === undefined || !updateData) {
      return NextResponse.json(
        { error: 'filterColumn, filterValue, and updateData are required' },
        { status: 400 }
      )
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

    let updatedCount = 0

    await db.transaction(async (tx: any) => {
      // Sync columns (may need to create update columns)
      const inferredCols = Object.entries(updateData).map(([name]) => ({
        name,
        type: 'text' as const,
      }))
      const { mapping } = await syncColumnsAndGetMapping(
        id,
        createMissingColumns ? inferredCols : [],
        tx as any
      )

      const filterColId = mapping[filterColumn]
      if (!filterColId) {
        throw new Error(`Column "${filterColumn}" not found`)
      }

      // Find all matching rows
      const matchingRows = await tx
        .select()
        .from(dataTableRow)
        .where(
          and(
            eq(dataTableRow.tableId, id),
            sql`${dataTableRow.data}->>${filterColId} ILIKE ${String(filterValue)}`
          )
        )

      const mappedUpdateData = applyMapping(updateData, mapping)
      const now = new Date()

      for (const row of matchingRows) {
        const mergedData = {
          ...(row.data as Record<string, any>),
          ...mappedUpdateData,
        }
        await tx
          .update(dataTableRow)
          .set({ data: mergedData, updatedAt: now })
          .where(eq(dataTableRow.id, row.id))
        updatedCount++
      }
    })

    return NextResponse.json({ success: true, updatedRows: updatedCount })
  } catch (error: any) {
    logger.error('Error in bulk update:', error)
    return NextResponse.json({ error: error?.message || 'Failed to bulk update' }, { status: 500 })
  }
}
