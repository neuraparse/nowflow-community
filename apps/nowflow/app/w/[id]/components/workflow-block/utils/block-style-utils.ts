import {
  BlockAnimation,
  BlockBorderColor,
  BlockBorderStyle,
  BlockStyle,
} from '@/stores/workflows/block-style/types'

/**
 * Get CSS class for border color - Professional Design System
 */
export function getBorderColorClass(color: BlockBorderColor): string {
  switch (color) {
    case 'blue':
      return 'border-blue-500 shadow-blue-500/20'
    case 'indigo':
      return 'border-indigo-500 shadow-indigo-500/20'
    case 'purple':
      return 'border-purple-500 shadow-purple-500/20'
    case 'green':
      return 'border-green-500 shadow-green-500/20'
    case 'emerald':
      return 'border-emerald-500 shadow-emerald-500/20'
    case 'teal':
      return 'border-teal-500 shadow-teal-500/20'
    case 'cyan':
      return 'border-cyan-500 shadow-cyan-500/20'
    case 'orange':
      return 'border-orange-500 shadow-orange-500/20'
    case 'amber':
      return 'border-amber-500 shadow-amber-500/20'
    case 'red':
      return 'border-red-500 shadow-red-500/20'
    case 'rose':
      return 'border-rose-500 shadow-rose-500/20'
    case 'pink':
      return 'border-pink-500 shadow-pink-500/20'
    case 'yellow':
      return 'border-yellow-500 shadow-yellow-500/20'
    case 'slate':
      return 'border-slate-500 shadow-slate-500/20'
    case 'gray':
      return 'border-gray-500 shadow-gray-500/20'
    case 'default':
    default:
      return 'border-border'
  }
}

/**
 * Get CSS class for border style
 */
export function getBorderStyleClass(style: BlockBorderStyle): string {
  switch (style) {
    case 'dashed':
      return 'border-dashed'
    case 'dotted':
      return 'border-dotted'
    case 'double':
      return 'border-double'
    case 'solid':
    default:
      return 'border-solid'
  }
}

/**
 * Get CSS class for border width
 */
export function getBorderWidthClass(width: number): string {
  switch (width) {
    case 0:
      return 'border-0'
    case 2:
      return 'border-2'
    case 3:
      return 'border-3'
    case 4:
      return 'border-4'
    case 5:
      return 'border-5'
    case 1:
    default:
      return 'border'
  }
}

/**
 * Get CSS class for animation - Professional & Contextual
 */
export function getAnimationClass(animation: BlockAnimation): string {
  switch (animation) {
    case 'pulse':
      return 'animate-pulse'
    case 'glow':
      return 'animate-glow'
    case 'bounce':
      return 'animate-bounce'
    case 'float':
      return 'animate-float'
    case 'spin':
      return 'animate-spin'
    case 'ping':
      return 'animate-ping'
    case 'fade':
      return 'animate-fade-in-out'
    case 'none':
    default:
      return ''
  }
}

/**
 * Get CSS class for highlight effect
 */
export function getHighlightClass(isHighlighted: boolean): string {
  return isHighlighted ? 'ring-2 ring-offset-2 ring-yellow-400' : ''
}

/**
 * Get all CSS classes for a block style
 */
export function getBlockStyleClasses(style: BlockStyle): string {
  const classes = [
    getBorderColorClass(style.borderColor),
    getBorderStyleClass(style.borderStyle),
    getBorderWidthClass(style.borderWidth),
    getAnimationClass(style.animation),
    getHighlightClass(style.isHighlighted),
  ]

  return classes.filter(Boolean).join(' ')
}
