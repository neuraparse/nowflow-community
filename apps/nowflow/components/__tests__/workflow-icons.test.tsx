/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import {
  DEFAULT_WORKFLOW_ICON,
  getWorkflowIconById,
  getWorkflowIconsByCategory,
  suggestWorkflowIcon,
  WORKFLOW_ICONS,
} from '@/components/workflow-icons'

describe('workflow-icons: registry', () => {
  it('has a non-empty list of icons', () => {
    expect(WORKFLOW_ICONS.length).toBeGreaterThan(0)
  })

  it('every entry has id, name, icon, color, category', () => {
    for (const entry of WORKFLOW_ICONS) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
      expect(typeof entry.name).toBe('string')
      expect(typeof entry.category).toBe('string')
      expect(entry.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(entry.icon).toBeTruthy()
    }
  })

  it('has unique ids', () => {
    const ids = WORKFLOW_ICONS.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('exposes a default workflow icon from the list', () => {
    expect(WORKFLOW_ICONS).toContain(DEFAULT_WORKFLOW_ICON)
    expect(DEFAULT_WORKFLOW_ICON.id).toBe('workflow')
  })
})

describe('workflow-icons: getWorkflowIconById', () => {
  it('returns a known icon by id', () => {
    const icon = getWorkflowIconById('bot')
    expect(icon.id).toBe('bot')
    expect(icon.name).toBe('Bot')
  })

  it('returns the default icon when id does not exist', () => {
    const icon = getWorkflowIconById('does-not-exist')
    expect(icon).toBe(DEFAULT_WORKFLOW_ICON)
  })
})

describe('workflow-icons: getWorkflowIconsByCategory', () => {
  it('groups icons under their category key', () => {
    const categories = getWorkflowIconsByCategory()
    expect(Object.keys(categories).length).toBeGreaterThan(0)
    for (const [category, icons] of Object.entries(categories)) {
      expect(icons.length).toBeGreaterThan(0)
      for (const icon of icons) {
        expect(icon.category).toBe(category)
      }
    }
  })

  it('every icon in the registry ends up in exactly one category group', () => {
    const categories = getWorkflowIconsByCategory()
    const flattened = Object.values(categories).flat()
    expect(flattened).toHaveLength(WORKFLOW_ICONS.length)
  })
})

describe('workflow-icons: suggestWorkflowIcon', () => {
  it.each([
    // Communication branches are checked first so short tokens like "ai" don't hijack them
    ['Send email notification', 'mail'],
    ['Email digest', 'mail'],
    ['Chat handler', 'message'],
    ['Team onboarding', 'users'],

    // AI/automation — standalone token matching
    ['AI assistant workflow', 'bot'],
    ['chatgpt bot', 'bot'],
    ['Thinking pipeline', 'brain'],
    ['Auto-generate report', 'sparkles'],

    // Development
    ['Python script deployment', 'code'],
    ['DB sync', 'database'],
    ['Service integration', 'layers'],

    // Media
    ['Resize photo', 'image'],
    ['Movie processing', 'video'],
    ['Document upload', 'file'],

    // Analytics
    ['Chart analytics', 'chart'],
    ['Lookup records', 'search'],

    // Business
    ['Payment flow', 'credit'],
    ['Schedule meeting', 'calendar'],
  ])('matches "%s" to the %s icon', (workflowName, expectedId) => {
    expect(suggestWorkflowIcon(workflowName).id).toBe(expectedId)
  })

  it('falls back to the default icon when nothing matches', () => {
    expect(suggestWorkflowIcon('random words with no known keywords')).toBe(DEFAULT_WORKFLOW_ICON)
  })

  it('is case-insensitive', () => {
    expect(suggestWorkflowIcon('AI ASSISTANT').id).toBe('bot')
    expect(suggestWorkflowIcon('Chat').id).toBe('message')
  })

  it('does not mis-match embedded substrings', () => {
    // "email" contains the letters "ai" — regression guard against the old
    // naive includes() that matched the AI branch first.
    expect(suggestWorkflowIcon('Email blast').id).toBe('mail')
    // "brain" contains "ai" but should hit the brain bucket, not the bot bucket
    expect(suggestWorkflowIcon('Brain dump').id).toBe('brain')
  })
})

describe('workflow-icons: icon component rendering', () => {
  it('renders each registered icon component without crashing', () => {
    for (const entry of WORKFLOW_ICONS) {
      const { container, unmount } = render(
        React.createElement(entry.icon, {
          'data-testid': `icon-${entry.id}`,
        } as React.SVGProps<SVGSVGElement> & { 'data-testid': string })
      )
      expect(container.querySelector('svg')).not.toBeNull()
      unmount()
    }
  })

  it('forwards props to the icon component', () => {
    const icon = getWorkflowIconById('bot')
    const { container } = render(
      React.createElement(icon.icon, {
        className: 'custom-icon',
        'aria-label': 'bot icon',
      })
    )
    const svg = container.querySelector('svg')!
    expect(svg).toHaveClass('custom-icon')
    expect(svg.getAttribute('aria-label')).toBe('bot icon')
  })
})
