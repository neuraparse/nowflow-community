import { buildPersonaSystemPrompt, ResolvedProfile } from './profile'

// ─── Smart Feature Composition System ──────────────────────────────────────────

/**
 * Represents which agent features are currently active.
 * Used by the composition engine to build a coherent system prompt.
 */
export interface ActiveFeatures {
  profile: ResolvedProfile | null
  systemPrompt: string | null // raw user-written system prompt (only when no profile)
  knowledge: boolean // knowledgeSources is non-empty
  memory: boolean // memory is enabled
  tools: boolean // has formatted tools
  responseFormat: boolean // responseFormat is defined
}

/**
 * Detects which features are active from inputs.
 */
export function detectActiveFeatures(
  inputs: Record<string, any>,
  resolvedProfile: ResolvedProfile | null,
  formattedTools: any[],
  responseFormat: any
): ActiveFeatures {
  return {
    profile: resolvedProfile,
    systemPrompt: resolvedProfile ? null : inputs.systemPrompt || null,
    knowledge: !!(
      inputs.knowledgeSources &&
      typeof inputs.knowledgeSources === 'string' &&
      inputs.knowledgeSources.trim().length > 0
    ),
    memory: !!(inputs.memoryEnabled || (inputs as any).effectiveMemoryEnabled),
    tools: formattedTools.length > 0,
    responseFormat: !!responseFormat,
  }
}

/**
 * Extracts behavioral hints from the profile for smart instruction tuning.
 */
export function getProfileTraits(profile: ResolvedProfile | null): {
  prefersBrevity: boolean
  isHumanLike: boolean
} {
  if (!profile) return { prefersBrevity: false, isHumanLike: false }

  const style = (profile.communicationStyle || '').toLowerCase()
  const personality = (profile.personality || '').toLowerCase()
  const combined = style + ' ' + personality

  return {
    prefersBrevity: /\b(concise|brief|short|terse|minimal|succinct|kısa|öz)\b/.test(combined),
    isHumanLike: profile.type === 'human_agent',
  }
}

/**
 * Builds a <capabilities> section listing all active features for the agent.
 */
export function buildCapabilitiesPreamble(
  features: ActiveFeatures,
  knowledgeContext: string | null
): string | null {
  const capabilities: string[] = []

  if (features.knowledge && knowledgeContext) {
    capabilities.push(
      '- You have access to a curated knowledge base. Relevant information from it is provided below in this prompt.'
    )
  }
  if (features.tools) {
    capabilities.push(
      '- You have specialized tools available for specific tasks. Use them when appropriate.'
    )
  }
  if (features.memory) {
    capabilities.push(
      '- You have memory of previous conversations with this user. Use conversation history to maintain continuity.'
    )
  }
  if (features.responseFormat) {
    capabilities.push('- You must respond in the specific structured JSON format provided.')
  }

  if (capabilities.length === 0) return null

  return `<capabilities>\n${capabilities.join('\n')}\n</capabilities>`
}

/**
 * Builds knowledge section with combination-aware instructions.
 */
export function buildKnowledgeSection(knowledgeContext: string, features: ActiveFeatures): string {
  let instruction: string

  instruction = `Use the following knowledge base to answer questions accurately. Cite sources when applicable.
Prioritize information from the knowledge base above your general knowledge.`

  return `<knowledge_base>
${instruction}

${knowledgeContext}
</knowledge_base>`
}

/**
 * Core composition engine: builds ONE coherent system prompt from all active features.
 * Replaces naive string concatenation with intelligent, combination-aware composition.
 *
 * Handles ALL combinations including edge cases:
 * - No profile, no systemPrompt → still works if context/tools exist
 * - Knowledge enabled but no results found → capabilities omits knowledge mention
 * - Profile + everything → full persona with all layers
 * - Only tools, nothing else → minimal capabilities section
 * - Only memory → no prompt changes (memory is injected as messages, not prompt)
 */
export function composeSystemPrompt(
  features: ActiveFeatures,
  knowledgeContext: string | null
): string {
  const sections: string[] = []

  // Layer 1 - Identity Foundation
  // Profile takes priority. If no profile, use raw systemPrompt. If neither, skip.
  if (features.profile) {
    const personaPrompt = buildPersonaSystemPrompt(features.profile)
    if (personaPrompt) sections.push(personaPrompt)
  } else if (features.systemPrompt) {
    sections.push(features.systemPrompt)
  }

  // Layer 2 - Capabilities Preamble
  // Pass knowledgeContext so we only announce knowledge if results were actually found
  const capabilitiesPreamble = buildCapabilitiesPreamble(features, knowledgeContext)
  if (capabilitiesPreamble) sections.push(capabilitiesPreamble)

  // Layer 3 - Knowledge Integration (only if we actually have search results)
  if (knowledgeContext) {
    sections.push(buildKnowledgeSection(knowledgeContext, features))
  }

  return sections.join('\n\n')
}
