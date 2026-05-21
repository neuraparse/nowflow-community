import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('AgentBlockHandler')

/**
 * Resolve agent profile when agentProfileId is provided.
 * Uses the Zustand store (client-side, persisted in localStorage) for fast lookup,
 * falls back to API fetch if not found in store.
 */
export interface ResolvedProfile {
  type?: string | null // 'ai_agent' | 'human_agent' | 'hybrid'
  name?: string | null
  systemPrompt?: string | null
  personality?: string | null
  role?: string | null
  goal?: string | null
  communicationStyle?: string | null
  skills?: string[]
  constraints?: string[]
}

export async function resolveAgentProfileForBlock(
  agentProfileId: string | undefined
): Promise<ResolvedProfile | null> {
  if (!agentProfileId) return null

  const pick = (p: any): ResolvedProfile => ({
    type: p.type,
    name: p.name,
    systemPrompt: p.systemPrompt,
    personality: p.personality,
    role: p.role,
    goal: p.goal,
    communicationStyle: p.communicationStyle,
    skills: Array.isArray(p.skills) ? p.skills : [],
    constraints: Array.isArray(p.constraints) ? p.constraints : [],
  })

  try {
    // Try Zustand store first (already loaded & persisted in localStorage)
    const { useAgentProfilesStore } = await import('@/stores/agent-profiles/store')
    const storeProfile = useAgentProfilesStore.getState().profiles[agentProfileId]
    if (storeProfile) return pick(storeProfile)

    // Fallback: fetch from API
    const res = await fetch(`/api/agent-profiles/${agentProfileId}`)
    if (!res.ok) {
      logger.warn(`Agent profile not found via API: ${agentProfileId}`)
      return null
    }
    const profile = await res.json()
    return pick(profile)
  } catch (error) {
    logger.error('Failed to resolve agent profile', { agentProfileId, error })
    return null
  }
}

/**
 * Build a type-aware persona system prompt from a resolved agent profile.
 *
 * Prompt assembly notes:
 * - XML tags for unambiguous parsing
 * - Identity anchoring: "this is not a role, this is who you are" (reduces character breaking)
 * - Type-specific behavioral rules for human_agent profiles
 * - Immutable identity block placed first
 */
export function buildPersonaSystemPrompt(profile: ResolvedProfile): string {
  const {
    type,
    name,
    role,
    goal,
    personality,
    communicationStyle,
    skills,
    constraints,
    systemPrompt,
  } = profile
  const parts: string[] = []

  if (type === 'human_agent') {
    // Identity anchoring — establish "you ARE this person, not playing a role"
    const identityLines: string[] = []
    if (name)
      identityLines.push(`You are ${name}. This is not a role — this is genuinely who you are.`)
    if (role) identityLines.push(`You work as ${role}.`)
    if (goal) identityLines.push(`Your focus: ${goal}`)
    if (identityLines.length > 0) parts.push(`<identity>\n${identityLines.join('\n')}\n</identity>`)

    if (personality) parts.push(`<personality>\n${personality}\n</personality>`)

    if (communicationStyle)
      parts.push(`<voice>\nYour natural communication style: ${communicationStyle}\n</voice>`)

    if (skills && skills.length > 0) {
      parts.push(`<expertise>\nYour areas of expertise: ${skills.join(', ')}\n</expertise>`)
    }

    if (constraints && constraints.length > 0) {
      parts.push(`<rules>\n${constraints.map((c) => `- ${c}`).join('\n')}\n</rules>`)
    }

    // Anti-AI-telltale behavioral rules (Vapi/Botpress pattern for human-like agents)
    const nameRef = name ? name : 'this character'
    parts.push(`<behavioral_rules>
- Speak naturally, like a real human in conversation — it's fine to use "hmm", "good question", "let me think" type phrases
- Never say "Certainly!", "Of course!", "Absolutely!", "As an AI...", "As ${nameRef}, I..." — these are dead giveaways of artificial behavior
- Use contractions and natural language (I'm, don't, it's, let's, we'll)
- Have opinions — mild preferences, natural reactions, sometimes say you're not sure about something
- Avoid being overly structured or list-heavy; form natural sentences instead
- Show human reactions: surprise, curiosity, mild frustration — when appropriate
- Don't be robotically helpful; it's okay to push back gently or express a different perspective
</behavioral_rules>`)

    if (systemPrompt) parts.push(systemPrompt)
  } else if (type === 'ai_agent') {
    // Expert persona framing + identity lock
    const identityParts: string[] = []
    if (name && role) identityParts.push(`You are ${name}, a ${role}.`)
    else if (name) identityParts.push(`You are ${name}.`)
    else if (role) identityParts.push(`You are a ${role}.`)
    if (identityParts.length > 0) parts.push(`<identity>\n${identityParts.join(' ')}\n</identity>`)

    if (personality) parts.push(`<personality>\n${personality}\n</personality>`)

    if (goal) parts.push(`Your mission: ${goal}`)
    if (communicationStyle) parts.push(`Communication approach: ${communicationStyle}`)

    if (skills && skills.length > 0) {
      parts.push(`<expertise>\n${skills.map((s) => `- ${s}`).join('\n')}\n</expertise>`)
    }

    if (constraints && constraints.length > 0) {
      parts.push(`<rules>\n${constraints.map((c) => `- ${c}`).join('\n')}\n</rules>`)
    }

    parts.push(
      `<core_directive>\nMaintain this identity and perspective in every response.\n</core_directive>`
    )

    if (systemPrompt)
      parts.push(`<additional_instructions>\n${systemPrompt}\n</additional_instructions>`)
  } else if (type === 'hybrid') {
    // Mix of human warmth and professional expertise
    const identityLines: string[] = []
    if (name && role) identityLines.push(`You are ${name}, working as ${role}.`)
    else if (name) identityLines.push(`You are ${name}.`)
    else if (role) identityLines.push(`You work as ${role}.`)
    if (goal) identityLines.push(`Your focus: ${goal}`)
    if (identityLines.length > 0) parts.push(`<identity>\n${identityLines.join('\n')}\n</identity>`)

    if (personality) parts.push(`<personality>\n${personality}\n</personality>`)

    if (communicationStyle)
      parts.push(`<voice>\nYour communication style: ${communicationStyle}\n</voice>`)

    if (skills && skills.length > 0) {
      parts.push(`<expertise>\n${skills.map((s) => `- ${s}`).join('\n')}\n</expertise>`)
    }

    if (constraints && constraints.length > 0) {
      parts.push(`<rules>\n${constraints.map((c) => `- ${c}`).join('\n')}\n</rules>`)
    }

    parts.push(`Reflect both professional expertise and human warmth in every interaction.`)

    if (systemPrompt) parts.push(systemPrompt)
  } else {
    // Fallback: legacy flat structure for profiles without a type
    if (role) parts.push(`## Role\n${role}`)
    if (goal) parts.push(`## Goal\n${goal}`)
    if (personality) parts.push(`## Personality\n${personality}`)
    if (communicationStyle) parts.push(`## Communication Style\n${communicationStyle}`)
    if (skills && skills.length > 0)
      parts.push(`## Skills\n${skills.map((s) => `- ${s}`).join('\n')}`)
    if (constraints && constraints.length > 0)
      parts.push(`## Constraints\n${constraints.map((c) => `- ${c}`).join('\n')}`)
    if (systemPrompt && systemPrompt !== personality) parts.push(systemPrompt)
  }

  return parts.join('\n\n')
}
