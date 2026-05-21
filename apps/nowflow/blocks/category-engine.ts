/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * DYNAMIC CATEGORY ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 🎯 Purpose:
 * - Automatically categorize blocks based on rules
 * - Extract capabilities and tags dynamically
 * - Provide intelligent filtering and search
 * - Support workflow authoring with rich metadata
 * - Optimize performance with caching
 *
 * 🔄 Features:
 * - Rule-based auto-categorization
 * - Multi-category support
 * - Tag extraction from block config
 * - Fuzzy search capabilities
 * - Performance-optimized caching
 * - AI-friendly metadata generation
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  CAPABILITY_TAGS,
  CapabilityTag,
  CATEGORIZATION_RULES,
  CATEGORY_METADATA,
  IndustryCategory,
  PRIMARY_CATEGORIES,
  PrimaryCategory,
} from './categories'
import { BlockConfig } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichedBlockMetadata {
  // Original block config
  block: BlockConfig

  // Categorization
  primaryCategories: PrimaryCategory[]
  industryCategories: IndustryCategory[]
  allCategories: (PrimaryCategory | IndustryCategory)[]

  // Capabilities & Tags
  capabilityTags: CapabilityTag[]
  customTags: string[]

  // Search optimization
  searchKeywords: string[]
  searchScore: number

  // AI metadata
  aiDescription: string
  useCases: string[]
  integrationsWith: string[]

  // Compliance & Risk
  requiresCompliance: boolean
  riskLevel?: 'low' | 'medium' | 'high' | 'extreme'
  complianceTags: string[]

  // Performance hints
  isPopular: boolean
  recentlyUsed: boolean
  recommendationScore: number
}

export interface CategoryFilter {
  primaryCategories?: PrimaryCategory[]
  industryCategories?: IndustryCategory[]
  capabilityTags?: CapabilityTag[]
  searchQuery?: string
  excludeHidden?: boolean
  includeCompliance?: boolean
  riskLevels?: ('low' | 'medium' | 'high' | 'extreme')[]
}

// ============================================================================
// CATEGORY ENGINE CLASS
// ============================================================================

export class CategoryEngine {
  private metadataCache: Map<string, EnrichedBlockMetadata> = new Map()
  private categoryCache: Map<string, BlockConfig[]> = new Map()
  private searchIndex: Map<string, Set<string>> = new Map()

  /**
   * Enrich a block with comprehensive metadata
   */
  enrichBlock(block: BlockConfig): EnrichedBlockMetadata {
    // Check cache first
    const cached = this.metadataCache.get(block.type)
    if (cached && cached.block === block) {
      return cached
    }

    // Apply categorization rules
    const { categories, tags } = this.applyCategorizationRules(block)
    const primaryCategories = categories.filter((c) =>
      Object.values(PRIMARY_CATEGORIES).includes(c as PrimaryCategory)
    ) as PrimaryCategory[]
    const industryCategories = categories.filter(
      (c) => !Object.values(PRIMARY_CATEGORIES).includes(c as PrimaryCategory)
    ) as IndustryCategory[]

    // Extract capabilities
    const capabilityTags = this.extractCapabilityTags(block, tags)
    const customTags = this.extractCustomTags(block)

    // Generate search keywords
    const searchKeywords = this.generateSearchKeywords(block, categories, capabilityTags)

    // Generate AI metadata
    const aiDescription = this.generateAIDescription(block)
    const useCases = this.extractUseCases(block)
    const integrationsWith = this.detectIntegrations(block)

    // Compliance analysis
    const requiresCompliance = block.compliance?.enabled ?? false
    const riskLevel = block.compliance?.riskLevel
    const complianceTags = block.compliance?.tags ?? []

    // Build enriched metadata
    const metadata: EnrichedBlockMetadata = {
      block,
      primaryCategories,
      industryCategories,
      allCategories: categories,
      capabilityTags,
      customTags,
      searchKeywords,
      searchScore: 0,
      aiDescription,
      useCases,
      integrationsWith,
      requiresCompliance,
      riskLevel,
      complianceTags,
      isPopular: false,
      recentlyUsed: false,
      recommendationScore: 0,
    }

    // Cache it
    this.metadataCache.set(block.type, metadata)
    this.indexForSearch(block.type, searchKeywords)

    return metadata
  }

