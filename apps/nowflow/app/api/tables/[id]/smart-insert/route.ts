import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { inferSchema } from '@/lib/tables/schema-inference'
import { applyMapping, syncColumnsAndGetMapping } from '@/lib/tables/schema-sync'
import { db } from '@/db'
import { dataTable, dataTableRow } from '@/db/schema'

const logger = createLogger('SmartInsertAPI')

/**
 * POST /api/tables/[id]/smart-insert
 *
 * Accepts any rawData format (JSON object, JSON array, CSV string,
 * markdown table, key:value text, plain text), infers the schema,
 * creates missing columns, and inserts the rows.
 *
 * Body:
 * {
 *   rawData: any                    // required
 *   createMissingColumns?: boolean  // default: true
 *   deduplicateColumn?: string      // optional column name — skip rows where value already exists
 * }
 *
 * Response:
 * {
 *   insertedRows: number
 *   skippedRows: number
 *   createdColumns: string[]
 *   totalRows: number
 *   format: string
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
    const {
      rawData,
      createMissingColumns = true,
      deduplicateColumn,
      upsertOnDuplicate = false,
    } = body

    if (rawData === undefined || rawData === null) {
      return NextResponse.json({ error: 'rawData is required' }, { status: 400 })
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

    // Infer schema from incoming data
    const inferred = inferSchema(rawData)
    logger.info(
      `Smart insert: format=${inferred.format}, cols=${inferred.columns.length}, rows=${inferred.rows.length}`
    )

    if (inferred.rows.length === 0) {
      return NextResponse.json({
        insertedRows: 0,
        skippedRows: 0,
        createdColumns: [],
        totalRows: table.rowCount ?? 0,
        format: inferred.format,
      })
    }

    // State tracked across the transaction
    let insertedCount = 0
    let skippedCount = 0
    let upsertedCount = 0
    let createdColumns: string[] = []

    await db.transaction(async (tx: any) => {
      // Sync columns — create any missing ones
      const syncResult = await syncColumnsAndGetMapping(
        id,
        createMissingColumns ? inferred.columns : [],
        tx as any
      )
      const { mapping } = syncResult
      createdColumns = syncResult.createdColumns

      // Build set of existing values for deduplication
      let existingDedupeValues: Set<string> | null = null
      let existingDedupeRows: Map<string, string> | null = null
      if (deduplicateColumn && mapping[deduplicateColumn]) {
        const dedupeColId = mapping[deduplicateColumn]
        const existingRows = await tx
          .select({ id: dataTableRow.id, data: dataTableRow.data })
          .from(dataTableRow)
          .where(eq(dataTableRow.tableId, id))

        existingDedupeValues = new Set(
          existingRows
            .map((r: any) => (r.data as Record<string, any>)[dedupeColId])
            .filter((v: any) => v !== undefined && v !== null)
            .map(String)
        )

        // Map dedup value → row ID for upsert updates
        if (upsertOnDuplicate) {
          existingDedupeRows = new Map(
            existingRows
              .filter((r: any) => {
                const v = (r.data as Record<string, any>)[dedupeColId]
                return v !== undefined && v !== null
              })
              .map((r: any) => [String((r.data as Record<string, any>)[dedupeColId]), r.id])
          )
        }
      }

      // Get current max row order
      const [maxOrderResult] = await tx
        .select({ max: sql`COALESCE(MAX("order"), -1)` })
        .from(dataTableRow)
        .where(eq(dataTableRow.tableId, id))

      let currentOrder = ((maxOrderResult?.max as number) ?? -1) + 1
      const now = new Date()

      for (const row of inferred.rows) {
        // Deduplication check
        if (existingDedupeValues !== null && deduplicateColumn) {
          const val = String(row[deduplicateColumn] ?? '')
          if (existingDedupeValues.has(val)) {
            if (upsertOnDuplicate && existingDedupeRows) {
              // Upsert: update the existing row instead of skipping
              const existingRowId = existingDedupeRows.get(val)
              if (existingRowId) {
                const mappedData = applyMapping(row, mapping)
                const [existingRow] = await tx
                  .select({ data: dataTableRow.data })
                  .from(dataTableRow)
                  .where(eq(dataTableRow.id, existingRowId))
                  .limit(1)

                if (existingRow) {
                  const mergedData = {
                    ...(existingRow.data as Record<string, any>),
                    ...mappedData,
                  }
                  await tx
                    .update(dataTableRow)
                    .set({ data: mergedData, updatedAt: now })
                    .where(eq(dataTableRow.id, existingRowId))
                  upsertedCount++
                }
              }
            } else {
              skippedCount++
            }
            continue
          }
          existingDedupeValues.add(val)
        }

        const mappedData = applyMapping(row, mapping)

        await tx.insert(dataTableRow).values({
          id: crypto.randomUUID(),
          tableId: id,
          data: mappedData,
          order: currentOrder++,
          createdAt: now,
          updatedAt: now,
        })
        insertedCount++
      }

      // Update table metadata
      if (insertedCount > 0 || createdColumns.length > 0) {
        await tx
          .update(dataTable)
          .set({
            rowCount: sql`${dataTable.rowCount} + ${insertedCount}`,
            updatedAt: now,
          })
          .where(eq(dataTable.id, id))
      }
    })

    // Fetch updated row count
    const [updated] = await db
      .select({ rowCount: dataTable.rowCount })
      .from(dataTable)
      .where(eq(dataTable.id, id))
      .limit(1)

    return NextResponse.json({
      insertedRows: insertedCount,
      skippedRows: skippedCount,
      upsertedRows: upsertedCount,
      createdColumns,
      totalRows: updated?.rowCount ?? 0,
      format: inferred.format,
    })
  } catch (error) {
    logger.error('Error in smart insert:', error)
    return NextResponse.json({ error: 'Failed to insert data' }, { status: 500 })
  }
}
