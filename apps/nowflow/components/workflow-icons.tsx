import { SVGProps } from 'react'
import {
  BarChart3,
  Bot,
  Brain,
  Calendar,
  Camera,
  Clock,
  Code,
  CreditCard,
  Database,
  Download,
  FileText,
  Filter,
  Globe,
  Hash,
  Heart,
  Image,
  Key,
  Layers,
  Lock,
  Mail,
  Map,
  MessageSquare,
  Music,
  Palette,
  PieChart,
  Play,
  Puzzle,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Tag,
  Target,
  Truck,
  Users,
  Video,
  Wifi,
  Workflow,
  Zap,
} from 'lucide-react'

export interface WorkflowIcon {
  id: string
  name: string
  icon: React.ComponentType<SVGProps<SVGSVGElement>>
  color: string
  category: string
}

export const WORKFLOW_ICONS: WorkflowIcon[] = [
  // AI & Automation
  { id: 'bot', name: 'Bot', icon: Bot, color: '#3B82F6', category: 'AI & Automation' },
  { id: 'brain', name: 'Brain', icon: Brain, color: '#8B5CF6', category: 'AI & Automation' },
  {
    id: 'sparkles',
    name: 'Sparkles',
    icon: Sparkles,
    color: '#F59E0B',
    category: 'AI & Automation',
  },
  { id: 'zap', name: 'Zap', icon: Zap, color: '#EAB308', category: 'AI & Automation' },
  { id: 'rocket', name: 'Rocket', icon: Rocket, color: '#EF4444', category: 'AI & Automation' },
  {
    id: 'workflow',
    name: 'Workflow',
    icon: Workflow,
    color: '#06B6D4',
    category: 'AI & Automation',
  },

  // Development
  { id: 'code', name: 'Code', icon: Code, color: '#10B981', category: 'Development' },
  { id: 'database', name: 'Database', icon: Database, color: '#6366F1', category: 'Development' },
  { id: 'layers', name: 'Layers', icon: Layers, color: '#8B5CF6', category: 'Development' },
  { id: 'puzzle', name: 'Puzzle', icon: Puzzle, color: '#F59E0B', category: 'Development' },
  { id: 'settings', name: 'Settings', icon: Settings, color: '#6B7280', category: 'Development' },
  { id: 'key', name: 'Key', icon: Key, color: '#F59E0B', category: 'Development' },

  // Communication
  {
    id: 'message',
    name: 'Message',
    icon: MessageSquare,
    color: '#3B82F6',
    category: 'Communication',
  },
  { id: 'mail', name: 'Mail', icon: Mail, color: '#EF4444', category: 'Communication' },
  { id: 'users', name: 'Users', icon: Users, color: '#10B981', category: 'Communication' },
  { id: 'wifi', name: 'Wifi', icon: Wifi, color: '#06B6D4', category: 'Communication' },
  { id: 'globe', name: 'Globe', icon: Globe, color: '#3B82F6', category: 'Communication' },

  // Content & Media
  { id: 'file', name: 'File', icon: FileText, color: '#6B7280', category: 'Content & Media' },
  { id: 'image', name: 'Image', icon: Image, color: '#EC4899', category: 'Content & Media' },
  { id: 'video', name: 'Video', icon: Video, color: '#EF4444', category: 'Content & Media' },
  { id: 'camera', name: 'Camera', icon: Camera, color: '#6366F1', category: 'Content & Media' },
  { id: 'music', name: 'Music', icon: Music, color: '#8B5CF6', category: 'Content & Media' },
  { id: 'palette', name: 'Palette', icon: Palette, color: '#EC4899', category: 'Content & Media' },

  // Analytics & Data
  { id: 'chart', name: 'Chart', icon: BarChart3, color: '#10B981', category: 'Analytics & Data' },
  { id: 'pie', name: 'Pie Chart', icon: PieChart, color: '#F59E0B', category: 'Analytics & Data' },
  { id: 'search', name: 'Search', icon: Search, color: '#6B7280', category: 'Analytics & Data' },
  { id: 'filter', name: 'Filter', icon: Filter, color: '#8B5CF6', category: 'Analytics & Data' },
  { id: 'target', name: 'Target', icon: Target, color: '#EF4444', category: 'Analytics & Data' },
  { id: 'hash', name: 'Hash', icon: Hash, color: '#06B6D4', category: 'Analytics & Data' },

  // Business & Finance
  {
    id: 'credit',
    name: 'Credit Card',
    icon: CreditCard,
    color: '#10B981',
    category: 'Business & Finance',
  },
  { id: 'truck', name: 'Truck', icon: Truck, color: '#F59E0B', category: 'Business & Finance' },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    color: '#3B82F6',
    category: 'Business & Finance',
  },
  { id: 'clock', name: 'Clock', icon: Clock, color: '#6B7280', category: 'Business & Finance' },
  {
    id: 'download',
    name: 'Download',
    icon: Download,
    color: '#10B981',
    category: 'Business & Finance',
  },

  // Security & Tools
  { id: 'shield', name: 'Shield', icon: Shield, color: '#10B981', category: 'Security & Tools' },
  { id: 'lock', name: 'Lock', icon: Lock, color: '#EF4444', category: 'Security & Tools' },
  { id: 'map', name: 'Map', icon: Map, color: '#06B6D4', category: 'Security & Tools' },
  { id: 'play', name: 'Play', icon: Play, color: '#10B981', category: 'Security & Tools' },

  // Favorites
  { id: 'star', name: 'Star', icon: Star, color: '#F59E0B', category: 'Favorites' },
  { id: 'heart', name: 'Heart', icon: Heart, color: '#EF4444', category: 'Favorites' },
  { id: 'tag', name: 'Tag', icon: Tag, color: '#8B5CF6', category: 'Favorites' },
]

