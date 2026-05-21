import { and, eq, sql } from 'drizzle-orm'
import 'server-only'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import {
  file,
  knowledgeDocument,
  knowledgeSource,
  subscription,
  subscriptionPlan,
  workspace,
  workspaceMember,
} from '@/db/schema'

const logger = createLogger('StorageLimitService')

export interface StorageInfo {
  used: number // bytes
  limit: number // bytes
  percentage: number
  remaining: number // bytes
  canUpload: (fileSize: number) => boolean
}

export interface StorageLimitError extends Error {
  code: 'STORAGE_LIMIT_EXCEEDED'
  used: number
  limit: number
  attempted: number
}

/**
 * Storage Limit Service
 *
 * Manages storage limits and usage for workspaces based on subscription plans.
 */
export class StorageLimitService {
  constructor(
    private userId: string,
    private workspaceId?: string
  ) {}

  /**
   * Get storage information for workspace
   */
  async getStorageInfo(): Promise<StorageInfo> {
    const workspaceId = await this.getWorkspaceId()

    // Get workspace storage usage
    const workspaces = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1)

    if (workspaces.length === 0) {
      throw new Error('Workspace not found')
    }

    const currentWorkspace = workspaces[0]
    const storageUsed = currentWorkspace.storageUsed || 0

    // Get subscription plan storage limit
    const storageLimit = await this.getStorageLimit(workspaceId)

    const percentage = (storageUsed / storageLimit) * 100
    const remaining = Math.max(0, storageLimit - storageUsed)

    return {
      used: storageUsed,
      limit: storageLimit,
      percentage,
      remaining,
      canUpload: (fileSize: number) => storageUsed + fileSize <= storageLimit,
    }
  }

  /**
   * Check if file can be uploaded without exceeding storage limit
   */
  async checkStorageLimit(fileSize: number): Promise<void> {
    const info = await this.getStorageInfo()

    if (!info.canUpload(fileSize)) {
      const error = new Error(
        `Storage limit exceeded. Used: ${this.formatBytes(info.used)}, Limit: ${this.formatBytes(info.limit)}, Attempted: ${this.formatBytes(fileSize)}`
      ) as StorageLimitError

      error.code = 'STORAGE_LIMIT_EXCEEDED'
      error.used = info.used
      error.limit = info.limit
      error.attempted = fileSize

      logger.warn('Storage limit exceeded', {
        workspaceId: this.workspaceId,
        used: info.used,
        limit: info.limit,
        attempted: fileSize,
      })

      throw error
    }
  }

  /**
   * Update workspace storage usage
   */
  async updateStorageUsage(deltaBytes: number): Promise<void> {
    const workspaceId = await this.getWorkspaceId()

    await db
      .update(workspace)
      .set({
        storageUsed: sql`GREATEST(${workspace.storageUsed} + ${deltaBytes}, 0)`,
      })
      .where(eq(workspace.id, workspaceId))

    logger.info('Storage usage updated', {
      workspaceId,
      deltaBytes,
    })
  }

  /**
   * Recalculate workspace storage usage from files table
   */
  async recalculateStorageUsage(): Promise<number> {
    const workspaceId = await this.getWorkspaceId()

    // Calculate total storage from files table (which includes knowledge uploads)
    const result = await db
      .select({
        totalSize: sql`COALESCE(SUM(${file.size}), 0)::bigint`,
      })
      .from(file)
      .where(and(eq(file.workspaceId, workspaceId), eq(file.status, 'active')))

    const totalSize = Number(result[0]?.totalSize || 0)

    // Update workspace storage
    await db
      .update(workspace)
      .set({
        storageUsed: totalSize,
      })
      .where(eq(workspace.id, workspaceId))

    logger.info('Storage usage recalculated', {
      workspaceId,
      totalSize,
    })

    return totalSize
  }

  /**
   * Get storage limit for workspace based on subscription plan
   */
  private async getStorageLimit(workspaceId: string): Promise<number> {
    // Get workspace owner's subscription
    const workspaceData = await db
      .select({
        ownerId: workspace.ownerId,
      })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1)

    if (workspaceData.length === 0) {
      throw new Error('Workspace not found')
    }

    const ownerId = workspaceData[0].ownerId

    // Get user's active subscription
    const subscriptions = await db
      .select({
        storageLimit: subscriptionPlan.storageLimit,
      })
      .from(subscription)
      .innerJoin(subscriptionPlan, eq(subscription.planId, subscriptionPlan.id))
      .where(and(eq(subscription.referenceId, ownerId), eq(subscription.status, 'active')))
      .limit(1)

    if (subscriptions.length === 0) {
      // No active subscription - use free tier (100MB)
      logger.info('No active subscription found, using free tier', {
        workspaceId,
        ownerId,
      })
      return 100 * 1024 * 1024 // 100MB in bytes
    }

    // Convert MB to bytes
    const storageLimitMB = subscriptions[0].storageLimit
    return storageLimitMB * 1024 * 1024
  }

  /**
   * Get workspace ID (use provided or get user's default)
   */
  private async getWorkspaceId(): Promise<string> {
    if (this.workspaceId) {
      return this.workspaceId
    }

    // Get user's first workspace
    const workspaces = await db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerId, this.userId))
      .limit(1)

    if (workspaces.length === 0) {
      throw new Error('No workspace found for user')
    }

    return workspaces[0].id
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }
}

/**
 * Check if error is a storage limit error
 */
export function isStorageLimitError(error: any): error is StorageLimitError {
  return error && error.code === 'STORAGE_LIMIT_EXCEEDED'
}
