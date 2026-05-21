import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'
import { db } from '@/db'
import { workflowTrigger } from '@/db/schema'

const logger = createLogger('DatabasePolling')

export interface DatabaseTriggerConfig {
  provider: 'google_sheets' | 'airtable' | 'notion' | 'postgresql' | 'mysql' | 'mongodb'
  credentialId: string
  resourceId: string
  triggerOn: 'insert' | 'update' | 'delete' | 'any'
}

export interface DatabaseChange {
  recordId: string
  changeType: 'insert' | 'update' | 'delete'
  fields: Record<string, any>
  createdAt: string
  provider: string
}

/**
 * Execute database polling - check for new/changed records
 */
export async function executeDatabasePolling(
  trigger: typeof workflowTrigger.$inferSelect,
  userId: string
): Promise<{ hasNewData: boolean; newData?: DatabaseChange[] }> {
  const config = trigger.config as DatabaseTriggerConfig

  if (!config.credentialId || !config.resourceId) {
    logger.warn(`Database trigger ${trigger.id} missing credential or resourceId`)
    return { hasNewData: false }
  }

  switch (config.provider) {
    case 'google_sheets':
      return pollGoogleSheets(trigger, config, userId)
    case 'airtable':
      return pollAirtable(trigger, config, userId)
    case 'notion':
      return pollNotion(trigger, config, userId)
    default:
      logger.warn(`Database provider ${config.provider} not yet supported for polling`)
      return { hasNewData: false }
  }
}

/**
 * Poll Google Sheets for new rows
 * Strategy: Track row count. If more rows now than last time, new rows were added.
 */
async function pollGoogleSheets(
  trigger: typeof workflowTrigger.$inferSelect,
  config: DatabaseTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: DatabaseChange[] }> {
  const requestId = `db-sheets-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for Google Sheets')
    }

    // Get all values from the sheet
    const range = 'A:ZZ' // Full sheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.resourceId}/values/${encodeURIComponent(range)}`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google Sheets API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const rows: any[][] = data.values || []

    if (rows.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Use row index as identifier; track last known row count
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const lastRowCount =
      lastSeenIdentifiers.length > 0 ? parseInt(lastSeenIdentifiers[0] || '0', 10) : 0

    const currentRowCount = rows.length
    const headers = rows[0] || []

    if (currentRowCount <= lastRowCount) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // New rows detected (rows after lastRowCount)
    const newRows = rows.slice(Math.max(lastRowCount, 1)) // Skip header row
    const changes: DatabaseChange[] = newRows.map((row, idx) => {
      const fields: Record<string, any> = {}
      headers.forEach((header: string, colIdx: number) => {
        fields[header || `column_${colIdx}`] = row[colIdx] || ''
      })

      return {
        recordId: `row_${lastRowCount + idx + 1}`,
        changeType: 'insert' as const,
        fields,
        createdAt: new Date().toISOString(),
        provider: 'google_sheets',
      }
    })

    // Store current row count as identifier
    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: [String(currentRowCount)],
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    logger.info(`[${requestId}] Found ${changes.length} new rows in Google Sheets`)
    return { hasNewData: true, newData: changes }
  } catch (error: any) {
    logger.error(`[${requestId}] Google Sheets polling error`, error)

    await db
      .update(workflowTrigger)
      .set({
        lastError: error.message,
        failedTriggers: (trigger.failedTriggers || 0) + 1,
        healthStatus: trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning',
      })
      .where(eq(workflowTrigger.id, trigger.id))

    throw error
  }
}

/**
 * Poll Airtable for new records
 */
async function pollAirtable(
  trigger: typeof workflowTrigger.$inferSelect,
  config: DatabaseTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: DatabaseChange[] }> {
  const requestId = `db-airtable-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for Airtable')
    }

    // resourceId format: baseId/tableId (e.g., appXXX/tblXXX)
    const [baseId, tableId] = config.resourceId.split('/')
    if (!baseId || !tableId) {
      throw new Error('Invalid Airtable resource ID. Expected format: baseId/tableId')
    }

    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=20`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Airtable API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const records: any[] = data.records || []

    if (records.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Dedup by record ID
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const newRecords = records.filter((r) => !lastSeenIdentifiers.includes(r.id))

    if (newRecords.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    const newIds = newRecords.map((r) => r.id)
    const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    const changes: DatabaseChange[] = newRecords.map((r) => ({
      recordId: r.id,
      changeType: 'insert' as const,
      fields: r.fields || {},
      createdAt: r.createdTime || new Date().toISOString(),
      provider: 'airtable',
    }))

    logger.info(`[${requestId}] Found ${changes.length} new Airtable records`)
    return { hasNewData: true, newData: changes }
  } catch (error: any) {
    logger.error(`[${requestId}] Airtable polling error`, error)

    await db
      .update(workflowTrigger)
      .set({
        lastError: error.message,
        failedTriggers: (trigger.failedTriggers || 0) + 1,
        healthStatus: trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning',
      })
      .where(eq(workflowTrigger.id, trigger.id))

    throw error
  }
}

/**
 * Poll Notion database for new pages
 */
async function pollNotion(
  trigger: typeof workflowTrigger.$inferSelect,
  config: DatabaseTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: DatabaseChange[] }> {
  const requestId = `db-notion-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for Notion')
    }

    // Build query with time filter
    const body: any = {
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 20,
    }

    if (trigger.lastPolledAt) {
      body.filter = {
        timestamp: 'created_time',
        created_time: {
          after: trigger.lastPolledAt.toISOString(),
        },
      }
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${config.resourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Notion API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const pages: any[] = data.results || []

    if (pages.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Dedup by page ID
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const newPages = pages.filter((p) => !lastSeenIdentifiers.includes(p.id))

    if (newPages.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    const newIds = newPages.map((p) => p.id)
    const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    const changes: DatabaseChange[] = newPages.map((p) => ({
      recordId: p.id,
      changeType: 'insert' as const,
      fields: extractNotionProperties(p.properties || {}),
      createdAt: p.created_time || new Date().toISOString(),
      provider: 'notion',
    }))

    logger.info(`[${requestId}] Found ${changes.length} new Notion pages`)
    return { hasNewData: true, newData: changes }
  } catch (error: any) {
    logger.error(`[${requestId}] Notion polling error`, error)

    await db
      .update(workflowTrigger)
      .set({
        lastError: error.message,
        failedTriggers: (trigger.failedTriggers || 0) + 1,
        healthStatus: trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning',
      })
      .where(eq(workflowTrigger.id, trigger.id))

    throw error
  }
}

/**
 * Extract a simplified key-value map from Notion page properties
 */
function extractNotionProperties(properties: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [key, prop] of Object.entries(properties)) {
    switch (prop.type) {
      case 'title':
        result[key] = prop.title?.map((t: any) => t.plain_text).join('') || ''
        break
      case 'rich_text':
        result[key] = prop.rich_text?.map((t: any) => t.plain_text).join('') || ''
        break
      case 'number':
        result[key] = prop.number
        break
      case 'select':
        result[key] = prop.select?.name || null
        break
      case 'multi_select':
        result[key] = prop.multi_select?.map((s: any) => s.name) || []
        break
      case 'date':
        result[key] = prop.date?.start || null
        break
      case 'checkbox':
        result[key] = prop.checkbox
        break
      case 'url':
        result[key] = prop.url
        break
      case 'email':
        result[key] = prop.email
        break
      case 'phone_number':
        result[key] = prop.phone_number
        break
      case 'status':
        result[key] = prop.status?.name || null
        break
      default:
        result[key] = prop[prop.type] ?? null
        break
    }
  }

  return result
}