export const DEFAULT_WORKFLOW_ICON: WorkflowIcon =
  WORKFLOW_ICONS.find((icon) => icon.id === 'workflow') || WORKFLOW_ICONS[0]

export const getWorkflowIconById = (id: string): WorkflowIcon => {
  return WORKFLOW_ICONS.find((icon) => icon.id === id) || DEFAULT_WORKFLOW_ICON
}

export const getWorkflowIconsByCategory = () => {
  const categories: Record<string, WorkflowIcon[]> = {}

  WORKFLOW_ICONS.forEach((icon) => {
    if (!categories[icon.category]) {
      categories[icon.category] = []
    }
    categories[icon.category].push(icon)
  })

  return categories
}

// Match a keyword as a standalone token so short words like "ai" don't
// match inside "email" / "main" / "pair".
const hasWord = (name: string, keyword: string) => {
  const words = name.split(/[^a-z0-9]+/).filter(Boolean)
  return words.includes(keyword)
}

const hasAny = (name: string, keywords: string[]) => keywords.some((k) => hasWord(name, k))

// Smart icon suggestion based on workflow name
export const suggestWorkflowIcon = (workflowName: string): WorkflowIcon => {
  const name = workflowName.toLowerCase()

  // Communication keywords — checked first so "email" doesn't trip the "ai" bucket
  if (hasAny(name, ['email', 'mail', 'send'])) {
    return getWorkflowIconById('mail')
  }
  if (hasAny(name, ['chat', 'message', 'talk'])) {
    return getWorkflowIconById('message')
  }
  if (hasAny(name, ['user', 'users', 'team', 'people'])) {
    return getWorkflowIconById('users')
  }

  // AI & Automation keywords
  if (hasAny(name, ['ai', 'bot', 'assistant', 'gpt', 'llm'])) {
    return getWorkflowIconById('bot')
  }
  if (hasAny(name, ['brain', 'think', 'thinking', 'smart'])) {
    return getWorkflowIconById('brain')
  }
  if (hasAny(name, ['auto', 'automation', 'magic', 'generate'])) {
    return getWorkflowIconById('sparkles')
  }

  // Development keywords
  if (hasAny(name, ['code', 'coding', 'script', 'dev'])) {
    return getWorkflowIconById('code')
  }
  if (hasAny(name, ['data', 'database', 'db'])) {
    return getWorkflowIconById('database')
  }
  if (hasAny(name, ['api', 'service', 'integration'])) {
    return getWorkflowIconById('layers')
  }

  // Content & Media keywords
  if (hasAny(name, ['image', 'photo', 'picture'])) {
    return getWorkflowIconById('image')
  }
  if (hasAny(name, ['video', 'movie', 'film'])) {
    return getWorkflowIconById('video')
  }
  if (hasAny(name, ['file', 'document', 'text'])) {
    return getWorkflowIconById('file')
  }

  // Analytics keywords
  if (hasAny(name, ['chart', 'graph', 'analytics'])) {
    return getWorkflowIconById('chart')
  }
  if (hasAny(name, ['search', 'find', 'lookup'])) {
    return getWorkflowIconById('search')
  }

  // Business keywords
  if (hasAny(name, ['payment', 'money', 'finance'])) {
    return getWorkflowIconById('credit')
  }
  if (hasAny(name, ['schedule', 'calendar', 'time'])) {
    return getWorkflowIconById('calendar')
  }

  return DEFAULT_WORKFLOW_ICON
}
