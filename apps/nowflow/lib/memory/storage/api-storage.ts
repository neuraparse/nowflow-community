import { createLogger } from '@/lib/logs/console-logger'
import { getApiUrl } from '@/executor/utils/api-url'
import type { MemoryEntry, MemoryQuery, MemoryStorageProvider } from '../types'

const logger = createLogger('ApiStorage')

interface MemoryApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * API-backed memory storage provider (browser + server safe).
 *
 * Uses the /api/memory endpoint so client-side executions don't import
 * Node-only database drivers.
 */
export class ApiMemoryStorage implements MemoryStorageProvider {
  private readonly contextBaseUrl?: string

  constructor(contextBaseUrl?: string) {
    this.contextBaseUrl = contextBaseUrl
  }

  private get endpoint(): string {
    return getApiUrl('/api/memory', undefined, this.contextBaseUrl)
  }

  async save(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const response = await this.request<{ id: string }>('save', { entry })
    return response.id
  }

  async saveBatch(
    entries: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<string[]> {
    if (entries.length === 0) return []
    const response = await this.request<{ ids: string[] }>('saveBatch', { entries })
    return response.ids
  }

  async get(id: string, sessionId: string): Promise<MemoryEntry | null> {
    const response = await this.request<{ entry: MemoryEntry | null }>('get', { id, sessionId })
    const entry = response.entry

    if (!entry) return null

    // Convert date strings back to Date objects after JSON deserialization
    // Use safe date parsing to handle invalid/missing values
    return {
      ...entry,
      createdAt: this.safeParseDate(entry.createdAt) ?? new Date(),
      updatedAt: this.safeParseDate(entry.updatedAt) ?? new Date(),
      expiresAt: entry.expiresAt ? this.safeParseDate(entry.expiresAt) : undefined,
    }
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const response = await this.request<{ entries: MemoryEntry[] }>('query', { query })
    const entries = response.entries ?? []

    // Convert date strings back to Date objects after JSON deserialization
    // Use safe date parsing to handle invalid/missing values
    return entries.map((entry) => ({
      ...entry,
      createdAt: this.safeParseDate(entry.createdAt) ?? new Date(),
      updatedAt: this.safeParseDate(entry.updatedAt) ?? new Date(),
      expiresAt: entry.expiresAt ? this.safeParseDate(entry.expiresAt) : undefined,
    }))
  }

  /**
   * Safely parse a date value, returning undefined if invalid
   */
  private safeParseDate(value: any): Date | undefined {
    if (!value) return undefined
    if (value instanceof Date) return value
    const date = new Date(value)
    return isNaN(date.getTime()) ? undefined : date
  }

  async update(id: string, sessionId: string, updates: Partial<MemoryEntry>): Promise<void> {
    await this.request('update', { id, sessionId, updates })
  }

  async delete(id: string, sessionId: string): Promise<void> {
    await this.request('delete', { id, sessionId })
  }

  async deleteSession(sessionId: string): Promise<number> {
    const response = await this.request<{ count: number }>('deleteSession', { sessionId })
    return response.count
  }

  async deleteExpired(): Promise<number> {
    const response = await this.request<{ count: number }>('deleteExpired', {})
    return response.count
  }

  async count(sessionId: string): Promise<number> {
    const response = await this.request<{ count: number }>('count', { sessionId })
    return response.count
  }

  private async request<T = unknown>(action: string, payload: Record<string, any>): Promise<T> {
    try {
      logger.info('[ApiStorage] Making request', {
        endpoint: this.endpoint,
        action,
        payloadKeys: Object.keys(payload),
      })

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action, payload }),
        // Don't follow redirects automatically - handle them manually
        redirect: 'manual',
      })

      // Check for redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        logger.error('[ApiStorage] Unexpected redirect', {
          status: response.status,
          location,
          endpoint: this.endpoint,
        })
        throw new Error(`Memory API redirected to ${location} (status: ${response.status})`)
      }

      // Check for non-OK status
      if (!response.ok) {
        logger.error('[ApiStorage] HTTP error', {
          status: response.status,
          statusText: response.statusText,
          endpoint: this.endpoint,
        })
        throw new Error(`Memory API HTTP error: ${response.status} ${response.statusText}`)
      }

      const result = (await response.json()) as MemoryApiResponse<T>

      if (!result.success) {
        const message = result.error || `Memory API request failed: ${response.status}`
        logger.error('[ApiStorage] API error', {
          error: message,
          action,
        })
        throw new Error(message)
      }

      logger.info('[ApiStorage] Request successful', {
        action,
        hasData: !!result.data,
      })

      return result.data as T
    } catch (error) {
      logger.error('[ApiStorage] Request failed', {
        error: error instanceof Error ? error.message : String(error),
        action,
        endpoint: this.endpoint,
      })
      throw error
    }
  }
}

let apiStorageInstance: ApiMemoryStorage | null = null

export function getApiStorage(contextBaseUrl?: string): ApiMemoryStorage {
  // Always create new instance with contextBaseUrl (deployment-specific)
  // Don't cache because different deployments may have different base URLs
  if (contextBaseUrl) {
    return new ApiMemoryStorage(contextBaseUrl)
  }

  // For non-deployment contexts, use singleton
  if (!apiStorageInstance) {
    apiStorageInstance = new ApiMemoryStorage()
  }
  return apiStorageInstance
}