  /**
   * Apply categorization rules to a block
   */
  private applyCategorizationRules(block: BlockConfig): {
    categories: (PrimaryCategory | IndustryCategory)[]
    tags: CapabilityTag[]
  } {
    const categories = new Set<PrimaryCategory | IndustryCategory>()
    const tags = new Set<CapabilityTag>()

    // Apply all matching rules (sorted by priority)
    const sortedRules = [...CATEGORIZATION_RULES].sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      if (rule.match(block)) {
        rule.categories.forEach((cat) => categories.add(cat))
        rule.tags.forEach((tag) => tags.add(tag))
      }
    }

    // Fallback: use original category
    if (categories.size === 0) {
      if (block.category === 'agents') {
        categories.add(PRIMARY_CATEGORIES.AGENTS)
      } else if (block.category === 'tools') {
        categories.add(PRIMARY_CATEGORIES.INTEGRATIONS)
      } else if (block.category === 'data') {
        categories.add(PRIMARY_CATEGORIES.DATA_FILES)
      }
    }

    return {
      categories: Array.from(categories),
      tags: Array.from(tags),
    }
  }

  /**
   * Extract capability tags from block configuration
   */
  private extractCapabilityTags(block: BlockConfig, ruleTags: CapabilityTag[]): CapabilityTag[] {
    const tags = new Set<CapabilityTag>(ruleTags)

    // From tools.access
    if (block.tools?.access) {
      for (const tool of block.tools.access) {
        if (tool.includes('oauth')) tags.add(CAPABILITY_TAGS.OAUTH)
        if (tool.includes('api') || tool.includes('rest')) tags.add(CAPABILITY_TAGS.REST_API)
        if (tool.includes('graphql')) tags.add(CAPABILITY_TAGS.GRAPHQL)
        if (tool.includes('websocket')) tags.add(CAPABILITY_TAGS.WEBSOCKETS)
      }
    }

    // From subBlocks
    if (block.subBlocks) {
      const hasWebhook = block.subBlocks.some((sb) => sb.type === 'webhook-config')
      if (hasWebhook) tags.add(CAPABILITY_TAGS.WEBHOOKS)

      const hasSchedule = block.subBlocks.some((sb) => sb.type === 'schedule-config')
      if (hasSchedule) tags.add(CAPABILITY_TAGS.SCHEDULING)

      const hasCode = block.subBlocks.some((sb) => sb.type === 'code')
      if (hasCode) tags.add(CAPABILITY_TAGS.CODE_EXECUTION)

      const hasOAuth = block.subBlocks.some((sb) => sb.type === 'oauth-input')
      if (hasOAuth) tags.add(CAPABILITY_TAGS.OAUTH)
    }

    // From type
    if (block.type.includes('loop')) tags.add(CAPABILITY_TAGS.ITERATION)
    if (block.type.includes('condition') || block.type.includes('router')) {
      tags.add(CAPABILITY_TAGS.CONDITIONAL_LOGIC)
      tags.add(CAPABILITY_TAGS.ROUTING)
    }

    // From compliance
    if (block.compliance?.enabled) {
      if (block.compliance.tags?.includes('financial_trading')) {
        tags.add(CAPABILITY_TAGS.FINANCIAL_TRADING)
        tags.add(CAPABILITY_TAGS.REGULATED)
      }
      if (block.compliance.tags?.includes('high_risk')) {
        tags.add(CAPABILITY_TAGS.HIGH_RISK)
      }
      if (block.compliance.tags?.includes('kyc_required')) {
        tags.add(CAPABILITY_TAGS.KYC_REQUIRED)
      }
    }

    return Array.from(tags)
  }

  /**
   * Extract custom tags from block description and metadata
   */
  private extractCustomTags(block: BlockConfig): string[] {
    const tags: string[] = []

    // Extract from description
    const desc = (block.description + ' ' + (block.longDescription || '')).toLowerCase()

    // Common patterns
    const patterns = [
      { keyword: 'real-time', tag: 'real-time' },
      { keyword: 'automation', tag: 'automation' },
      { keyword: 'workflow', tag: 'workflow' },
      { keyword: 'integration', tag: 'integration' },
      { keyword: 'analytics', tag: 'analytics' },
      { keyword: 'reporting', tag: 'reporting' },
      { keyword: 'monitoring', tag: 'monitoring' },
      { keyword: 'notification', tag: 'notifications' },
      { keyword: 'scheduling', tag: 'scheduling' },
      { keyword: 'collaboration', tag: 'collaboration' },
    ]

    for (const pattern of patterns) {
      if (desc.includes(pattern.keyword)) {
        tags.push(pattern.tag)
      }
    }

    return tags
  }

  /**
   * Generate search keywords for a block
   */
  private generateSearchKeywords(
    block: BlockConfig,
    categories: (PrimaryCategory | IndustryCategory)[],
    tags: CapabilityTag[]
  ): string[] {
    const keywords = new Set<string>()

    // Add basic info
    keywords.add(block.type.toLowerCase())
    keywords.add(block.name.toLowerCase())

    // Add description words
    const descWords = (block.description + ' ' + (block.longDescription || ''))
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)

    descWords.forEach((w) => keywords.add(w))

    // Add category names
    categories.forEach((cat) => {
      const metadata = CATEGORY_METADATA[cat]
      if (metadata) {
        keywords.add(metadata.name.toLowerCase())
        keywords.add(metadata.id.toLowerCase())
      }
    })

    // Add tag names
    tags.forEach((tag) => keywords.add(tag.toLowerCase().replace(/_/g, ' ')))

    // Add provider/service name from OAuth
    const oauthBlock = block.subBlocks?.find((sb) => sb.type === 'oauth-input')
    if (oauthBlock?.provider) {
      keywords.add(oauthBlock.provider.toLowerCase())
    }

    return Array.from(keywords)
  }

  /**
   * Generate AI-friendly description
   */
  private generateAIDescription(block: BlockConfig): string {
    let description = block.description

    if (block.longDescription) {
      description += '. ' + block.longDescription
    }

    // Add capability hints
    if (block.compliance?.enabled) {
      description += ` [COMPLIANCE REQUIRED: ${block.compliance.disclaimer}]`
    }

    return description
  }

  /**
   * Extract use cases from examples
   */
  private extractUseCases(block: BlockConfig): string[] {
    const useCases: string[] = []

    if (block.examples) {
      useCases.push(...block.examples.map((ex) => ex.description || ex.title))
    }

    return useCases
  }

  /**
   * Detect what other blocks this integrates with
   */
  private detectIntegrations(block: BlockConfig): string[] {
    const integrations: string[] = []

    // Check tools.access for common integrations
    if (block.tools?.access) {
      integrations.push(...block.tools.access)
    }

    return integrations
  }

  /**
   * Index block for search
   */
  private indexForSearch(blockType: string, keywords: string[]): void {
    keywords.forEach((keyword) => {
      if (!this.searchIndex.has(keyword)) {
        this.searchIndex.set(keyword, new Set())
      }
      this.searchIndex.get(keyword)!.add(blockType)
    })
  }

  /**
   * Filter blocks by criteria
   */
  filterBlocks(blocks: BlockConfig[], filter: CategoryFilter): EnrichedBlockMetadata[] {
    const enriched = blocks.map((b) => this.enrichBlock(b))

    let filtered = enriched

    // Filter by primary categories
    if (filter.primaryCategories && filter.primaryCategories.length > 0) {
      filtered = filtered.filter((b) =>
        filter.primaryCategories!.some((cat) => b.primaryCategories.includes(cat))
      )
    }

    // Filter by industry categories
    if (filter.industryCategories && filter.industryCategories.length > 0) {
      filtered = filtered.filter((b) =>
        filter.industryCategories!.some((cat) => b.industryCategories.includes(cat))
      )
    }

    // Filter by capability tags
    if (filter.capabilityTags && filter.capabilityTags.length > 0) {
      filtered = filtered.filter((b) =>
        filter.capabilityTags!.some((tag) => b.capabilityTags.includes(tag))
      )
    }

    // Filter by search query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const query = filter.searchQuery.toLowerCase().trim()
      filtered = filtered.filter((b) => b.searchKeywords.some((keyword) => keyword.includes(query)))

      // Calculate search scores
      filtered = filtered.map((b) => ({
        ...b,
        searchScore: this.calculateSearchScore(b, query),
      }))

      // Sort by search score
      filtered.sort((a, b) => b.searchScore - a.searchScore)
    }

    // Filter by hidden
    if (filter.excludeHidden) {
      filtered = filtered.filter((b) => !b.block.hideFromToolbar)
    }

    // Filter by compliance
    if (filter.includeCompliance === false) {
      filtered = filtered.filter((b) => !b.requiresCompliance)
    }

    // Filter by risk level
    if (filter.riskLevels && filter.riskLevels.length > 0) {
      filtered = filtered.filter((b) => b.riskLevel && filter.riskLevels!.includes(b.riskLevel))
    }

    return filtered
  }

  /**
   * Calculate search relevance score
   */
  private calculateSearchScore(metadata: EnrichedBlockMetadata, query: string): number {
    let score = 0

    const lowerQuery = query.toLowerCase()

    // Exact name match: +100
    if (metadata.block.name.toLowerCase() === lowerQuery) score += 100

    // Name contains query: +50
    if (metadata.block.name.toLowerCase().includes(lowerQuery)) score += 50

    // Type matches: +40
    if (metadata.block.type.toLowerCase().includes(lowerQuery)) score += 40

    // Description contains: +20
    if (metadata.block.description.toLowerCase().includes(lowerQuery)) score += 20

    // Keywords contain: +10 per match
    score += metadata.searchKeywords.filter((k) => k.includes(lowerQuery)).length * 10

    // Tags contain: +15 per match
    score += metadata.capabilityTags.filter((t) => t.toLowerCase().includes(lowerQuery)).length * 15

    // Category name matches: +25
    score +=
      metadata.allCategories.filter((c) => {
        const catMeta = CATEGORY_METADATA[c]
        return catMeta && catMeta.name.toLowerCase().includes(lowerQuery)
      }).length * 25

    return score
  }

  /**
   * Get blocks by primary category
   */
  getBlocksByPrimaryCategory(
    blocks: BlockConfig[],
    category: PrimaryCategory
  ): EnrichedBlockMetadata[] {
    return this.filterBlocks(blocks, {
      primaryCategories: [category],
      excludeHidden: true,
    })
  }

  /**
   * Get blocks by industry category
   */
  getBlocksByIndustryCategory(
    blocks: BlockConfig[],
    category: IndustryCategory
  ): EnrichedBlockMetadata[] {
    return this.filterBlocks(blocks, {
      industryCategories: [category],
      excludeHidden: true,
    })
  }

  /**
   * Get blocks by capability tag
   */
  getBlocksByCapability(blocks: BlockConfig[], tag: CapabilityTag): EnrichedBlockMetadata[] {
    return this.filterBlocks(blocks, {
      capabilityTags: [tag],
      excludeHidden: true,
    })
  }

  /**
   * Search blocks with fuzzy matching
   */
  searchBlocks(blocks: BlockConfig[], query: string): EnrichedBlockMetadata[] {
    if (!query || !query.trim()) {
      return blocks.map((b) => this.enrichBlock(b))
    }

    return this.filterBlocks(blocks, {
      searchQuery: query,
      excludeHidden: true,
    })
  }

  /**
   * Get suggested blocks based on context
   */
  getSuggestedBlocks(
    blocks: BlockConfig[],
    context: {
      recentlyUsed?: string[]
      currentCategories?: (PrimaryCategory | IndustryCategory)[]
      currentTags?: CapabilityTag[]
    }
  ): EnrichedBlockMetadata[] {
    const enriched = blocks.map((b) => this.enrichBlock(b))

    // Calculate recommendation scores
    const scored = enriched.map((metadata) => {
      let score = 0

      // Recently used: +50
      if (context.recentlyUsed?.includes(metadata.block.type)) {
        score += 50
      }

      // Same category: +30
      if (context.currentCategories) {
        score +=
          metadata.allCategories.filter((c) => context.currentCategories!.includes(c)).length * 30
      }

      // Same tags: +20
      if (context.currentTags) {
        score += metadata.capabilityTags.filter((t) => context.currentTags!.includes(t)).length * 20
      }

      return {
        ...metadata,
        recommendationScore: score,
      }
    })

    // Sort by recommendation score
    return scored.sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, 10)
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.metadataCache.clear()
    this.categoryCache.clear()
    this.searchIndex.clear()
  }

  /**
   * Get category metadata
   */
  getCategoryMetadata(category: PrimaryCategory | IndustryCategory) {
    return CATEGORY_METADATA[category]
  }

  /**
   * Get all primary categories
   */
  getAllPrimaryCategories() {
    return Object.values(PRIMARY_CATEGORIES)
  }

  /**
   * Get all industry categories
   */
  getAllIndustryCategories() {
    return Object.keys(CATEGORY_METADATA).filter(
      (key) => !Object.values(PRIMARY_CATEGORIES).includes(key as PrimaryCategory)
    )
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const categoryEngine = new CategoryEngine()
