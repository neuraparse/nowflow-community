import { createLogger } from '@/lib/logs/console-logger'
import type { ChannelConfig, InboundMessage } from './types'

const logger = createLogger('MessageRouter')

/**
 * Result of routing an inbound message to a workflow.
 */
export interface RouteResult {
  matched: boolean
  workflowId?: string
  trigger?: string
  params?: Record<string, string>
}

/**
 * A routing rule that maps message patterns to workflows.
 */
export interface RoutingRule {
  /** Unique identifier for this rule */
  id: string
  /** Pattern to match against message text. Supports exact match, prefix match with '*', and regex with '/pattern/' */
  pattern: string
  /** The workflow to trigger when the pattern matches */
  workflowId: string
  /** Optional priority (higher = checked first, default 0) */
  priority?: number
  /** Whether this rule is currently active */
  enabled?: boolean
}

// In-memory rule storage keyed by channelId
const channelRules = new Map<string, RoutingRule[]>()

/**
 * Register routing rules for a channel.
 * Rules are sorted by priority (highest first) for evaluation order.
 */
export function registerRules(channelId: string, rules: RoutingRule[]): void {
  const activeRules = rules
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  channelRules.set(channelId, activeRules)

  logger.debug('Routing rules registered', {
    channelId,
    ruleCount: activeRules.length,
  })
}

/**
 * Remove all routing rules for a channel.
 */
export function unregisterRules(channelId: string): void {
  channelRules.delete(channelId)
  logger.debug('Routing rules unregistered', { channelId })
}

/**
 * Route an inbound message to the appropriate workflow.
 *
 * Evaluation order:
 * 1. Check channel-specific routing rules (pattern matching)
 * 2. Check if the channel has a default triggerWorkflowId in its settings
 * 3. Return unmatched result for fallback handling
 *
 * Pattern matching supports:
 * - Exact match: "hello" matches "hello"
 * - Command match: "/start" matches messages starting with "/start"
 * - Wildcard prefix: "order*" matches "order123", "order status", etc.
 * - Regex: "/^hello\\s+world$/i" matches with regex
 */
export function routeMessage(message: InboundMessage, channelConfig: ChannelConfig): RouteResult {
  const text = message.text.trim()

  // 1. Check channel-specific routing rules
  const rules = channelRules.get(message.channelId) ?? []

  for (const rule of rules) {
    const matchResult = matchPattern(text, rule.pattern)
    if (matchResult.matched) {
      logger.debug('Message matched routing rule', {
        channelId: message.channelId,
        ruleId: rule.id,
        pattern: rule.pattern,
        workflowId: rule.workflowId,
      })

      return {
        matched: true,
        workflowId: rule.workflowId,
        trigger: rule.pattern,
        params: matchResult.params,
      }
    }
  }

  // 2. Check channel default workflow
  if (channelConfig.settings.triggerWorkflowId) {
    logger.debug('Message routed to channel default workflow', {
      channelId: message.channelId,
      workflowId: channelConfig.settings.triggerWorkflowId,
    })

    return {
      matched: true,
      workflowId: channelConfig.settings.triggerWorkflowId,
      trigger: 'default',
    }
  }

  // 3. No match found
  logger.debug('No routing match for message', {
    channelId: message.channelId,
    messageId: message.id,
    textPreview: text.substring(0, 50),
  })

  return { matched: false }
}

/**
 * Match message text against a pattern.
 *
 * Supports:
 * - Exact match (case-insensitive): "hello" matches "Hello"
 * - Command prefix: "/start" matches "/start some args"
 * - Wildcard suffix: "order*" matches anything starting with "order"
 * - Regex: "/pattern/flags" for full regex matching
 */
function matchPattern(
  text: string,
  pattern: string
): { matched: boolean; params?: Record<string, string> } {
  // Regex pattern: /pattern/flags
  if (pattern.startsWith('/') && !pattern.startsWith('//')) {
    const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/)
    if (regexMatch) {
      try {
        const regex = new RegExp(regexMatch[1], regexMatch[2])
        const result = regex.exec(text)
        if (result) {
          // Extract named groups if any
          const params: Record<string, string> = {}
          if (result.groups) {
            Object.assign(params, result.groups)
          }
          return { matched: true, params: Object.keys(params).length > 0 ? params : undefined }
        }
        return { matched: false }
      } catch (error) {
        logger.warn('Invalid regex pattern in routing rule', { pattern, error })
        return { matched: false }
      }
    }
  }

  // Command prefix match: "/command" matches "/command" and "/command args"
  if (pattern.startsWith('/')) {
    const lowerText = text.toLowerCase()
    const lowerPattern = pattern.toLowerCase()

    if (lowerText === lowerPattern || lowerText.startsWith(lowerPattern + ' ')) {
      const args = text.substring(pattern.length).trim()
      return {
        matched: true,
        params: args ? { args } : undefined,
      }
    }
    return { matched: false }
  }

  // Wildcard suffix match: "order*" matches "order123"
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1).toLowerCase()
    if (text.toLowerCase().startsWith(prefix)) {
      const remainder = text.substring(prefix.length)
      return {
        matched: true,
        params: remainder ? { match: remainder } : undefined,
      }
    }
    return { matched: false }
  }

  // Exact match (case-insensitive)
  if (text.toLowerCase() === pattern.toLowerCase()) {
    return { matched: true }
  }

  return { matched: false }
}

/**
 * Get the current routing rules for a channel.
 * Useful for debugging and admin interfaces.
 */
export function getChannelRules(channelId: string): RoutingRule[] {
  return channelRules.get(channelId) ?? []
}
