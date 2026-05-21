import { and, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowVersion, workflowVersionDiff } from '@/db/schema'
import { computeWorkflowDiff, generateDiffSummary } from './diff-engine'

type WorkflowVersionRow = typeof workflowVersion.$inferSelect

const logger = createLogger('VersionService')

export type ChangeType = 'create' | 'update' | 'deploy' | 'restore' | 'auto_save'
export type SemanticBumpType = 'major' | 'minor' | 'patch'

export interface SemanticVersion {
  major: number
  minor: number
  patch: number
}

export interface CreateVersionOptions {
  workflowId: string
  userId?: string
  changeType: ChangeType
  name?: string
  description?: string
  gitCommitSha?: string
  gitBranch?: string
  // New semantic versioning options
  semanticBump?: SemanticBumpType
  tags?: string[]
  isPinned?: boolean
  releaseNotes?: string
  metadata?: Record<string, any>
}

export interface VersionFilter {
  changeTypes?: ChangeType[]
  tags?: string[]
  isPinned?: boolean
  isLocked?: boolean
  dateFrom?: Date
  dateTo?: Date
  searchQuery?: string
  createdBy?: string
  semanticVersionPrefix?: string // e.g., "1.0" for all 1.0.x versions
}

export interface WorkflowVersionData {
  id: string
  workflowId: string
  versionNumber: number
  state: any
  name: string | null
  description: string | null
  changeType: string
  changeSummary: any
  createdBy: string | null
  createdAt: Date
  gitCommitSha: string | null
  gitBranch: string | null
  gitSyncedAt: Date | null
  // New fields
  semanticVersion: string | null
  majorVersion: number
  minorVersion: number
  patchVersion: number
  tags: string[]
  isPinned: boolean
  isLocked: boolean
  releaseNotes: string | null
  metadata: Record<string, any>
}

export interface VersionExportData {
  version: Omit<WorkflowVersionData, 'state'>
  state: any
  exportedAt: string
  exportVersion: string
}

export interface VersionTimelineEntry {
  id: string
  versionNumber: number
  semanticVersion: string | null
  changeType: string
  name: string | null
  createdAt: Date
  isPinned: boolean
  isLocked: boolean
  tags: string[]
  changeSummary: any
}

/**
 * Parses a semantic version string into components
 */
export function parseSemanticVersion(version: string): SemanticVersion {
  const parts = version.split('.').map((v) => parseInt(v, 10))
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  }
}

/**
 * Formats semantic version components into a string
 */
