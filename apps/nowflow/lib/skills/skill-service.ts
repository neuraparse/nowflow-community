import { createLogger } from '@/lib/logs/console-logger'
import { parseSkillMd } from './skill-parser'
import type {
  InstalledSkill,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillManifest,
  SkillSearchResult,
  SkillSource,
} from './types'

const logger = createLogger('SkillService')

/**
 * Skill Service
 * Manages installation, configuration, and execution of skills
 */
export class SkillService {
  private installedSkills = new Map<string, InstalledSkill>()

  /**
   * Install a skill from a source
   */
  async install(
    source: SkillSource,
    userId: string,
    workspaceId?: string
  ): Promise<InstalledSkill> {
    logger.info('Installing skill', { source, userId })

    let content: string

    switch (source.type) {
      case 'url':
        if (!source.url) throw new Error('URL is required for URL source')
        content = await this.fetchSkillContent(source.url)
        break
      case 'github':
        if (!source.repository) throw new Error('Repository is required for GitHub source')
        content = await this.fetchFromGitHub(source.repository, source.branch, source.path)
        break
      case 'local':
        throw new Error('Local skills should be loaded via loadLocal()')
      case 'marketplace':
        if (!source.url) throw new Error('Marketplace URL is required')
        content = await this.fetchSkillContent(source.url)
        break
      default:
        throw new Error(`Unknown source type: ${source.type}`)
    }

    const manifest = parseSkillMd(content)
    const id = `skill_${manifest.name.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`

    const installed: InstalledSkill = {
      id,
      manifest,
      installedAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
      userId,
      workspaceId,
      configuration: {},
      source,
    }

    this.installedSkills.set(id, installed)
    logger.info('Skill installed successfully', { skillId: id, name: manifest.name })
    return installed
  }

  /**
   * Load a skill from a SKILL.md content string
   */
  loadFromContent(content: string, userId: string, workspaceId?: string): InstalledSkill {
    const manifest = parseSkillMd(content)
    const id = `skill_${manifest.name.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`

    const installed: InstalledSkill = {
      id,
      manifest,
      installedAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
      userId,
      workspaceId,
      configuration: {},
      source: { type: 'local' },
    }

    this.installedSkills.set(id, installed)
    return installed
  }

  /**
   * Uninstall a skill
   */
  uninstall(skillId: string): boolean {
    const skill = this.installedSkills.get(skillId)
    if (!skill) return false

    this.installedSkills.delete(skillId)
    logger.info('Skill uninstalled', { skillId, name: skill.manifest.name })
    return true
  }

  /**
   * Execute a skill action
   */
  async execute(context: SkillExecutionContext): Promise<SkillExecutionResult> {
    const startTime = Date.now()
    const skill = this.installedSkills.get(context.skillId)

    if (!skill) {
      return { success: false, outputs: {}, error: 'Skill not found', duration: 0 }
    }

    if (!skill.enabled) {
      return { success: false, outputs: {}, error: 'Skill is disabled', duration: 0 }
    }

    const action = skill.manifest.actions.find((a) => a.name === context.action)
    if (!action) {
      return {
        success: false,
        outputs: {},
        error: `Action '${context.action}' not found`,
        duration: 0,
      }
    }

    try {
      // Validate required inputs
      for (const input of skill.manifest.inputs) {
        if (input.required && !(input.name in context.inputs)) {
          return {
            success: false,
            outputs: {},
            error: `Missing required input: ${input.name}`,
            duration: Date.now() - startTime,
          }
        }
      }

      // Merge defaults
      const inputs = { ...context.inputs }
      for (const input of skill.manifest.inputs) {
        if (!(input.name in inputs) && input.default !== undefined) {
          inputs[input.name] = input.default
        }
      }

      // Execute handler
      const config = { ...skill.configuration, ...context.configuration }
      const logs: string[] = []

      // Create a sandboxed execution environment
      const result = await this.executeHandler(action.handler, inputs, config, logs)

      const duration = Date.now() - startTime
      logger.info('Skill action executed', {
        skillId: context.skillId,
        action: context.action,
        duration,
        success: true,
      })

      return { success: true, outputs: result || {}, duration, logs }
    } catch (error: any) {
      const duration = Date.now() - startTime
      logger.error('Skill execution failed', {
        skillId: context.skillId,
        action: context.action,
        error: error.message,
        duration,
      })

      return { success: false, outputs: {}, error: error.message, duration }
    }
  }

