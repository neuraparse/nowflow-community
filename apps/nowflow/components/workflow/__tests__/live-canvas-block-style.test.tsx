/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  getLiveCanvasGlassAppearance,
  getLiveCanvasShapeStyles,
  hexToRgba,
  type LiveCanvasShape,
} from '@/components/workflow/live-canvas-block-style'

describe('live-canvas-block-style', () => {
  describe('hexToRgba', () => {
    it('converts a hex color with leading # to rgba', () => {
      expect(hexToRgba('#FF8040', 0.5)).toBe('rgba(255, 128, 64, 0.5)')
    })

    it('converts a hex color without a leading # to rgba', () => {
      expect(hexToRgba('000000', 1)).toBe('rgba(0, 0, 0, 1)')
    })

    it('preserves the provided alpha value', () => {
      expect(hexToRgba('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)')
      expect(hexToRgba('#FFFFFF', 0.25)).toBe('rgba(255, 255, 255, 0.25)')
    })
  })

  describe('getLiveCanvasShapeStyles', () => {
    const shapes: LiveCanvasShape[] = ['starter', 'agent', 'condition', 'tool', 'process']

    it.each(shapes)('returns the same restrained shape for %s blocks', (shape) => {
      const styles = getLiveCanvasShapeStyles(shape)
      expect(styles).toBeTruthy()
      expect(styles.borderRadius).toBe('8px')
      expect(styles.clipPath).toBeUndefined()
      expect(styles.WebkitClipPath).toBeUndefined()
    })

    it('does not add decorative padding for starter shape', () => {
      const styles = getLiveCanvasShapeStyles('starter')
      expect(styles.paddingRight).toBeUndefined()
    })

    it('does not add decorative padding for condition shape', () => {
      const styles = getLiveCanvasShapeStyles('condition')
      expect(styles.paddingLeft).toBeUndefined()
    })

    it('does not add padding for agent/tool/process shapes', () => {
      expect(getLiveCanvasShapeStyles('agent').paddingLeft).toBeUndefined()
      expect(getLiveCanvasShapeStyles('agent').paddingRight).toBeUndefined()
      expect(getLiveCanvasShapeStyles('tool').paddingLeft).toBeUndefined()
      expect(getLiveCanvasShapeStyles('process').paddingRight).toBeUndefined()
    })
  })

  describe('getLiveCanvasGlassAppearance', () => {
    it('returns the dark theme palette when isDark is true', () => {
      const appearance = getLiveCanvasGlassAppearance(true)
      expect(appearance.glassFallback).toBe('#18181b')
      expect(appearance.handleBorder).toBe('rgba(24,24,27,0.96)')
      expect(appearance.glassSurface).toBe('#18181b')
    })

    it('returns the light theme palette when isDark is false', () => {
      const appearance = getLiveCanvasGlassAppearance(false)
      expect(appearance.glassFallback).toBe('#ffffff')
      expect(appearance.handleBorder).toBe('rgba(255,255,255,0.96)')
      expect(appearance.glassSurface).toBe('#ffffff')
    })

    it('always returns every expected key', () => {
      const appearance = getLiveCanvasGlassAppearance(true)
      expect(Object.keys(appearance).sort()).toEqual(
        ['glassFallback', 'glassSurface', 'glassOverlay', 'glassInsetShadow', 'handleBorder'].sort()
      )
    })
  })
})
