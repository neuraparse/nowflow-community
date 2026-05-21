import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflowVersionTag } from '@/db/schema'

const logger = createLogger('VersionTagService')

export interface VersionTag {
  id: string
  workflowId: string
  name: string
  slug: string
  color: string
  description: string | null
  createdBy: string | null
  createdAt: Date
}

export interface CreateTagInput {
  name: string
  color?: string
  description?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
  description?: string
}

/**
 * Default tags available for all workflows
 */
export const DEFAULT_TAGS: { name: string; slug: string; color: string; description: string }[] = [
  {
    name: 'Stable',
    slug: 'stable',
    color: '#22C55E',
    description: 'Stable and tested version',
  },
  {
    name: 'Production',
    slug: 'production',
    color: '#8B5CF6',
    description: 'Currently deployed to production',
  },
  {
    name: 'Archived',
    slug: 'archived',
    color: '#6B7280',
    description: 'Archived version, no longer active',
  },
  {
    name: 'Draft',
    slug: 'draft',
    color: '#F59E0B',
    description: 'Work in progress',
  },
  {
    name: 'Reviewed',
    slug: 'reviewed',
    color: '#3B82F6',
    description: 'Reviewed and approved',
  },
]

/**
 * Gets default tags that can be used on any workflow
 */
export function getDefaultTags(): typeof DEFAULT_TAGS {
  return DEFAULT_TAGS
}

/**
 * Creates a URL-safe slug from a name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Gets all custom tags for a workflow
 */
export async function getWorkflowTags(workflowId: string): Promise<VersionTag[]> {
  try {
    const tags = await db
      .select()
      .from(workflowVersionTag)
      .where(eq(workflowVersionTag.workflowId, workflowId))
      .orderBy(workflowVersionTag.name)

    return tags as VersionTag[]
  } catch (error) {
    logger.error('Failed to get workflow tags', { workflowId, error })
    throw error
  }
}

/**
 * Gets all available tags for a workflow (default + custom)
 */
export async function getAllAvailableTags(workflowId: string): Promise<{
  defaultTags: typeof DEFAULT_TAGS
  customTags: VersionTag[]
}> {
  const customTags = await getWorkflowTags(workflowId)
  return {
    defaultTags: DEFAULT_TAGS,
    customTags,
  }
}

/**
 * Creates a new custom tag for a workflow
 */
export async function createWorkflowTag(
  workflowId: string,
  input: CreateTagInput,
  userId?: string
): Promise<VersionTag> {
  try {
    const slug = createSlug(input.name)

    // Check if tag with same slug already exists
    const [existing] = await db
      .select()
      .from(workflowVersionTag)
      .where(and(eq(workflowVersionTag.workflowId, workflowId), eq(workflowVersionTag.slug, slug)))
      .limit(1)

    if (existing) {
      throw new Error(`Tag with name "${input.name}" already exists`)
    }

    const id = uuidv4()
    const now = new Date()

    await db.insert(workflowVersionTag).values({
      id,
      workflowId,
      name: input.name,
      slug,
      color: input.color || '#3B82F6',
      description: input.description || null,
      createdBy: userId || null,
      createdAt: now,
    })

    logger.info(`Created tag "${input.name}" for workflow ${workflowId}`)

    return {
      id,
      workflowId,
      name: input.name,
      slug,
      color: input.color || '#3B82F6',
      description: input.description || null,
      createdBy: userId || null,
      createdAt: now,
    }
  } catch (error) {
    logger.error('Failed to create workflow tag', { workflowId, input, error })
    throw error
  }
}

/**
 * Updates an existing custom tag
 */
export async function updateWorkflowTag(
  tagId: string,
  updates: UpdateTagInput
): Promise<VersionTag> {
  try {
    const [existing] = await db
      .select()
      .from(workflowVersionTag)
      .where(eq(workflowVersionTag.id, tagId))
      .limit(1)

    if (!existing) {
      throw new Error(`Tag ${tagId} not found`)
    }

    const updateData: any = {}

    if (updates.name !== undefined) {
      updateData.name = updates.name
      updateData.slug = createSlug(updates.name)
    }

    if (updates.color !== undefined) {
      updateData.color = updates.color
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description
    }

    if (Object.keys(updateData).length === 0) {
      return existing as VersionTag
    }

    await db.update(workflowVersionTag).set(updateData).where(eq(workflowVersionTag.id, tagId))

    logger.info(`Updated tag ${tagId}`)

    return {
      ...existing,
      ...updateData,
    } as VersionTag
  } catch (error) {
    logger.error('Failed to update workflow tag', { tagId, updates, error })
    throw error
  }
}

/**
 * Deletes a custom tag
 */
export async function deleteWorkflowTag(tagId: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(workflowVersionTag)
      .where(eq(workflowVersionTag.id, tagId))
      .limit(1)

    if (!existing) {
      throw new Error(`Tag ${tagId} not found`)
    }

    await db.delete(workflowVersionTag).where(eq(workflowVersionTag.id, tagId))

    logger.info(`Deleted tag ${tagId}`)
  } catch (error) {
    logger.error('Failed to delete workflow tag', { tagId, error })
    throw error
  }
}

/**
 * Validates if given tags are valid for a workflow
 * Returns array of invalid tag names if any
 */
export async function validateTags(
  workflowId: string,
  tagNames: string[]
): Promise<{ valid: boolean; invalidTags: string[] }> {
  const { defaultTags, customTags } = await getAllAvailableTags(workflowId)

  const validTagNames = new Set([
    ...defaultTags.map((t) => t.name.toLowerCase()),
    ...customTags.map((t) => t.name.toLowerCase()),
  ])

  const invalidTags = tagNames.filter((tag) => !validTagNames.has(tag.toLowerCase()))

  return {
    valid: invalidTags.length === 0,
    invalidTags,
  }
}