  /**
   * Get all installed skills for a user
   */
  getInstalledSkills(userId: string, workspaceId?: string): InstalledSkill[] {
    return Array.from(this.installedSkills.values()).filter((s) => {
      if (s.userId !== userId) return false
      if (workspaceId && s.workspaceId && s.workspaceId !== workspaceId) return false
      return true
    })
  }

  /**
   * Get a specific installed skill
   */
  getSkill(skillId: string): InstalledSkill | undefined {
    return this.installedSkills.get(skillId)
  }

  /**
   * Update skill configuration
   */
  updateConfiguration(skillId: string, configuration: Record<string, any>): boolean {
    const skill = this.installedSkills.get(skillId)
    if (!skill) return false

    skill.configuration = { ...skill.configuration, ...configuration }
    skill.updatedAt = new Date()
    return true
  }

  /**
   * Enable/disable a skill
   */
  setEnabled(skillId: string, enabled: boolean): boolean {
    const skill = this.installedSkills.get(skillId)
    if (!skill) return false

    skill.enabled = enabled
    skill.updatedAt = new Date()
    logger.info(`Skill ${enabled ? 'enabled' : 'disabled'}`, { skillId })
    return true
  }

  /**
   * Search marketplace for skills (stub for now)
   */
  async searchMarketplace(query: string, category?: string): Promise<SkillSearchResult[]> {
    // TODO: Implement marketplace API integration
    logger.info('Searching marketplace', { query, category })
    return []
  }

  /**
   * Convert a skill to a NowFlow block definition
   */
  toBlockDefinition(skill: InstalledSkill): Record<string, any> {
    const manifest = skill.manifest

    return {
      id: `skill_${manifest.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: manifest.name,
      description: manifest.description,
      category: manifest.category,
      icon: manifest.icon || 'Puzzle',
      tags: manifest.tags,
      subBlocks: manifest.inputs.map((input) => ({
        id: input.name,
        title: input.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        type:
          input.type === 'string'
            ? 'short-input'
            : input.type === 'number'
              ? 'slider'
              : input.type === 'boolean'
                ? 'switch'
                : 'long-input',
        placeholder: input.description,
        ...(input.default !== undefined ? { value: input.default } : {}),
      })),
      outputs: {
        response: { type: 'json', description: 'Skill execution result' },
      },
    }
  }

  // --- Private methods ---

  private async fetchSkillContent(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch skill: ${response.statusText}`)
    return response.text()
  }

  private async fetchFromGitHub(repo: string, branch?: string, path?: string): Promise<string> {
    const ref = branch || 'main'
    const filePath = path || 'SKILL.md'
    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${filePath}`
    return this.fetchSkillContent(url)
  }

  private async executeHandler(
    handler: string,
    inputs: Record<string, any>,
    config: Record<string, any>,
    logs: string[]
  ): Promise<Record<string, any>> {
    // Safe execution: create an async function from the handler string
    // In production, this should use a sandboxed environment (VM2, isolated-vm, etc.)
    try {
      const wrappedCode = `
        return (async function(inputs, config, log) {
          ${handler}
          // Try to call the first defined function
          const fnNames = Object.keys(this).filter(k => typeof this[k] === 'function')
          if (fnNames.length > 0) return this[fnNames[0]](inputs, config)
          return {}
        }).call({}, inputs, config, log)
      `
      const log = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`)
      const fn = new Function('inputs', 'config', 'log', wrappedCode)
      return await fn(inputs, config, log)
    } catch (error: any) {
      logger.error('Handler execution failed', { error: error.message })
      throw new Error(`Handler execution failed: ${error.message}`)
    }
  }
}

// Singleton
let serviceInstance: SkillService | null = null

export function getSkillService(): SkillService {
  if (!serviceInstance) {
    serviceInstance = new SkillService()
  }
  return serviceInstance
}
