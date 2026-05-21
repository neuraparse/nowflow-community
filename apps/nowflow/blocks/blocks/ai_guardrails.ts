import { ShieldAlert } from 'lucide-react'
import { parseNumericString } from '../helpers'
import { BlockConfig } from '../types'

export const AIGuardrailsBlock: BlockConfig = {
  type: 'ai_guardrails',
  name: 'AI Guardrails',
  description: 'Apply safety guardrails to AI inputs and outputs',
  longDescription:
    'Validate and filter AI model inputs and outputs with configurable guardrails. Supports content filtering, PII protection, topic restrictions, output format enforcement, token limits, and custom regex rules.',
  category: 'blocks',
  isUtility: true,
  bgColor: '#7C3AED',
  icon: ShieldAlert as any,
  subBlocks: [
    {
      id: 'input',
      title: 'Text to Validate',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter text or reference a variable to validate against guardrails...',
    },
    {
      id: 'direction',
      title: 'Direction',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Input (before AI)', id: 'input' },
        { label: 'Output (after AI)', id: 'output' },
      ],
    },
    {
      id: 'severity',
      title: 'Default Severity',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Block', id: 'block' },
        { label: 'Warn', id: 'warn' },
        { label: 'Log Only', id: 'log' },
      ],
    },
    {
      id: 'guardrailTypes',
      title: 'Guardrail Types',
      type: 'checkbox-list',
      layout: 'full',
      options: [
        { label: 'Content Filter', id: 'content_filter' },
        { label: 'PII Protection', id: 'pii_protection' },
        { label: 'Topic Restriction', id: 'topic_restriction' },
        { label: 'Output Format', id: 'output_format' },
        { label: 'Token Limit', id: 'token_limit' },
        { label: 'Hallucination Check', id: 'hallucination_check' },
        { label: 'Custom Regex', id: 'custom_regex' },
      ],
    },
    {
      id: 'maxTokens',
      title: 'Max Tokens (optional)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., 4096',
    },
    {
      id: 'blockedTopics',
      title: 'Blocked Topics (comma-separated)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., politics, religion',
    },
    {
      id: 'customPatterns',
      title: 'Custom Regex Patterns (one per line)',
      type: 'long-input',
      layout: 'full',
      placeholder: 'e.g., \\bforbidden-word\\b',
    },
  ],
  tools: {
    access: ['ai_guardrails_validate'],
    config: {
      tool: () => 'ai_guardrails_validate',
      params: (params) => ({
        input: params.input,
        direction: params.direction || 'input',
        severity: params.severity || 'block',
        guardrailTypes: params.guardrailTypes || ['content_filter', 'pii_protection'],
        maxTokens: parseNumericString(params.maxTokens),
        blockedTopics: params.blockedTopics
          ? params.blockedTopics.split(',').map((t: string) => t.trim())
          : [],
        customPatterns: params.customPatterns
          ? params.customPatterns.split('\n').filter((p: string) => p.trim())
          : [],
      }),
    },
  },
  inputs: {
    input: { type: 'string', required: true },
    direction: { type: 'string', required: false },
    severity: { type: 'string', required: false },
    guardrailTypes: { type: 'json', required: false },
    maxTokens: { type: 'string', required: false },
    blockedTopics: { type: 'string', required: false },
    customPatterns: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        passed: 'boolean',
        filteredText: 'string',
        violations: 'json',
        warnings: 'json',
        metadata: 'json',
      } as any,
    },
  },
}
