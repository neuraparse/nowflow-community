import type { CSSProperties } from 'react'

export type LiveCanvasShape = 'starter' | 'agent' | 'condition' | 'tool' | 'process'

export const hexToRgba = (hex: string, a: number) => {
  const n = hex.replace('#', '')
  return `rgba(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(
    n.slice(4, 6),
    16
  )}, ${a})`
}

export const getLiveCanvasShapeStyles = (shape: LiveCanvasShape): CSSProperties => {
  void shape

  return {
    borderRadius: '8px',
  }
}

export const getLiveCanvasGlassAppearance = (isDark: boolean) => ({
  glassFallback: isDark ? '#18181b' : '#ffffff',
  glassSurface: isDark ? '#18181b' : '#ffffff',
  glassOverlay: 'transparent',
  glassInsetShadow: isDark
    ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
    : 'inset 0 0 0 1px rgba(24,24,27,0.08)',
  handleBorder: isDark ? 'rgba(24,24,27,0.96)' : 'rgba(255,255,255,0.96)',
})
