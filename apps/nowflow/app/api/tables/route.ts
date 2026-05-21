import { NextResponse } from 'next/server'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { dataTable, dataTableColumn } from '@/db/schema'

const logger = createLogger('TablesAPI')

/**
 * GET /api/tables - List all tables for the current user/workspace
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    const conditions = [eq(dataTable.userId, session.user.id)]
    if (workspaceId) {
      // Show tables that belong to this workspace OR have no workspace (auto-saved tables)
      conditions.push(
        or(eq(dataTable.workspaceId, workspaceId), isNull(dataTable.workspaceId)) as any
      )
    }

    const tables = await db
      .select()
      .from(dataTable)
      .where(and(...conditions))
      .orderBy(desc(dataTable.updatedAt))

    // Get column counts for each table
    const tablesWithMeta = await Promise.all(
      tables.map(async (table: any) => {
        const columns = await db
          .select()
          .from(dataTableColumn)
          .where(eq(dataTableColumn.tableId, table.id))
          .orderBy(dataTableColumn.order)

        return {
          ...table,
          columnCount: columns.length,
          columns,
        }
      })
    )

    return NextResponse.json({ tables: tablesWithMeta })
  } catch (error) {
    logger.error('Error fetching tables:', error)
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 })
  }
}

/**
 * POST /api/tables - Create a new data table
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, workspaceId, columns: initialColumns } = await req.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const tableId = crypto.randomUUID()
    const now = new Date()

    await db.transaction(async (tx: any) => {
      await tx.insert(dataTable).values({
        id: tableId,
        userId: session.user.id,
        workspaceId: workspaceId || null,
        name,
        description: description || null,
        createdAt: now,
        updatedAt: now,
      })

      // Create default columns if none provided
      const columnsToCreate =
        initialColumns?.length > 0
          ? initialColumns
          : [
              { name: 'Name', type: 'text' },
              { name: 'Description', type: 'text' },
              {
                name: 'Status',
                type: 'select',
                options: [
                  { label: 'Active', value: 'active', color: '#10B981' },
                  { label: 'Inactive', value: 'inactive', color: '#6B7280' },
                  { label: 'Pending', value: 'pending', color: '#F59E0B' },
                ],
              },
            ]

      for (let i = 0; i < columnsToCreate.length; i++) {
        const col = columnsToCreate[i]
        await tx.insert(dataTableColumn).values({
          id: crypto.randomUUID(),
          tableId,
          name: col.name,
          type: col.type || 'text',
          order: i,
          options: col.options ? JSON.stringify(col.options) : null,
          aiConfig: col.aiConfig ? JSON.stringify(col.aiConfig) : null,
          createdAt: now,
          updatedAt: now,
        })
      }
    })

    return NextResponse.json({
      table: {
        id: tableId,
        name,
        description,
        workspaceId,
        createdAt: now,
        updatedAt: now,
      },
    })
  } catch (error) {
    logger.error('Error creating table:', error)
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 })
  }
}

/**
 * DELETE /api/tables?id={tableId} - Delete a table
 */
export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tableId = searchParams.get('id')

    if (!tableId) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 })
    }

    // Verify ownership
    const [table] = await db
      .select()
      .from(dataTable)
      .where(and(eq(dataTable.id, tableId), eq(dataTable.userId, session.user.id)))
      .limit(1)

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    await db.delete(dataTable).where(eq(dataTable.id, tableId))

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting table:', error)
    return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 })
  }
}