export function formatSemanticVersion(version: SemanticVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

/**
 * Gets the next semantic version based on bump type
 */
export async function getNextSemanticVersion(
  workflowId: string,
  bumpType: SemanticBumpType = 'patch'
): Promise<SemanticVersion> {
  const [latestVersion] = await db
    .select({
      majorVersion: workflowVersion.majorVersion,
      minorVersion: workflowVersion.minorVersion,
      patchVersion: workflowVersion.patchVersion,
    })
    .from(workflowVersion)
    .where(eq(workflowVersion.workflowId, workflowId))
    .orderBy(desc(workflowVersion.versionNumber))
    .limit(1)

  const current: SemanticVersion = {
    major: latestVersion?.majorVersion ?? 0,
    minor: latestVersion?.minorVersion ?? 0,
    patch: latestVersion?.patchVersion ?? 0,
  }

  switch (bumpType) {
    case 'major':
      return { major: current.major + 1, minor: 0, patch: 0 }
    case 'minor':
      return { major: current.major, minor: current.minor + 1, patch: 0 }
    case 'patch':
    default:
      return { major: current.major, minor: current.minor, patch: current.patch + 1 }
  }
}

/**
 * Creates a new version for a workflow
 */
export async function createVersion(options: CreateVersionOptions): Promise<WorkflowVersionData> {
  const {
    workflowId,
    userId,
    changeType,
    name,
    description,
    gitCommitSha,
    gitBranch,
    semanticBump = 'patch',
    tags = [],
    isPinned = false,
    releaseNotes,
    metadata = {},
  } = options

  try {
    // Get current workflow state
    const [currentWorkflow] = await db
      .select({ state: workflow.state, name: workflow.name })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!currentWorkflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    // Get latest version number
    const [latestVersion] = await db
      .select({ versionNumber: workflowVersion.versionNumber })
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.versionNumber))
      .limit(1)

    const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

    // Compute change summary if there's a previous version
    let changeSummary = null
    if (latestVersion) {
      const [previousVersion] = await db
        .select({ state: workflowVersion.state })
        .from(workflowVersion)
        .where(
          and(
            eq(workflowVersion.workflowId, workflowId),
            eq(workflowVersion.versionNumber, latestVersion.versionNumber)
          )
        )
        .limit(1)

      if (previousVersion) {
        const diff = computeWorkflowDiff(previousVersion.state, currentWorkflow.state)
        changeSummary = {
          blocksAdded: diff.blocks.added.length,
          blocksRemoved: diff.blocks.removed.length,
          blocksModified: diff.blocks.modified.length,
          edgesAdded: diff.edges.added.length,
          edgesRemoved: diff.edges.removed.length,
          summary: generateDiffSummary(diff),
        }
      }
    }

    // Calculate semantic version
    const semVer = await getNextSemanticVersion(workflowId, semanticBump)
    const semanticVersion = formatSemanticVersion(semVer)

    // Create version
    const versionId = uuidv4()
    const now = new Date()

    await db.insert(workflowVersion).values({
      id: versionId,
      workflowId,
      versionNumber: newVersionNumber,
      state: currentWorkflow.state,
      name: name || `Version ${newVersionNumber}`,
      description,
      changeType,
      changeSummary,
      createdBy: userId || null,
      createdAt: now,
      gitCommitSha: gitCommitSha || null,
      gitBranch: gitBranch || null,
      gitSyncedAt: gitCommitSha ? now : null,
      // New fields
      semanticVersion,
      majorVersion: semVer.major,
      minorVersion: semVer.minor,
      patchVersion: semVer.patch,
      tags,
      isPinned,
      isLocked: false,
      releaseNotes: releaseNotes || null,
      metadata,
    })

    logger.info(
      `Created version ${newVersionNumber} (${semanticVersion}) for workflow ${workflowId}`,
      {
        versionId,
        changeType,
        semanticVersion,
        tags,
        isPinned,
        changeSummary,
      }
    )

    return {
      id: versionId,
      workflowId,
      versionNumber: newVersionNumber,
      state: currentWorkflow.state,
      name: name || `Version ${newVersionNumber}`,
      description: description || null,
      changeType,
      changeSummary,
      createdBy: userId || null,
      createdAt: now,
      gitCommitSha: gitCommitSha || null,
      gitBranch: gitBranch || null,
      gitSyncedAt: gitCommitSha ? now : null,
      semanticVersion,
      majorVersion: semVer.major,
      minorVersion: semVer.minor,
      patchVersion: semVer.patch,
      tags,
      isPinned,
      isLocked: false,
      releaseNotes: releaseNotes || null,
      metadata,
    }
  } catch (error) {
    logger.error('Failed to create version', { workflowId, error })
    throw error
  }
}

/**
 * Gets all versions for a workflow with optional filtering
 */
export async function getVersions(
  workflowId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ versions: WorkflowVersionData[]; total: number }> {
  const { limit = 50, offset = 0 } = options

  try {
    const versions = await db
      .select()
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.versionNumber))
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))

    // Transform to ensure proper types
    const transformedVersions = versions.map((v: WorkflowVersionRow) => ({
      ...v,
      tags: (v.tags as string[]) || [],
      isPinned: v.isPinned ?? false,
      isLocked: v.isLocked ?? false,
      majorVersion: v.majorVersion ?? 0,
      minorVersion: v.minorVersion ?? 0,
      patchVersion: v.patchVersion ?? 0,
      metadata: (v.metadata as Record<string, any>) || {},
    })) as WorkflowVersionData[]

    return {
      versions: transformedVersions,
      total: Number(count),
    }
  } catch (error) {
    logger.error('Failed to get versions', { workflowId, error })
    throw error
  }
}

/**
 * Gets versions with filtering support
 */
