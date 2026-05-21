import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowAutoSaveConfig, workflowVersion } from '@/db/schema'
import { computeWorkflowDiff, generateDiffSummary } from './diff-engine'

const logger = createLogger('AutoSaveService')

export interface AutoSaveConfig {
  id: string
  workflowId: string
  enabled: boolean
  intervalMinutes: number
  maxAutoSaveVersions: number
  significantChangeThreshold: number
  createdAt: Date
  updatedAt: Date
}

export interface AutoSaveConfigInput {
  enabled?: boolean
  intervalMinutes?: number
  maxAutoSaveVersions?: number
  significantChangeThreshold?: number
}

const DEFAULT_CONFIG: Omit<AutoSaveConfig, 'id' | 'workflowId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  intervalMinutes: 15,
  maxAutoSaveVersions: 10,
  significantChangeThreshold: 5,
}

/**
 * Gets the auto-save configuration for a workflow
 * Creates default config if it doesn't exist
 */
export async function getAutoSaveConfig(workflowId: string): Promise<AutoSaveConfig> {
  try {
    const [config] = await db
      .select()
      .from(workflowAutoSaveConfig)
      .where(eq(workflowAutoSaveConfig.workflowId, workflowId))
      .limit(1)

    if (config) {
      return config as AutoSaveConfig
    }

    // Create default config
    const id = uuidv4()
    const now = new Date()

    await db.insert(workflowAutoSaveConfig).values({
      id,
      workflowId,
      enabled: DEFAULT_CONFIG.enabled,
      intervalMinutes: DEFAULT_CONFIG.intervalMinutes,
      maxAutoSaveVersions: DEFAULT_CONFIG.maxAutoSaveVersions,
      significantChangeThreshold: DEFAULT_CONFIG.significantChangeThreshold,
      createdAt: now,
      updatedAt: now,
    })

    logger.info(`Created default auto-save config for workflow ${workflowId}`)

    return {
      id,
      workflowId,
      ...DEFAULT_CONFIG,
      createdAt: now,
      updatedAt: now,
    }
  } catch (error) {
    logger.error('Failed to get auto-save config', { workflowId, error })
    throw error
  }
}

/**
 * Updates the auto-save configuration for a workflow
 */
export async function updateAutoSaveConfig(
  workflowId: string,
  updates: AutoSaveConfigInput
): Promise<AutoSaveConfig> {
  try {
    // Ensure config exists
    const existing = await getAutoSaveConfig(workflowId)

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (updates.enabled !== undefined) {
      updateData.enabled = updates.enabled
    }
    if (updates.intervalMinutes !== undefined) {
      if (updates.intervalMinutes < 1 || updates.intervalMinutes > 60) {
        throw new Error('Interval must be between 1 and 60 minutes')
      }
      updateData.intervalMinutes = updates.intervalMinutes
    }
    if (updates.maxAutoSaveVersions !== undefined) {
      if (updates.maxAutoSaveVersions < 1 || updates.maxAutoSaveVersions > 100) {
        throw new Error('Max auto-save versions must be between 1 and 100')
      }
      updateData.maxAutoSaveVersions = updates.maxAutoSaveVersions
    }
    if (updates.significantChangeThreshold !== undefined) {
      if (updates.significantChangeThreshold < 1 || updates.significantChangeThreshold > 50) {
        throw new Error('Significant change threshold must be between 1 and 50')
      }
      updateData.significantChangeThreshold = updates.significantChangeThreshold
    }

    await db
      .update(workflowAutoSaveConfig)
      .set(updateData)
      .where(eq(workflowAutoSaveConfig.workflowId, workflowId))

    logger.info(`Updated auto-save config for workflow ${workflowId}`, { updates })

    return {
      ...existing,
      ...updateData,
    }
  } catch (error) {
    logger.error('Failed to update auto-save config', { workflowId, updates, error })
    throw error
  }
}

/**
 * Checks if there are significant changes between two workflow states
 * Returns true if changes exceed the threshold
 */
export function isSignificantChange(
  previousState: any,
  currentState: any,
  threshold: number
): boolean {
  try {
    const diff = computeWorkflowDiff(previousState, currentState)

    const totalChanges =
      diff.blocks.added.length +
      diff.blocks.removed.length +
      diff.blocks.modified.length +
      diff.edges.added.length +
      diff.edges.removed.length +
      diff.loops.added.length +
      diff.loops.removed.length +
      diff.loops.modified.length

    return totalChanges >= threshold
  } catch (error) {
    logger.error('Failed to check significant change', { error })
    return false
  }
}

/**
 * Gets the count of changes between two workflow states
 */
export function getChangeCount(previousState: any, currentState: any): number {
  try {
    const diff = computeWorkflowDiff(previousState, currentState)

    return (
      diff.blocks.added.length +
      diff.blocks.removed.length +
      diff.blocks.modified.length +
      diff.edges.added.length +
      diff.edges.removed.length +
      diff.loops.added.length +
      diff.loops.removed.length +
      diff.loops.modified.length
    )
  } catch (error) {
    logger.error('Failed to get change count', { error })
    return 0
  }
}

/**
 * Creates an auto-save version if significant changes are detected
 * Returns the new version if created, null otherwise
 */
