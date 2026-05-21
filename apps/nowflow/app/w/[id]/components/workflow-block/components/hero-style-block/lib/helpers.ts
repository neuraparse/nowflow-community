import {
  ModernAgentIcon,
  ModernApiIcon,
  ModernConditionIcon,
  ModernDataIcon,
  ModernFunctionIcon,
  ModernModelIcon,
  ModernRouterIcon,
  ModernStartIcon,
} from '@/components/modern-icons'
import { type StarterTriggerValues } from '@/components/workflow/starter-trigger-presentation'

// Icon mapping based on block type - using Modern Icons
export const getIconForType = (type: string, configIcon?: any) => {
  switch (type) {
    case 'agent':
      return ModernAgentIcon
    case 'function':
      return ModernFunctionIcon
    case 'api':
      return ModernApiIcon
    case 'starter':
      return ModernStartIcon
    case 'condition':
      return ModernConditionIcon
    case 'data':
      return ModernDataIcon
    case 'model':
      return ModernModelIcon
    case 'router':
      return ModernRouterIcon
    default:
      return configIcon || ModernStartIcon
  }
}

// ─── Sticky Note Color Palette ──────────────────────────────────────────────
export const NOTE_COLORS = {
  amber: {
    bg: '#FFFBEB',
    bgDark: 'rgba(120,53,15,0.35)',
    border: '#FCD34D',
    headerBorder: '#FDE68A',
    dot: '#F59E0B',
    text: '#78350F',
    textDark: '#FDE68A',
  },
  rose: {
    bg: '#FFF1F2',
    bgDark: 'rgba(136,19,55,0.35)',
    border: '#FDA4AF',
    headerBorder: '#FECDD3',
    dot: '#F43F5E',
    text: '#881337',
    textDark: '#FECDD3',
  },
  sky: {
    bg: '#F0F9FF',
    bgDark: 'rgba(7,89,133,0.35)',
    border: '#7DD3FC',
    headerBorder: '#BAE6FD',
    dot: '#0EA5E9',
    text: '#0C4A6E',
    textDark: '#BAE6FD',
  },
  emerald: {
    bg: '#ECFDF5',
    bgDark: 'rgba(6,78,59,0.35)',
    border: '#6EE7B7',
    headerBorder: '#A7F3D0',
    dot: '#10B981',
    text: '#064E3B',
    textDark: '#A7F3D0',
  },
  violet: {
    bg: '#F5F3FF',
    bgDark: 'rgba(46,16,101,0.35)',
    border: '#C4B5FD',
    headerBorder: '#DDD6FE',
    dot: '#8B5CF6',
    text: '#3B0764',
    textDark: '#DDD6FE',
  },
  slate: {
    bg: '#F8FAFC',
    bgDark: 'rgba(15,23,42,0.60)',
    border: '#CBD5E1',
    headerBorder: '#E2E8F0',
    dot: '#64748B',
    text: '#334155',
    textDark: '#CBD5E1',
  },
} as const

export const EMPTY_STARTER_TRIGGER_VALUES: StarterTriggerValues = {}
