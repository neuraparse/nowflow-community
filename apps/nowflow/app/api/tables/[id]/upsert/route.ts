import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  applyMapping,
  getColumnMapping,
  reverseMapRowData,
  syncColumnsAndGetMapping,
} from '@/lib/tables/schema-sync'
import { db } from '@/db'
import { dataTable, dataTableRow } from '@/db/schema'

const logger = createLogger('UpsertAPI')

/**
 * POST /api/tables/[id]/upsert
 *
 * Insert a row if no match found, or update the existing row if match found.
 *
 * Body:
 * {
 *   matchColumn: string          // column name to match on (e.g. "email")
 *   matchValue: string           // value to look for
 *   rowData: Record<string, any> // data to insert or merge
 *   createMissingColumns?: boolean // default: true
 * }
 *
 * Response:
 * {
 *   action: 'inserted' | 'updated'
 *   found: boolean
 *   row: { id, tableId, data, createdAt, updatedAt }
 * }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { matchColumn, matchValue, rowData, createMissingColumns = true } = body

    if (!matchColumn || matchValue === undefined || !rowData) {
      return NextResponse.json(
        { error: 'matchColumn, matchValue, and rowData are required' },
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

    let action: 'inserted' | 'updated' = 'inserted'
    let resultRow: any = null

    await db.transaction(async (tx: any) => {
      // Sync columns — create any missing ones from rowData
      const inferredCols = Object.entries(rowData).map(([name]) => ({
        name,
        type: 'text' as const,
      }))
      const { mapping } = await syncColumnsAndGetMapping(
        id,
        createMissingColumns ? inferredCols : [],
        tx as any
      )

      const matchColId = mapping[matchColumn]
      if (!matchColId) {
        throw new Error(`Column "${matchColumn}" not found`)
      }

      // Look for existing row
      const [existingRow] = await tx
        .select()
        .from(dataTableRow)
        .where(
          and(
            eq(dataTableRow.tableId, id),
            sql`${dataTableRow.data}->>${matchColId} ILIKE ${String(matchValue)}`
          )
        )
        .limit(1)

      const mappedData = applyMapping(rowData, mapping)

      if (existingRow) {
        // UPDATE: merge new data into existing row
        const mergedData = {
          ...(existingRow.data as Record<string, any>),
          ...mappedData,
        }
        const now = new Date()
        await tx
          .update(dataTableRow)
          .set({ data: mergedData, updatedAt: now })
          .where(eq(dataTableRow.id, existingRow.id))

        action = 'updated'
        resultRow = { ...existingRow, data: mergedData, updatedAt: now }
      } else {
        // INSERT new row
        const rowId = crypto.randomUUID()
        const now = new Date()

        const [maxOrder] = await tx
          .select({ max: sql`COALESCE(MAX("order"), -1)` })
          .from(dataTableRow)
          .where(eq(dataTableRow.tableId, id))

        await tx.insert(dataTableRow).values({
          id: rowId,
          tableId: id,
          data: mappedData,
          order: ((maxOrder?.max as number) ?? -1) + 1,
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

        action = 'inserted'
        resultRow = {
          id: rowId,
          tableId: id,
          data: mappedData,
          createdAt: now,
          updatedAt: now,
        }
      }
    })

    // Reverse-map for friendly output
    const { reverseMapping } = await getColumnMapping(id)
    const friendlyData = reverseMapRowData(resultRow.data as Record<string, any>, reverseMapping)

    return NextResponse.json({
      action,
      found: (action as 'inserted' | 'updated') === 'updated',
      row: { ...resultRow, data: friendlyData },
    })
  } catch (error: any) {
    logger.error('Error in upsert:', error)
    return NextResponse.json({ error: error?.message || 'Failed to upsert data' }, { status: 500 })
  }
}
