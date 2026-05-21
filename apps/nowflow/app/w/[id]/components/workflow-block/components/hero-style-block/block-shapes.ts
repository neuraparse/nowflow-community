export interface BlockShapeDescriptor {
  clipPath?: string
  borderRadius: string
  paddingLeft: string
  paddingRight: string
  /**
   * How many px to shift the LEFT target handle rightward from the default −6 px.
   * Positive = move the handle inward so its center aligns with the shape's visual left edge.
   */
  handleLeft: number
  /**
   * How many px to shift the RIGHT source handle leftward from the default −6 px.
   * Positive = move the handle inward so its center aligns with the shape's visual right edge
   * at the midpoint (top: 50%).
   */
  handleRight: number
  /**
   * For shapes whose right visual edge is slanted (parallelogram):
   * how many px the right edge shifts inward per 1% of block height (going downward).
   * Used to compute per-handle right position in condition blocks.
   * 0 for non-slanted shapes.
   */
  rightSlantRate: number
  /**
   * Same for the left edge (currently unused but symmetric to rightSlantRate).
   */
  leftSlantRate: number
  /**
   * When true, a colored left accent bar is rendered via `inset 3px 0 0 bgColor` box-shadow.
   * Used for Tool blocks: no clip-path, just a visual "connection port" stripe.
   */
  hasLeftAccent?: boolean
}

/**
 * Returns the shape descriptor for a block based on its type / category.
 *
 * "Signal Odyssey" — every block type has a unique clip-path silhouette.
 *
 * Three narrative pairs create visual tension:
 *   Direction: Starter (→ arrow right)  vs  Condition (← arrow left)
 *   Hierarchy: Agent  (∧ top chamfers)  vs  Process  (∨ bottom chamfers)
 *   Role:      Tool   (notch = data port) vs Utility  (/ right taper = drone)
 *
 * All shapes start at x=0 on the left — inset accent bar (Tool) stays visible.
 * All shapes have flat vertical edges where handles attach (left/right at 50%).
 */
export function getBlockShape(
  type: string,
  category: string,
  isUtility: boolean
): BlockShapeDescriptor {
  // Utility — "Satellite Drone": right corners tapered, compact forward-lean
  // Flat left = connects to host. Tapered right = deployed outward.
  // Smaller chamfers (8px) than Agent/Process (10px) = smaller vessel class.
  if (isUtility) {
    return {
      clipPath:
        'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)',
      borderRadius: '0',
      paddingLeft: '12px',
      paddingRight: '18px',
      handleLeft: 0,
      handleRight: 0,
      rightSlantRate: 0,
      leftSlantRate: 0,
    }
  }

  // Starter — "Signal Beacon": rightward arrow, the origin of all signals
  // Flat left, pointed right. Pure launch direction.
  if (type === 'starter') {
    return {
      clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
      borderRadius: '0',
      paddingLeft: '14px',
      paddingRight: '24px',
      handleLeft: 0,
      handleRight: 2,
      rightSlantRate: 0,
      leftSlantRate: 0,
    }
  }

  // Agent — "Command Bridge": both top corners chamfered = elevated cockpit
  // Wide flat bottom = authority base. Reads as "looking forward from above."
  // OPPOSITE of Process (top vs bottom chamfers).
  if (category === 'agents') {
    return {
      clipPath: 'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
      borderRadius: '0',
      paddingLeft: '14px',
      paddingRight: '14px',
      handleLeft: 0,
      handleRight: 0,
      rightSlantRate: 0,
      leftSlantRate: 0,
    }
  }

  // Tool — "Data Port Module": right-side connector notch + left accent bar
  // The notch reads as "I plug into external systems." Unique 8-point polygon.
  if (category === 'tools') {
    return {
      clipPath:
        'polygon(0 0, 100% 0, 100% 10px, calc(100% - 4px) 10px, calc(100% - 4px) calc(100% - 10px), 100% calc(100% - 10px), 100% 100%, 0 100%)',
      borderRadius: '0',
      paddingLeft: '14px',
      paddingRight: '16px',
      handleLeft: 0,
      handleRight: 0,
      rightSlantRate: 0,
      leftSlantRate: 0,
      hasLeftAccent: true,
    }
  }

  // Condition / Router — "Signal Splitter": leftward arrow (mirror of Starter)
  // Signal converges into decision point (left tip), fans out through output ports (flat right).
  // rightSlantRate = 0: flat right edge, all output handles align uniformly.
  if (type === 'condition' || type === 'router') {
    return {
      clipPath: 'polygon(0 50%, 14px 0, 100% 0, 100% 100%, 14px 100%)',
      borderRadius: '0',
      paddingLeft: '24px',
      paddingRight: '14px',
      handleLeft: 2,
      handleRight: 0,
      rightSlantRate: 0,
      leftSlantRate: 0,
    }
  }

  // Process / Default — "Engine Core": both bottom corners chamfered = grounded base
  // Wide flat top = intake. Stable foundation. OPPOSITE of Agent.
  // Same 10px chamfer size as Agent = fleet cohesion.
  return {
    clipPath:
      'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px))',
    borderRadius: '0',
    paddingLeft: '14px',
    paddingRight: '14px',
    handleLeft: 0,
    handleRight: 0,
    rightSlantRate: 0,
    leftSlantRate: 0,
  }
}

/**
 * Returns shadow styles for a block. Since all blocks now use clip-path,
 * we split into two parts:
 *
 * - `filter`: CSS `drop-shadow()` chain applied to the WRAPPER div.
 *   drop-shadow follows the clip-path contour (unlike box-shadow which gets clipped).
 *
 * - `boxShadow`: Only used for the inset accent bar on Tool blocks.
 *   Inset shadows render inside the element, so they survive clip-path.
 */
export interface BlockShadowResult {
  filter: string
  boxShadow: string
}

export function getBlockShadow(
  bgColor: string,
  isSelected: boolean,
  isActive: boolean,
  isDark: boolean,
  hasLeftAccent?: boolean
): BlockShadowResult {
  const accent = hasLeftAccent ? `inset 3px 0 0 ${bgColor}` : ''

  if (isSelected) {
    const selectionBlue = '#3B82F6'
    return {
      filter: `drop-shadow(0 0 0.5px ${selectionBlue}) drop-shadow(0 0 1px ${selectionBlue}) drop-shadow(0 2px 6px rgba(0,0,0,0.10))`,
      boxShadow: accent,
    }
  }

  if (isActive) {
    return {
      filter: `drop-shadow(0 0 6px ${bgColor}60) drop-shadow(0 0 2px ${bgColor}40)`,
      boxShadow: accent,
    }
  }

  if (isDark) {
    return {
      filter: `drop-shadow(0 0 0.5px rgba(255,255,255,0.12)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))`,
      boxShadow: accent,
    }
  }

  return {
    filter: `drop-shadow(0 0 0.5px rgba(0,0,0,0.10)) drop-shadow(0 2px 6px rgba(0,0,0,0.06))`,
    boxShadow: accent,
  }
}
