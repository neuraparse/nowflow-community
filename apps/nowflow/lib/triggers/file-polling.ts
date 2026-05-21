import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'
import { db } from '@/db'
import { workflowTrigger } from '@/db/schema'

const logger = createLogger('FilePolling')

export interface FileTriggerConfig {
  provider: 'google_drive' | 'onedrive' | 'dropbox' | 's3' | 'box'
  credentialId: string
  folderPath: string
  triggerOn: 'created' | 'modified' | 'deleted' | 'any'
  fileFilter?: string
}

export interface FileChange {
  fileId: string
  fileName: string
  mimeType: string
  size: number
  modifiedAt: string
  changeType: 'created' | 'modified' | 'deleted'
  provider: string
}

/**
 * Execute file polling - check for new/changed files
 */
export async function executeFilePolling(
  trigger: typeof workflowTrigger.$inferSelect,
  userId: string
): Promise<{ hasNewData: boolean; newData?: FileChange[] }> {
  const config = trigger.config as FileTriggerConfig

  if (!config.credentialId) {
    logger.warn(`File trigger ${trigger.id} missing credential`)
    return { hasNewData: false }
  }

  switch (config.provider) {
    case 'google_drive':
      return pollGoogleDrive(trigger, config, userId)
    case 'onedrive':
      return pollOneDrive(trigger, config, userId)
    default:
      logger.warn(`File provider ${config.provider} not yet supported for polling`)
      return { hasNewData: false }
  }
}

/**
 * Poll Google Drive for new/modified files
 */
async function pollGoogleDrive(
  trigger: typeof workflowTrigger.$inferSelect,
  config: FileTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: FileChange[] }> {
  const requestId = `file-gdrive-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for Google Drive')
    }

    // Build query
    const queryParts: string[] = []

    if (trigger.lastPolledAt) {
      queryParts.push(`modifiedTime > '${trigger.lastPolledAt.toISOString()}'`)
    }

    if (config.folderPath) {
      queryParts.push(`'${config.folderPath}' in parents`)
    }

    queryParts.push('trashed = false')

    const query = queryParts.join(' and ')
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=20&fields=files(id,name,mimeType,size,modifiedTime,createdTime)`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google Drive API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    let files: any[] = data.files || []

    // Apply file filter if specified
    if (config.fileFilter) {
      const patterns = config.fileFilter.split(',').map((p) => p.trim().toLowerCase())
      files = files.filter((f) => {
        const name = (f.name || '').toLowerCase()
        return patterns.some((pattern) => {
          const ext = pattern.replace('*', '')
          return name.endsWith(ext)
        })
      })
    }

    if (files.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Dedup by file ID
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const newFiles = files.filter((f) => !lastSeenIdentifiers.includes(f.id))

    if (newFiles.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    const newIds = newFiles.map((f) => f.id)
    const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    const changes: FileChange[] = newFiles.map((f) => ({
      fileId: f.id,
      fileName: f.name,
      mimeType: f.mimeType || 'application/octet-stream',
      size: parseInt(f.size || '0', 10),
      modifiedAt: f.modifiedTime || new Date().toISOString(),
      changeType: 'created' as const,
      provider: 'google_drive',
    }))

    logger.info(`[${requestId}] Found ${changes.length} new/modified files in Google Drive`)
    return { hasNewData: true, newData: changes }
  } catch (error: any) {
    logger.error(`[${requestId}] Google Drive polling error`, error)

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
 * Poll OneDrive for new/modified files
 */
async function pollOneDrive(
  trigger: typeof workflowTrigger.$inferSelect,
  config: FileTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: FileChange[] }> {
  const requestId = `file-onedrive-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for OneDrive')
    }

    // Build the URL based on folder path
    const folderPath = config.folderPath || '/'
    let url: string

    if (folderPath === '/' || folderPath === 'root') {
      url = 'https://graph.microsoft.com/v1.0/me/drive/root/children'
    } else {
      url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folderPath)}:/children`
    }

    // Add filter and ordering
    const params = new URLSearchParams()
    if (trigger.lastPolledAt) {
      params.set('$filter', `lastModifiedDateTime ge ${trigger.lastPolledAt.toISOString()}`)
    }
    params.set('$orderby', 'lastModifiedDateTime desc')
    params.set('$top', '20')
    params.set('$select', 'id,name,file,size,lastModifiedDateTime,createdDateTime')

    url += `?${params.toString()}`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OneDrive API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    let files: any[] = (data.value || []).filter((item: any) => item.file) // Only files, not folders

    // Apply file filter if specified
    if (config.fileFilter) {
      const patterns = config.fileFilter.split(',').map((p) => p.trim().toLowerCase())
      files = files.filter((f) => {
        const name = (f.name || '').toLowerCase()
        return patterns.some((pattern) => {
          const ext = pattern.replace('*', '')
          return name.endsWith(ext)
        })
      })
    }

    if (files.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Dedup by file ID
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const newFiles = files.filter((f) => !lastSeenIdentifiers.includes(f.id))

    if (newFiles.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    const newIds = newFiles.map((f) => f.id)
    const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    const changes: FileChange[] = newFiles.map((f) => ({
      fileId: f.id,
      fileName: f.name,
      mimeType: f.file?.mimeType || 'application/octet-stream',
      size: f.size || 0,
      modifiedAt: f.lastModifiedDateTime || new Date().toISOString(),
      changeType: 'created' as const,
      provider: 'onedrive',
    }))

    logger.info(`[${requestId}] Found ${changes.length} new/modified files in OneDrive`)
    return { hasNewData: true, newData: changes }
  } catch (error: any) {
    logger.error(`[${requestId}] OneDrive polling error`, error)

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