export async function getVersionsFiltered(
  workflowId: string,
  filter: VersionFilter,
  options: { limit?: number; offset?: number } = {}
): Promise<{ versions: WorkflowVersionData[]; total: number }> {
  const { limit = 50, offset = 0 } = options

  try {
    // Build where conditions
    const conditions: any[] = [eq(workflowVersion.workflowId, workflowId)]

    if (filter.changeTypes && filter.changeTypes.length > 0) {
      conditions.push(inArray(workflowVersion.changeType, filter.changeTypes))
    }

    if (filter.isPinned !== undefined) {
      conditions.push(eq(workflowVersion.isPinned, filter.isPinned))
    }

    if (filter.isLocked !== undefined) {
      conditions.push(eq(workflowVersion.isLocked, filter.isLocked))
    }

    if (filter.dateFrom) {
      conditions.push(gte(workflowVersion.createdAt, filter.dateFrom))
    }

    if (filter.dateTo) {
      conditions.push(lte(workflowVersion.createdAt, filter.dateTo))
    }

    if (filter.createdBy) {
      conditions.push(eq(workflowVersion.createdBy, filter.createdBy))
    }

    if (filter.searchQuery) {
      conditions.push(
        or(
          like(workflowVersion.name, `%${filter.searchQuery}%`),
          like(workflowVersion.description, `%${filter.searchQuery}%`),
          like(workflowVersion.releaseNotes, `%${filter.searchQuery}%`)
        )
      )
    }

    if (filter.semanticVersionPrefix) {
      conditions.push(like(workflowVersion.semanticVersion, `${filter.semanticVersionPrefix}%`))
    }

    const whereClause = and(...conditions)

    const versions = await db
      .select()
      .from(workflowVersion)
      .where(whereClause)
      .orderBy(desc(workflowVersion.versionNumber))
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(workflowVersion)
      .where(whereClause)

    // Filter by tags (done in memory since JSON array filtering varies by DB)
    let filteredVersions = versions
    if (filter.tags && filter.tags.length > 0) {
      filteredVersions = versions.filter((v: WorkflowVersionRow) => {
        const versionTags = (v.tags as string[]) || []
        return filter.tags!.some((tag) => versionTags.includes(tag))
      })
    }

    // Transform to ensure proper types
    const transformedVersions = filteredVersions.map((v: WorkflowVersionRow) => ({
      ...v,
      tags: (v.tags as string[]) || [],
      isPinned: v.isPinned ?? false,
      isLocked: v.isLocked ?? false,
      majorVersion: v.majorVersion ?? 0,
      minorVersion: v.minorVersion ?? 0,
      patchVersion: v.patchVersion ?? 0,
      metadata: (v.metadata as Record<string, any>) || {},
    })) as WorkflowVersionData[]

    return {
      versions: transformedVersions,
      total: filter.tags ? transformedVersions.length : Number(count),
    }
  } catch (error) {
    logger.error('Failed to get filtered versions', { workflowId, filter, error })
    throw error
  }
}

/**
 * Gets a specific version
 */
export async function getVersion(
  workflowId: string,
  versionNumber: number
): Promise<WorkflowVersionData | null> {
  try {
    const [version] = await db
      .select()
      .from(workflowVersion)
      .where(
        and(
          eq(workflowVersion.workflowId, workflowId),
          eq(workflowVersion.versionNumber, versionNumber)
        )
      )
      .limit(1)

    return (version as WorkflowVersionData) || null
  } catch (error) {
    logger.error('Failed to get version', { workflowId, versionNumber, error })
    throw error
  }
}

/**
 * Restores a workflow to a previous version
 */
export async function restoreVersion(
  workflowId: string,
  versionNumber: number,
  userId?: string
): Promise<WorkflowVersionData> {
  try {
    // Get the version to restore
    const version = await getVersion(workflowId, versionNumber)
    if (!version) {
      throw new Error(`Version ${versionNumber} not found for workflow ${workflowId}`)
    }

    // Update workflow with the restored state
    await db
      .update(workflow)
      .set({
        state: version.state,
        lastSynced: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflow.id, workflowId))

    // Create a new version recording the restore
    const newVersion = await createVersion({
      workflowId,
      userId,
      changeType: 'restore',
      name: `Restored from v${versionNumber}`,
      description: `Restored workflow state from version ${versionNumber}`,
    })

    logger.info(`Restored workflow ${workflowId} to version ${versionNumber}`, {
      newVersionNumber: newVersion.versionNumber,
    })

    return newVersion
  } catch (error) {
    logger.error('Failed to restore version', { workflowId, versionNumber, error })
    throw error
  }
}

