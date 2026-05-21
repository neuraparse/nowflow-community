import { type Node } from '@xyflow/react'
import { BlockConfig } from '@/blocks/types'
import { NOTE_COLORS } from './lib/helpers'

export type HeroStyleBlockData = Record<string, unknown> & {
  type: string
  config: BlockConfig
  name: string
  isActive?: boolean
  isPending?: boolean
  currentData?: string | null
  isNew?: boolean
  enabled?: boolean
  hasActiveHelper?: boolean
}

export type HeroStyleBlockNode = Node<HeroStyleBlockData, string>

export type NoteColor = keyof typeof NOTE_COLORS
