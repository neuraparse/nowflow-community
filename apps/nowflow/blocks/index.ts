import { eq } from 'drizzle-orm'
import { CrateIcon } from '@/components/icons'
// ============================================================================
// SKILL-TO-BLOCK INTEGRATION
// ============================================================================

import { db } from '@/db'
import { skill } from '@/db/schema'
import {
  filterBlocks,
  getAllBlocks,
  getAllBlockTypes,
  getAllEnrichedBlocks,
  getBlock,
  getBlocksByCapability,
  getBlocksByCategory,
  getBlocksByIndustryCategory,
  // New enhanced functions
  getBlocksByPrimaryCategory,
  getEnrichedBlock,
  getSuggestedBlocks,
  isValidBlockType,
  registry,
  searchBlocks,
} from './registry'
import type { BlockCategory, BlockConfig, SubBlockConfig, SubBlockType } from './types'

// Export category system
export { categoryEngine } from './category-engine'
export type { EnrichedBlockMetadata } from './category-engine'
export {
  PRIMARY_CATEGORIES,
  INDUSTRY_CATEGORIES,
  CAPABILITY_TAGS,
  CATEGORY_METADATA,
} from './categories'
export type {
  PrimaryCategory,
  IndustryCategory,
  CapabilityTag,
  CategoryMetadata,
} from './categories'

// Export original functions (backward compatible)
export { registry, getBlock, getBlocksByCategory, getAllBlockTypes, isValidBlockType, getAllBlocks }

// Export new enhanced functions
export {
  getBlocksByPrimaryCategory,
  getBlocksByIndustryCategory,
  getBlocksByCapability,
  searchBlocks,
  getEnrichedBlock,
  getAllEnrichedBlocks,
  getSuggestedBlocks,
  filterBlocks,
}

// Skill-to-block integration functions (getSkillBlocks, getAllBlocksWithSkills,
// invalidateSkillBlocksCache) are exported directly below via their declarations.

export type { BlockConfig, BlockCategory, SubBlockConfig, SubBlockType } from './types'

// Cache for skill-based blocks (per-user)
let skillBlocksCache: BlockConfig[] | null = null
let skillBlocksCacheUserId: string | null = null
let skillBlocksCacheTime = 0
const SKILL_CACHE_TTL = 60000 // 1 minute

/**
 * Map a skill input type to a SubBlock input type
 */
function mapSkillInputType(inputType: string): SubBlockType {
  switch (inputType) {
    case 'string':
      return 'short-input'
    case 'number':
      return 'slider'
    case 'boolean':
      return 'switch'
    case 'json':
    case 'array':
      return 'code'
    case 'file':
      return 'file-upload'
    default:
      return 'long-input'
  }
}

/**
 * Map a skill category to a BlockCategory
 */
function mapSkillCategory(category: string): BlockCategory {
  switch (category) {
    case 'ai':
    case 'automation':
      return 'tools'
    case 'data':
    case 'storage':
    case 'analytics':
      return 'data'
    case 'communication':
    case 'social':
    case 'crm':
    case 'marketing':
      return 'integrations'
    default:
      return 'tools'
  }
}

/**
 * Convert a database skill row into a BlockConfig suitable for the registry
 */
function convertSkillToBlock(s: {
  id: string
  name: string
  description: string | null
  category: string
  manifest: any
  tags: string[]
}): BlockConfig {
  const manifest = (s.manifest || {}) as Record<string, any>
  const inputs = Array.isArray(manifest.inputs) ? manifest.inputs : []

  const subBlocks: SubBlockConfig[] = inputs.map(
    (input: {
      name: string
      type?: string
      description?: string
      required?: boolean
      default?: any
    }) => ({
      id: input.name,
      title: input.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      type: mapSkillInputType(input.type || 'string'),
      layout: 'full' as const,
      placeholder: input.description || '',
      connectionDroppable: true,
    })
  )

  const inputConfigs: Record<
    string,
    { type: 'string' | 'number' | 'boolean' | 'json'; required: boolean; description?: string }
  > = {}
  for (const input of inputs) {
    const paramType = (
      input.type === 'number'
        ? 'number'
        : input.type === 'boolean'
          ? 'boolean'
          : input.type === 'json' || input.type === 'array'
            ? 'json'
            : 'string'
    ) as 'string' | 'number' | 'boolean' | 'json'
    inputConfigs[input.name] = {
      type: paramType,
      required: input.required ?? false,
      description: input.description,
    }
  }

  return {
    type: `skill_${s.id}`,
    name: s.name || 'Unnamed Skill',
    description: s.description || '',
    category: mapSkillCategory(s.category),
    bgColor: '#7C3AED', // Purple accent for skill-based blocks
    icon: CrateIcon,
    subBlocks,
    tools: {
      access: [`skill_execute_${s.id}`],
      config: {
        tool: () => `skill_execute_${s.id}`,
      },
    },
    inputs: inputConfigs,
    outputs: {
      response: {
        type: 'json',
      },
    },
  }
}

/**
 * Fetch installed skills for a user and return them as BlockConfig entries.
 * Results are cached for SKILL_CACHE_TTL ms per userId.
 */
export async function getSkillBlocks(userId: string): Promise<BlockConfig[]> {
  // Return cached if fresh and same user
  if (
    skillBlocksCache &&
    skillBlocksCacheUserId === userId &&
    Date.now() - skillBlocksCacheTime < SKILL_CACHE_TTL
  ) {
    return skillBlocksCache
  }

  try {
    const skills = await db.select().from(skill).where(eq(skill.userId, userId))
    const result: BlockConfig[] = skills
      .filter((s: typeof skill.$inferSelect) => s.enabled)
      .map((s: typeof skill.$inferSelect) => convertSkillToBlock(s))
    skillBlocksCache = result
    skillBlocksCacheUserId = userId
    skillBlocksCacheTime = Date.now()
    return result
  } catch {
    return []
  }
}

/**
 * Get all blocks merged with user's installed skill blocks.
 * Combines the static registry blocks with dynamically loaded skill blocks.
 */
export async function getAllBlocksWithSkills(userId: string): Promise<BlockConfig[]> {
  const [staticBlocks, skillBlocks] = await Promise.all([
    Promise.resolve(getAllBlocks()),
    getSkillBlocks(userId),
  ])
  return [...staticBlocks, ...skillBlocks]
}

/**
 * Invalidate the skill blocks cache (call after install/uninstall/toggle).
 */
export function invalidateSkillBlocksCache(): void {
  skillBlocksCache = null
  skillBlocksCacheUserId = null
  skillBlocksCacheTime = 0
}
