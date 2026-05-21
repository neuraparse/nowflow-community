import { describe, expect, it } from 'vitest'
import { workflowEditorTheme, type WorkflowEditorThemeClass } from '@/lib/workflow-editor-theme'

describe('workflowEditorTheme', () => {
  it('exposes the expected object shape with string class values', () => {
    expect(workflowEditorTheme).toBeTypeOf('object')
    expect(workflowEditorTheme).not.toBeNull()

    for (const [key, value] of Object.entries(workflowEditorTheme)) {
      expect(typeof key).toBe('string')
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('contains core root-level class keys', () => {
    expect(workflowEditorTheme.root).toBe('workflow-editor-theme')
    expect(workflowEditorTheme.stage).toBe('workflow-editor-stage')
    expect(workflowEditorTheme.shell).toBe('workflow-editor-shell')
    expect(workflowEditorTheme.panelBody).toBe('workflow-editor-panel-body')
  })

  it('contains the expected tab active modifier', () => {
    expect(workflowEditorTheme.tabActive).toBe('is-active')
  })

  it('namespaces every other entry with "workflow-editor-" prefix', () => {
    const exceptions = new Set(['tabActive'])
    for (const [key, value] of Object.entries(workflowEditorTheme)) {
      if (exceptions.has(key)) continue
      expect(value.startsWith('workflow-editor-')).toBe(true)
    }
  })

  it('produces unique class values', () => {
    const values = Object.values(workflowEditorTheme)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('includes the canonical set of button variant classes', () => {
    expect(workflowEditorTheme.buttonBase).toBe('workflow-editor-button-base')
    expect(workflowEditorTheme.buttonDefault).toBe('workflow-editor-button-variant-default')
    expect(workflowEditorTheme.buttonSecondary).toBe('workflow-editor-button-variant-secondary')
    expect(workflowEditorTheme.buttonOutline).toBe('workflow-editor-button-variant-outline')
    expect(workflowEditorTheme.buttonGhost).toBe('workflow-editor-button-variant-ghost')
    expect(workflowEditorTheme.buttonLink).toBe('workflow-editor-button-variant-link')
    expect(workflowEditorTheme.buttonDestructive).toBe('workflow-editor-button-variant-destructive')
  })

  it('includes the canonical callout variants', () => {
    expect(workflowEditorTheme.calloutInfo).toBe('workflow-editor-callout--info')
    expect(workflowEditorTheme.calloutWarning).toBe('workflow-editor-callout--warning')
    expect(workflowEditorTheme.calloutError).toBe('workflow-editor-callout--error')
    expect(workflowEditorTheme.calloutSuccess).toBe('workflow-editor-callout--success')
  })

  it('type WorkflowEditorThemeClass accepts any value from the object', () => {
    // Pure compile-time assertion; we only check it runs.
    const v: WorkflowEditorThemeClass = workflowEditorTheme.root
    expect(v).toBe('workflow-editor-theme')
  })
})
