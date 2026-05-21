import { createLogger } from '@/lib/logs/console-logger'
import type {
  SkillAction,
  SkillCategory,
  SkillConfigField,
  SkillInput,
  SkillManifest,
  SkillOutput,
  SkillRequirement,
  SkillTrigger,
} from './types'

const logger = createLogger('SkillParser')

/**
 * Parse a SKILL.md file into a SkillManifest
 *
 * SKILL.md format:
 * ---
 * name: My Skill
 * version: 1.0.0
 * description: What this skill does
 * author: Author Name
 * license: MIT
 * tags: [tag1, tag2]
 * category: automation
 * ---
 *
 * ## Requirements
 * - api_key: SERVICE_API_KEY - Your service API key
 *
 * ## Inputs
 * - query (string, required): The search query
 * - limit (number, optional, default: 10): Max results
 *
 * ## Outputs
 * - results (json): The search results
 * - count (number): Total result count
 *
 * ## Configuration
 * - baseUrl (string, required): API base URL
 * - timeout (number, optional, default: 30): Request timeout in seconds
 *
 * ## Actions
 * ### search
 * Search for items matching the query.
 * ```handler
 * async function search({ query, limit }, config) {
 *   const response = await fetch(`${config.baseUrl}/search?q=${query}&limit=${limit}`)
 *   const data = await response.json()
 *   return { results: data.items, count: data.total }
 * }
 * ```
 */
export function parseSkillMd(content: string): SkillManifest {
  const { frontmatter, body } = parseFrontmatter(content)

  const manifest: SkillManifest = {
    name: frontmatter.name || 'Unnamed Skill',
    version: frontmatter.version || '0.1.0',
    description: frontmatter.description || '',
    author: frontmatter.author || 'Unknown',
    authorUrl: frontmatter.authorUrl,
    license: frontmatter.license || 'MIT',
    tags: parseTags(frontmatter.tags),
    category: (frontmatter.category as SkillCategory) || 'custom',
    icon: frontmatter.icon,
    requirements: parseRequirements(body),
    inputs: parseInputs(body),
    outputs: parseOutputs(body),
    configuration: parseConfiguration(body),
    triggers: parseTriggers(body),
    actions: parseActions(body),
  }

  logger.debug('Parsed SKILL.md', { name: manifest.name, actions: manifest.actions.length })
  return manifest
}

function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter: Record<string, any> = {}
  const lines = match[1].split('\n')
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) {
      const [, key, value] = kv
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
      } else {
        frontmatter[key] = value.trim().replace(/^['"]|['"]$/g, '')
      }
    }
  }

  return { frontmatter, body: match[2] }
}

function parseTags(tags: any): string[] {
  if (Array.isArray(tags)) return tags
  if (typeof tags === 'string') return tags.split(',').map((s) => s.trim())
  return []
}

function parseRequirements(body: string): SkillRequirement[] {
  const section = extractSection(body, 'Requirements')
  if (!section) return []

  const requirements: SkillRequirement[] = []
  const lines = section.split('\n').filter((l) => l.trim().startsWith('-'))

  for (const line of lines) {
    const match = line.match(/^-\s*(\w+):\s*(\w+)\s*(?:-\s*(.+))?$/)
    if (match) {
      requirements.push({
        type: match[1] as SkillRequirement['type'],
        name: match[2],
        description: match[3] || '',
        optional: line.toLowerCase().includes('optional'),
      })
    }
  }

  return requirements
}

function parseInputs(body: string): SkillInput[] {
  const section = extractSection(body, 'Inputs')
  if (!section) return []

  const inputs: SkillInput[] = []
  const lines = section.split('\n').filter((l) => l.trim().startsWith('-'))

  for (const line of lines) {
    const match = line.match(
      /^-\s*(\w+)\s*\((\w+)(?:,\s*(required|optional))?(?:,\s*default:\s*(.+?))?\)(?::\s*(.+))?$/
    )
    if (match) {
      inputs.push({
        name: match[1],
        type: match[2] as SkillInput['type'],
        required: match[3] !== 'optional',
        default: match[4] ? parseValue(match[4].trim()) : undefined,
        description: match[5]?.trim() || '',
      })
    }
  }

  return inputs
}

function parseOutputs(body: string): SkillOutput[] {
  const section = extractSection(body, 'Outputs')
  if (!section) return []

  const outputs: SkillOutput[] = []
  const lines = section.split('\n').filter((l) => l.trim().startsWith('-'))

  for (const line of lines) {
    const match = line.match(/^-\s*(\w+)\s*\((\w+)\)(?::\s*(.+))?$/)
    if (match) {
      outputs.push({
        name: match[1],
        type: match[2] as SkillOutput['type'],
        description: match[3]?.trim() || '',
      })
    }
  }

  return outputs
}

function parseConfiguration(body: string): SkillConfigField[] {
  const section = extractSection(body, 'Configuration')
  if (!section) return []

  const fields: SkillConfigField[] = []
  const lines = section.split('\n').filter((l) => l.trim().startsWith('-'))

  for (const line of lines) {
    const match = line.match(
      /^-\s*(\w+)\s*\((\w+)(?:,\s*(required|optional))?(?:,\s*default:\s*(.+?))?\)(?::\s*(.+))?$/
    )
    if (match) {
      fields.push({
        name: match[1],
        type: match[2] as SkillConfigField['type'],
        required: match[3] !== 'optional',
        default: match[4] ? parseValue(match[4].trim()) : undefined,
        description: match[5]?.trim() || '',
      })
    }
  }

  return fields
}

function parseTriggers(body: string): SkillTrigger[] {
  const section = extractSection(body, 'Triggers')
  if (!section) return []

  const triggers: SkillTrigger[] = []
  const lines = section.split('\n').filter((l) => l.trim().startsWith('-'))

  for (const line of lines) {
    const match = line.match(/^-\s*(\w+):\s*(\w+)\s*(?:-\s*(.+))?$/)
    if (match) {
      triggers.push({
        type: match[1] as SkillTrigger['type'],
        name: match[2],
        description: match[3] || '',
      })
    }
  }

  return triggers
}

function parseActions(body: string): SkillAction[] {
  const section = extractSection(body, 'Actions')
  if (!section) return []

  const actions: SkillAction[] = []
  const actionBlocks = section.split(/^###\s+/m).filter(Boolean)

  for (const block of actionBlocks) {
    const lines = block.split('\n')
    const name = lines[0]?.trim()
    if (!name) continue

    const description =
      lines
        .slice(1)
        .find((l) => l.trim() && !l.trim().startsWith('```'))
        ?.trim() || ''

    // Extract handler code
    const handlerMatch = block.match(/```handler\n([\s\S]*?)```/)
    const handler = handlerMatch ? handlerMatch[1].trim() : ''

    actions.push({ name, description, handler })
  }

  return actions
}

function extractSection(body: string, heading: string): string | null {
  const regex = new RegExp(`^##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`, 'mi')
  const match = body.match(regex)
  return match ? match[1].trim() : null
}

function parseValue(value: string): any {
  if (value === 'true') return true
  if (value === 'false') return false
  if (!isNaN(Number(value))) return Number(value)
  return value.replace(/^['"]|['"]$/g, '')
}