/**
 * Compares two versions and returns the diff
 */
export async function compareVersions(
  workflowId: string,
  fromVersion: number,
  toVersion: number
): Promise<{
  diff: any
  summary: string
  fromVersionData: WorkflowVersionData
  toVersionData: WorkflowVersionData
}> {
  try {
    // Check cache first
    const [cachedDiff] = await db
      .select()
      .from(workflowVersionDiff)
      .where(
        and(
          eq(workflowVersionDiff.workflowId, workflowId),
          eq(workflowVersionDiff.fromVersion, fromVersion),
          eq(workflowVersionDiff.toVersion, toVersion)
        )
      )
      .limit(1)

    // Get both versions
    const [fromVersionData, toVersionData] = await Promise.all([
      getVersion(workflowId, fromVersion),
      getVersion(workflowId, toVersion),
    ])

    if (!fromVersionData || !toVersionData) {
      throw new Error('One or both versions not found')
    }

    if (cachedDiff) {
      return {
        diff: cachedDiff.diff,
        summary: cachedDiff.diffSummary || '',
        fromVersionData,
        toVersionData,
      }
    }

    // Compute diff
    const diff = computeWorkflowDiff(fromVersionData.state, toVersionData.state)
    const summary = generateDiffSummary(diff)

    // Cache the diff
    await db.insert(workflowVersionDiff).values({
      id: uuidv4(),
      workflowId,
      fromVersion,
      toVersion,
      diff,
      diffSummary: summary,
      createdAt: new Date(),
    })

    return {
      diff,
      summary,
      fromVersionData,
      toVersionData,
    }
  } catch (error) {
    logger.error('Failed to compare versions', { workflowId, fromVersion, toVersion, error })
    throw error
  }
}

/**
 * Gets the latest version number for a workflow
 */
export async function getLatestVersionNumber(workflowId: string): Promise<number> {
  const [latest] = await db
    .select({ versionNumber: workflowVersion.versionNumber })
    .from(workflowVersion)
    .where(eq(workflowVersion.workflowId, workflowId))
    .orderBy(desc(workflowVersion.versionNumber))
    .limit(1)

  return latest?.versionNumber ?? 0
}

/**
 * Deletes old versions keeping only the most recent N versions
 * Does not delete pinned or locked versions
 */
export async function pruneVersions(workflowId: string, keepCount: number = 50): Promise<number> {
  try {
    const versions = await db
      .select({
        id: workflowVersion.id,
        versionNumber: workflowVersion.versionNumber,
        isPinned: workflowVersion.isPinned,
        isLocked: workflowVersion.isLocked,
      })
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.versionNumber))

    if (versions.length <= keepCount) {
      return 0
    }

    const versionsToDelete = versions
      .slice(keepCount)
      .filter((v: WorkflowVersionRow) => !v.isPinned && !v.isLocked)
    const idsToDelete = versionsToDelete.map((v: WorkflowVersionRow) => v.id)

    // Delete in batches
    for (const id of idsToDelete) {
      await db.delete(workflowVersion).where(eq(workflowVersion.id, id))
    }

    logger.info(`Pruned ${idsToDelete.length} old versions for workflow ${workflowId}`)
    return idsToDelete.length
  } catch (error) {
    logger.error('Failed to prune versions', { workflowId, error })
    throw error
  }
}

/**
 * Updates a version's metadata (tags, notes, pin, lock)
 */
