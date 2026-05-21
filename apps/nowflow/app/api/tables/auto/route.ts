import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { inferSchema } from '@/lib/tables/schema-inference'
import { applyMapping, syncColumnsAndGetMapping } from '@/lib/tables/schema-sync'
import { db } from '@/db'
import { dataTable, dataTableRow } from '@/db/schema'

const logger = createLogger('AutoTableAPI')

/**
 * POST /api/tables/auto
 *
 * Find-or-create a table by name, then smart-insert any rawData into it.
 * This is the single-call "just save it" endpoint for workflow blocks.
 *
 * Body:
 * {
 *   tableName: string               // required — table to find or create
 *   rawData: any                    // required — any format
 *   workspaceId?: string
 *   description?: string            // used when creating a new table
 *   createMissingColumns?: boolean  // default: true
 *   deduplicateColumn?: string      // optional: skip duplicate rows
 * }
 *
 * Response:
 * {
 *   tableId: string
 *   tableName: string
 *   isNewTable: boolean
 *   insertedRows: number
 *   skippedRows: number
 *   createdColumns: string[]
 *   totalRows: number
 *   format: string
 * }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      tableName,
      rawData,
      workspaceId,
      description,
      createMissingColumns = true,
      deduplicateColumn,
      upsertOnDuplicate = false,
    } = body

    if (!tableName || typeof tableName !== 'string') {
      return NextResponse.json({ error: 'tableName is required' }, { status: 400 })
    }

    if (rawData === undefined || rawData === null) {
      return NextResponse.json({ error: 'rawData is required' }, { status: 400 })
    }

    // Infer schema upfront so we can pass initial columns when creating the table
    const inferred = inferSchema(rawData)
    logger.info(
      `Auto table "${tableName}": format=${inferred.format}, cols=${inferred.columns.length}, rows=${inferred.rows.length}`
    )

    let tableId: string
    let isNewTable = false

    // Find existing table by name for this user
    const conditions: ReturnType<typeof and>[] = [
      eq(dataTable.userId, session.user.id),
      eq(dataTable.name, tableName),
    ] as any[]

    if (workspaceId) {
      conditions.push(eq(dataTable.workspaceId, workspaceId) as any)
    }

    const [existingTable] = await db
      .select({ id: dataTable.id, rowCount: dataTable.rowCount })
      .from(dataTable)
      .where(and(...(conditions as any)))
      .limit(1)

    if (existingTable) {
      tableId = existingTable.id
    } else {
      // Create a new table with the inferred columns
      tableId = crypto.randomUUID()
      isNewTable = true
      const now = new Date()

      await db.transaction(async (tx: any) => {
        await tx.insert(dataTable).values({
          id: tableId,
          userId: session.user.id,
          workspaceId: workspaceId ?? null,
          name: tableName,
          description: description ?? null,
          createdAt: now,
          updatedAt: now,
        })

        // Insert inferred columns as initial schema
        const columnsToCreate =
          inferred.columns.length > 0
            ? inferred.columns
            : [{ name: 'content', type: 'text' as const }]

        for (let i = 0; i < columnsToCreate.length; i++) {
          await tx.insert((await import('@/db/schema')).dataTableColumn).values({
            id: crypto.randomUUID(),
            tableId,
            name: columnsToCreate[i].name,
            type: columnsToCreate[i].type,
            order: i,
            createdAt: now,
            updatedAt: now,
          })
        }
      })
    }

    // Now run smart insert into the found/created table
    if (inferred.rows.length === 0) {
      const [t] = await db
        .select({ rowCount: dataTable.rowCount })
        .from(dataTable)
        .where(eq(dataTable.id, tableId))
        .limit(1)

      return NextResponse.json({
        tableId,
        tableName,
        isNewTable,
        insertedRows: 0,
        skippedRows: 0,
        createdColumns: [],
        totalRows: t?.rowCount ?? 0,
        format: inferred.format,
      })
    }

    let insertedCount = 0
    let skippedCount = 0
    let upsertedCount = 0
    let createdColumns: string[] = []

    await db.transaction(async (tx: any) => {
      const syncResult = await syncColumnsAndGetMapping(
        tableId,
        createMissingColumns ? inferred.columns : [],
        tx as any
      )
      const { mapping } = syncResult
      createdColumns = syncResult.createdColumns

      // Build dedup set if requested
      let existingDedupeValues: Set<string> | null = null
      let existingDedupeRows: Map<string, string> | null = null
      if (deduplicateColumn && mapping[deduplicateColumn]) {
        const dedupeColId = mapping[deduplicateColumn]
        const existingRows = await tx
          .select({ id: dataTableRow.id, data: dataTableRow.data })
          .from(dataTableRow)
          .where(eq(dataTableRow.tableId, tableId))

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

      const [maxOrderResult] = await tx
        .select({ max: sql`COALESCE(MAX("order"), -1)` })
        .from(dataTableRow)
        .where(eq(dataTableRow.tableId, tableId))

      let currentOrder = ((maxOrderResult?.max as number) ?? -1) + 1
      const now = new Date()

      for (const row of inferred.rows) {
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
          tableId,
          data: mappedData,
          order: currentOrder++,
          createdAt: now,
          updatedAt: now,
        })
        insertedCount++
      }

      if (insertedCount > 0 || createdColumns.length > 0) {
        await tx
          .update(dataTable)
          .set({
            rowCount: sql`${dataTable.rowCount} + ${insertedCount}`,
            updatedAt: now,
          })
          .where(eq(dataTable.id, tableId))
      }
    })

    const [updated] = await db
      .select({ rowCount: dataTable.rowCount })
      .from(dataTable)
      .where(eq(dataTable.id, tableId))
      .limit(1)

    return NextResponse.json({
      tableId,
      tableName,
      isNewTable,
      insertedRows: insertedCount,
      skippedRows: skippedCount,
      upsertedRows: upsertedCount,
      createdColumns,
      totalRows: updated?.rowCount ?? 0,
      format: inferred.format,
    })
  } catch (error) {
    logger.error('Error in auto table:', error)
    return NextResponse.json({ error: 'Failed to auto-save data' }, { status: 500 })
  }
}