export async function createAutoSaveVersion(
  workflowId: string,
  userId: string | undefined,
  previousState: any,
  currentState: any
): Promise<{
  id: string
  versionNumber: number
  changeSummary: any
} | null> {
  try {
    const config = await getAutoSaveConfig(workflowId)

    if (!config.enabled) {
      logger.debug(`Auto-save disabled for workflow ${workflowId}`)
      return null
    }

    // Check if changes are significant
    if (!isSignificantChange(previousState, currentState, config.significantChangeThreshold)) {
      logger.debug(
        `Changes not significant enough for auto-save (threshold: ${config.significantChangeThreshold})`
      )
      return null
    }

    // Get the latest version number
    const [latestVersion] = await db
      .select({ versionNumber: workflowVersion.versionNumber })
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.versionNumber))
      .limit(1)

    const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

    // Compute change summary
    const diff = computeWorkflowDiff(previousState, currentState)
    const changeSummary = {
      blocksAdded: diff.blocks.added.length,
      blocksRemoved: diff.blocks.removed.length,
      blocksModified: diff.blocks.modified.length,
      edgesAdded: diff.edges.added.length,
      edgesRemoved: diff.edges.removed.length,
      summary: generateDiffSummary(diff),
    }

    // Create the auto-save version
    const id = uuidv4()
    const now = new Date()

    // Calculate semantic version
    const [latestSemVer] = await db
      .select({
        majorVersion: workflowVersion.majorVersion,
        minorVersion: workflowVersion.minorVersion,
        patchVersion: workflowVersion.patchVersion,
      })
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.versionNumber))
      .limit(1)

    const major = latestSemVer?.majorVersion ?? 0
    const minor = latestSemVer?.minorVersion ?? 0
    const patch = (latestSemVer?.patchVersion ?? 0) + 1
    const semanticVersion = `${major}.${minor}.${patch}`

    await db.insert(workflowVersion).values({
      id,
      workflowId,
      versionNumber: newVersionNumber,
      state: currentState,
      name: `Auto-save v${newVersionNumber}`,
      description: `Automatic save at ${now.toLocaleString()}`,
      changeType: 'auto_save',
      changeSummary,
      createdBy: userId || null,
      createdAt: now,
      semanticVersion,
      majorVersion: major,
      minorVersion: minor,
      patchVersion: patch,
      tags: [],
      isPinned: false,
      isLocked: false,
      metadata: {
        autoSave: true,
        changeCount:
          changeSummary.blocksAdded + changeSummary.blocksRemoved + changeSummary.blocksModified,
      },
    })

    logger.info(`Created auto-save version ${newVersionNumber} for workflow ${workflowId}`, {
      changeSummary,
    })

    // Prune old auto-save versions
    await pruneAutoSaveVersions(workflowId, config.maxAutoSaveVersions)

    return {
      id,
      versionNumber: newVersionNumber,
      changeSummary,
    }
  } catch (error) {
    logger.error('Failed to create auto-save version', { workflowId, error })
    return null
  }
}

/**
 * Prunes old auto-save versions, keeping only the most recent N
 * Only removes auto_save versions, not manual versions
 */
export async function pruneAutoSaveVersions(
  workflowId: string,
  maxToKeep: number
): Promise<number> {
  try {
    // Get all auto-save versions (include isPinned to avoid N+1)
    const autoSaveVersions = await db
      .select({
        id: workflowVersion.id,
        versionNumber: workflowVersion.versionNumber,
        isPinned: workflowVersion.isPinned,
      })
      .from(workflowVersion)
      .where(
        and(eq(workflowVersion.workflowId, workflowId), eq(workflowVersion.changeType, 'auto_save'))
      )
      .orderBy(desc(workflowVersion.versionNumber))

    if (autoSaveVersions.length <= maxToKeep) {
      return 0
    }

    // Versions to delete (oldest ones beyond the limit, skip pinned)
    const versionsToDelete = autoSaveVersions.slice(maxToKeep)
    const idsToDelete = versionsToDelete
      .filter((v: { id: string; isPinned: boolean | null }) => !v.isPinned)
      .map((v: { id: string }) => v.id)

    if (idsToDelete.length === 0) {
      return 0
    }

    await db.delete(workflowVersion).where(inArray(workflowVersion.id, idsToDelete))
    const deletedCount = idsToDelete.length

    if (deletedCount > 0) {
      logger.info(`Pruned ${deletedCount} old auto-save versions for workflow ${workflowId}`)
    }

    return deletedCount
  } catch (error) {
    logger.error('Failed to prune auto-save versions', { workflowId, maxToKeep, error })
    return 0
  }
}

/**
 * Gets the last auto-save version for a workflow
 */
export async function getLastAutoSaveVersion(workflowId: string): Promise<{
  id: string
  versionNumber: number
  createdAt: Date
  state: any
} | null> {
  try {
    const [lastAutoSave] = await db
      .select({
        id: workflowVersion.id,
        versionNumber: workflowVersion.versionNumber,
        createdAt: workflowVersion.createdAt,
        state: workflowVersion.state,
      })
      .from(workflowVersion)
      .where(
        and(eq(workflowVersion.workflowId, workflowId), eq(workflowVersion.changeType, 'auto_save'))
      )
      .orderBy(desc(workflowVersion.versionNumber))
      .limit(1)

    return lastAutoSave || null
  } catch (error) {
    logger.error('Failed to get last auto-save version', { workflowId, error })
    return null
  }
}

/**
 * Checks if enough time has passed since the last auto-save
 */
export async function shouldAutoSave(workflowId: string): Promise<boolean> {
  try {
    const config = await getAutoSaveConfig(workflowId)

    if (!config.enabled) {
      return false
    }

    const lastAutoSave = await getLastAutoSaveVersion(workflowId)

    if (!lastAutoSave) {
      return true
    }

    const timeSinceLastSave = Date.now() - lastAutoSave.createdAt.getTime()
    const intervalMs = config.intervalMinutes * 60 * 1000

    return timeSinceLastSave >= intervalMs
  } catch (error) {
    logger.error('Failed to check if should auto-save', { workflowId, error })
    return false
  }
}