export async function updateVersion(
  versionId: string,
  updates: {
    name?: string
    description?: string
    tags?: string[]
    isPinned?: boolean
    isLocked?: boolean
    releaseNotes?: string
    metadata?: Record<string, any>
  }
): Promise<WorkflowVersionData> {
  try {
    const [existing] = await db
      .select()
      .from(workflowVersion)
      .where(eq(workflowVersion.id, versionId))
      .limit(1)

    if (!existing) {
      throw new Error(`Version ${versionId} not found`)
    }

    if (existing.isLocked && updates.isLocked !== false) {
      throw new Error('Cannot modify a locked version')
    }

    const updateData: any = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.isPinned !== undefined) updateData.isPinned = updates.isPinned
    if (updates.isLocked !== undefined) updateData.isLocked = updates.isLocked
    if (updates.releaseNotes !== undefined) updateData.releaseNotes = updates.releaseNotes
    if (updates.metadata !== undefined) {
      updateData.metadata = {
        ...((existing.metadata as Record<string, any>) || {}),
        ...updates.metadata,
      }
    }

    if (Object.keys(updateData).length === 0) {
      return existing as WorkflowVersionData
    }

    await db.update(workflowVersion).set(updateData).where(eq(workflowVersion.id, versionId))

    logger.info(`Updated version ${versionId}`, { updates })

    return {
      ...existing,
      ...updateData,
      tags: updateData.tags ?? ((existing.tags as string[]) || []),
      isPinned: updateData.isPinned ?? existing.isPinned ?? false,
      isLocked: updateData.isLocked ?? existing.isLocked ?? false,
      majorVersion: existing.majorVersion ?? 0,
      minorVersion: existing.minorVersion ?? 0,
      patchVersion: existing.patchVersion ?? 0,
      metadata: updateData.metadata ?? ((existing.metadata as Record<string, any>) || {}),
    } as WorkflowVersionData
  } catch (error) {
    logger.error('Failed to update version', { versionId, updates, error })
    throw error
  }
}

/**
 * Toggles the pinned status of a version
 */
export async function toggleVersionPin(versionId: string, isPinned: boolean): Promise<void> {
  try {
    const [existing] = await db
      .select({ isLocked: workflowVersion.isLocked })
      .from(workflowVersion)
      .where(eq(workflowVersion.id, versionId))
      .limit(1)

    if (!existing) {
      throw new Error(`Version ${versionId} not found`)
    }

    await db.update(workflowVersion).set({ isPinned }).where(eq(workflowVersion.id, versionId))

    logger.info(`${isPinned ? 'Pinned' : 'Unpinned'} version ${versionId}`)
  } catch (error) {
    logger.error('Failed to toggle version pin', { versionId, isPinned, error })
    throw error
  }
}

/**
 * Toggles the locked status of a version
 */
export async function toggleVersionLock(versionId: string, isLocked: boolean): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: workflowVersion.id })
      .from(workflowVersion)
      .where(eq(workflowVersion.id, versionId))
      .limit(1)

    if (!existing) {
      throw new Error(`Version ${versionId} not found`)
    }

    await db.update(workflowVersion).set({ isLocked }).where(eq(workflowVersion.id, versionId))

    logger.info(`${isLocked ? 'Locked' : 'Unlocked'} version ${versionId}`)
  } catch (error) {
    logger.error('Failed to toggle version lock', { versionId, isLocked, error })
    throw error
  }
}

/**
 * Adds tags to a version
 */
export async function addVersionTags(versionId: string, newTags: string[]): Promise<string[]> {
  try {
    const [existing] = await db
      .select({ tags: workflowVersion.tags, isLocked: workflowVersion.isLocked })
      .from(workflowVersion)
      .where(eq(workflowVersion.id, versionId))
      .limit(1)

    if (!existing) {
      throw new Error(`Version ${versionId} not found`)
    }

    if (existing.isLocked) {
      throw new Error('Cannot modify a locked version')
    }

    const currentTags = (existing.tags as string[]) || []
    const uniqueTags = [...new Set([...currentTags, ...newTags])]

    await db
      .update(workflowVersion)
      .set({ tags: uniqueTags })
      .where(eq(workflowVersion.id, versionId))

    logger.info(`Added tags to version ${versionId}`, { newTags, resultTags: uniqueTags })

    return uniqueTags
  } catch (error) {
    logger.error('Failed to add version tags', { versionId, newTags, error })
    throw error
  }
}

/**
 * Removes tags from a version
 */
