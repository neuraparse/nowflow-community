/**
 * Types for block styling and customization
 */

// Available border colors for blocks - Professional Design System
export type BlockBorderColor =
  | 'default'
  | 'blue' // Trust, beginning, primary actions
  | 'indigo' // Intelligence, AI processing
  | 'purple' // Advanced processing, AI agents
  | 'green' // Success, data, growth
  | 'emerald' // Fresh data, new information
  | 'teal' // Logic, decisions, conditions
  | 'cyan' // Communication, flow
  | 'orange' // External, APIs, warnings
  | 'amber' // Attention, important
  | 'red' // Errors, critical, stop
  | 'rose' // Soft alerts, user input
  | 'pink' // Creative, design
  | 'yellow' // Highlights, temporary
  | 'slate' // Neutral, utility
  | 'gray' // Disabled, secondary

// Available border styles for blocks
export type BlockBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'

// Available animation effects for blocks - Contextual & Professional
export type BlockAnimation =
  | 'none' // Stable, completed, static
  | 'pulse' // Processing, waiting, breathing
  | 'glow' // Important, active, highlighted
  | 'bounce' // Playful, attention-grabbing
  | 'float' // Gentle movement, elegant
  | 'spin' // Loading, processing
  | 'ping' // Notifications, alerts
  | 'fade' // Subtle, elegant transitions

// Available card themes for blocks
export type BlockCardTheme =
  | 'minimal' // Clean, simple design (current)
  | 'glassmorphic' // Gradient backgrounds with transparency
  | 'gradient' // Full gradient backgrounds
  | 'neon' // Glowing borders and effects
  | 'flat' // Flat design with solid colors
  | 'neumorphic' // Soft shadows and depth

// Block style configuration
export interface BlockStyle {
  borderColor: BlockBorderColor
  borderStyle: BlockBorderStyle
  borderWidth: number
  animation: BlockAnimation
  customLabel?: string
  isHighlighted: boolean
  cardTheme: BlockCardTheme
}

// Default style for blocks
export const DEFAULT_BLOCK_STYLE: BlockStyle = {
  borderColor: 'default',
  borderStyle: 'solid',
  borderWidth: 1,
  animation: 'none',
  isHighlighted: false,
  cardTheme: 'minimal',
}

// Block style store state
export interface BlockStyleState {
  styles: Record<string, BlockStyle>
  activeStyleEditorId: string | null
}

// Block style store actions
export interface BlockStyleActions {
  setBlockStyle: (blockId: string, style: Partial<BlockStyle>) => void
  resetBlockStyle: (blockId: string) => void
  getBlockStyle: (blockId: string) => BlockStyle
  toggleBlockStyleEditor: (blockId: string) => void
  closeBlockStyleEditor: () => void
}

// Complete block style store type
export type BlockStyleStore = BlockStyleState & BlockStyleActions