export async function removeVersionTags(
  versionId: string,
  tagsToRemove: string[]
): Promise<string[]> {
  try {
    const [existing] = await db
      .select({ tags: workflowVersion.tags, isLocked: workflowVersion.isLocked })
      .from(workflowVersion)
      .where(eq(workflowVersion.id, versionId))
      .limit(1)

    if (!existing) {
      throw new Error(`Version ${versionId} not found`)
    }

    if (existing.isLocked) {
      throw new Error('Cannot modify a locked version')
    }

    const currentTags = (existing.tags as string[]) || []
    const remainingTags = currentTags.filter((tag) => !tagsToRemove.includes(tag))

    await db
      .update(workflowVersion)
      .set({ tags: remainingTags })
      .where(eq(workflowVersion.id, versionId))

    logger.info(`Removed tags from version ${versionId}`, {
      tagsToRemove,
      resultTags: remainingTags,
    })

    return remainingTags
  } catch (error) {
    logger.error('Failed to remove version tags', { versionId, tagsToRemove, error })
    throw error
  }
}

/**
 * Exports a version for external storage or sharing
 */
export async function exportVersion(
  workflowId: string,
  versionNumber: number
): Promise<VersionExportData> {
  try {
    const version = await getVersion(workflowId, versionNumber)

    if (!version) {
      throw new Error(`Version ${versionNumber} not found for workflow ${workflowId}`)
    }

    const { state, ...versionMetadata } = version

    return {
      version: versionMetadata,
      state,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
    }
  } catch (error) {
    logger.error('Failed to export version', { workflowId, versionNumber, error })
    throw error
  }
}

/**
 * Imports a previously exported version
 */
export async function importVersion(
  workflowId: string,
  data: VersionExportData,
  userId?: string
): Promise<WorkflowVersionData> {
  try {
    // Validate export format
    if (!data.version || !data.state || !data.exportVersion) {
      throw new Error('Invalid export data format')
    }

    // Get latest version number
    const [latestVersion] = await db
      .select({ versionNumber: workflowVersion.versionNumber })
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.versionNumber))
      .limit(1)

    const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

    // Get next semantic version
    const semVer = await getNextSemanticVersion(workflowId, 'patch')
    const semanticVersion = formatSemanticVersion(semVer)

    const versionId = uuidv4()
    const now = new Date()

    await db.insert(workflowVersion).values({
      id: versionId,
      workflowId,
      versionNumber: newVersionNumber,
      state: data.state,
      name: `Imported: ${data.version.name || `Version ${data.version.versionNumber}`}`,
      description: data.version.description,
      changeType: 'restore',
      changeSummary: null,
      createdBy: userId || null,
      createdAt: now,
      gitCommitSha: null,
      gitBranch: null,
      gitSyncedAt: null,
      semanticVersion,
      majorVersion: semVer.major,
      minorVersion: semVer.minor,
      patchVersion: semVer.patch,
      tags: data.version.tags || [],
      isPinned: false,
      isLocked: false,
      releaseNotes: data.version.releaseNotes,
      metadata: {
        importedFrom: data.version.id,
        importedAt: now.toISOString(),
        originalVersion: data.version.versionNumber,
        originalSemanticVersion: data.version.semanticVersion,
      },
    })

    logger.info(`Imported version as ${newVersionNumber} for workflow ${workflowId}`, {
      originalVersion: data.version.versionNumber,
    })

    return {
      id: versionId,
      workflowId,
      versionNumber: newVersionNumber,
      state: data.state,
      name: `Imported: ${data.version.name || `Version ${data.version.versionNumber}`}`,
      description: data.version.description,
      changeType: 'restore',
      changeSummary: null,
      createdBy: userId || null,
      createdAt: now,
      gitCommitSha: null,
      gitBranch: null,
      gitSyncedAt: null,
      semanticVersion,
      majorVersion: semVer.major,
      minorVersion: semVer.minor,
      patchVersion: semVer.patch,
      tags: data.version.tags || [],
      isPinned: false,
      isLocked: false,
      releaseNotes: data.version.releaseNotes,
      metadata: {
        importedFrom: data.version.id,
        importedAt: now.toISOString(),
        originalVersion: data.version.versionNumber,
        originalSemanticVersion: data.version.semanticVersion,
      },
    }
  } catch (error) {
    logger.error('Failed to import version', { workflowId, error })
    throw error
  }
}

/**
 * Gets timeline data for a workflow (simplified version entries for timeline view)
 */
export async function getVersionTimeline(
  workflowId: string,
  options: { limit?: number } = {}
): Promise<VersionTimelineEntry[]> {
  const { limit = 100 } = options

  try {
    const versions = await db
      .select({
        id: workflowVersion.id,
        versionNumber: workflowVersion.versionNumber,
        semanticVersion: workflowVersion.semanticVersion,
        changeType: workflowVersion.changeType,
        name: workflowVersion.name,
        createdAt: workflowVersion.createdAt,
        isPinned: workflowVersion.isPinned,
        isLocked: workflowVersion.isLocked,
        tags: workflowVersion.tags,
        changeSummary: workflowVersion.changeSummary,
      })
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.createdAt))
      .limit(limit)

    return versions.map((v: (typeof versions)[number]) => ({
      ...v,
      tags: (v.tags as string[]) || [],
      isPinned: v.isPinned ?? false,
      isLocked: v.isLocked ?? false,
    })) as VersionTimelineEntry[]
  } catch (error) {
    logger.error('Failed to get version timeline', { workflowId, error })
    throw error
  }
}

/**
 * Gets a version by its ID (not version number)
 */
export async function getVersionById(versionId: string): Promise<WorkflowVersionData | null> {
  try {
    const [version] = await db
      .select()
      .from(workflowVersion)
      .where(eq(workflowVersion.id, versionId))
      .limit(1)

    if (!version) return null

    return {
      ...version,
      tags: (version.tags as string[]) || [],
      isPinned: version.isPinned ?? false,
      isLocked: version.isLocked ?? false,
      majorVersion: version.majorVersion ?? 0,
      minorVersion: version.minorVersion ?? 0,
      patchVersion: version.patchVersion ?? 0,
      metadata: (version.metadata as Record<string, any>) || {},
    } as WorkflowVersionData
  } catch (error) {
    logger.error('Failed to get version by id', { versionId, error })
    throw error
  }
}

/**
 * Gets pinned versions for a workflow
 */
export async function getPinnedVersions(workflowId: string): Promise<WorkflowVersionData[]> {
  try {
    const versions = await db
      .select()
      .from(workflowVersion)
      .where(and(eq(workflowVersion.workflowId, workflowId), eq(workflowVersion.isPinned, true)))
      .orderBy(desc(workflowVersion.versionNumber))

    return versions.map((v: WorkflowVersionRow) => ({
      ...v,
      tags: (v.tags as string[]) || [],
      isPinned: true,
      isLocked: v.isLocked ?? false,
      majorVersion: v.majorVersion ?? 0,
      minorVersion: v.minorVersion ?? 0,
      patchVersion: v.patchVersion ?? 0,
      metadata: (v.metadata as Record<string, any>) || {},
    })) as WorkflowVersionData[]
  } catch (error) {
    logger.error('Failed to get pinned versions', { workflowId, error })
    throw error
  }
}

/**
 * Gets versions by tag
 */
export async function getVersionsByTag(
  workflowId: string,
  tag: string
): Promise<WorkflowVersionData[]> {
  try {
    const versions = await db
      .select()
      .from(workflowVersion)
      .where(eq(workflowVersion.workflowId, workflowId))
      .orderBy(desc(workflowVersion.versionNumber))

    // Filter by tag in memory (JSON array filtering varies by DB)
    const filteredVersions = versions.filter((v: WorkflowVersionRow) => {
      const tags = (v.tags as string[]) || []
      return tags.includes(tag)
    })

    return filteredVersions.map((v: WorkflowVersionRow) => ({
      ...v,
      tags: (v.tags as string[]) || [],
      isPinned: v.isPinned ?? false,
      isLocked: v.isLocked ?? false,
      majorVersion: v.majorVersion ?? 0,
      minorVersion: v.minorVersion ?? 0,
      patchVersion: v.patchVersion ?? 0,
      metadata: (v.metadata as Record<string, any>) || {},
    })) as WorkflowVersionData[]
  } catch (error) {
    logger.error('Failed to get versions by tag', { workflowId, tag, error })
    throw error
  }
}
