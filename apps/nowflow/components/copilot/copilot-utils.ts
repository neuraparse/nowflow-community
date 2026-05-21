import type { ActionSummary } from './copilot-types'

// ─── Animation Presets ─────────────────────────────────────────────────────────

export const spring = { type: 'spring' as const, stiffness: 400, damping: 30 }
export const springGentle = { type: 'spring' as const, stiffness: 300, damping: 28 }
export const easeOut = [0.23, 1, 0.32, 1] as const

// ─── Context Detection ─────────────────────────────────────────────────────────

export function getContextFromPath(pathname: string): string {
  // Workspace-specific contexts (more specific first)
  if (pathname.startsWith('/w/tables')) return 'data-tables'
  if (pathname.startsWith('/w/interfaces')) return 'form-builder'
  if (pathname.startsWith('/w/system-map')) return 'system-map'
  if (pathname.startsWith('/w/knowledge')) return 'knowledge-base'
  if (pathname.startsWith('/w/analytics')) return 'analytics'
  if (pathname.startsWith('/w/files')) return 'files'
  if (pathname.startsWith('/w/logs')) return 'logs'
  if (pathname.startsWith('/w/marketplace')) return 'marketplace'
  if (pathname.startsWith('/w/governance')) return 'governance'
  if (pathname.startsWith('/w/environments')) return 'environments'
  if (pathname.startsWith('/w/agent-memories')) return 'agent-memories'
  if (pathname.match(/^\/w\/[^/]+$/)) return 'workflow-editor'
  if (pathname.startsWith('/w')) return 'workspace'

  // Other app sections
  if (pathname.startsWith('/chat')) return 'chat'
  if (pathname.startsWith('/forms')) return 'forms'

  // Public pages (no copilot)
  if (pathname.startsWith('/docs')) return 'docs'
  if (pathname.startsWith('/blog')) return 'landing'
  if (pathname.startsWith('/demo-request')) return 'landing'
  if (pathname.startsWith('/pricing')) return 'landing'
  if (pathname.startsWith('/about')) return 'landing'
  if (pathname.startsWith('/contact')) return 'landing'
  if (pathname.startsWith('/terms')) return 'landing'
  if (pathname.startsWith('/privacy')) return 'landing'

  // Auth pages
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  )
    return 'auth'

  // Landing
  if (pathname === '/') return 'landing'

  return 'general'
}

// ─── Action Summary Builder ────────────────────────────────────────────────────

export function buildActionSummary(
  actions: Array<{ name: string; parameters: any }>
): ActionSummary | undefined {
  const added: string[] = []
  const inserted: string[] = []
  let removed = 0
  const configured = new Set<string>()
  let repositioned = 0
  let connections = 0

  for (const a of actions) {
    switch (a.name) {
      case 'addBlock':
        added.push(a.parameters?.type?.replace(/_/g, ' ') || 'block')
        break
      case 'insertBlock':
        inserted.push(a.parameters?.type?.replace(/_/g, ' ') || 'block')
        break
      case 'addUtilityBlock':
        added.push(`⚡${a.parameters?.type?.replace(/_/g, ' ') || 'utility'}`)
        break
      case 'removeBlock':
        removed++
        break
      case 'updateSubBlock':
        configured.add(a.parameters?.blockId || 'unknown')
        break
      case 'repositionBlock':
        repositioned++
        break
      case 'addEdge':
      case 'removeEdge':
        connections++
        break
    }
  }

  const summary: ActionSummary = {}
  if (added.length > 0) summary.added = added
  if (inserted.length > 0) summary.inserted = inserted
  if (removed > 0) summary.removed = removed
  if (configured.size > 0) summary.configured = configured.size
  if (connections > 0) summary.connections = connections
  if (repositioned > 0) summary.repositioned = repositioned

  return Object.keys(summary).length > 0 ? summary : undefined
}

// ─── Thinking Insights ─────────────────────────────────────────────────────────

export function getThinkingInsights(context: string): string[] {
  switch (context) {
    case 'workflow-editor':
      return [
        'Analyzing workflow structure...',
        'Evaluating node connections...',
        'Determining optimal configuration...',
        'Preparing workflow changes...',
      ]
    case 'data-tables':
      return [
        'Analyzing table schema...',
        'Evaluating data relationships...',
        'Preparing query operations...',
        'Generating response...',
      ]
    case 'analytics':
      return [
        'Querying metrics data...',
        'Analyzing performance trends...',
        'Computing statistical insights...',
        'Generating response...',
      ]
    case 'knowledge-base':
      return [
        'Searching knowledge sources...',
        'Retrieving relevant documents...',
        'Synthesizing information...',
        'Generating response...',
      ]
    case 'logs':
      return [
        'Scanning execution logs...',
        'Identifying error patterns...',
        'Analyzing trace data...',
        'Generating response...',
      ]
    case 'system-map':
      return [
        'Mapping system topology...',
        'Analyzing dependencies...',
        'Computing connections...',
        'Generating response...',
      ]
    default:
      return [
        'Understanding your request...',
        'Analyzing context...',
        'Searching for solutions...',
        'Composing response...',
      ]
  }
}

// ─── Time Formatting ───────────────────────────────────────────────────────────

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 172800) return 'yesterday'
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Suggestions ───────────────────────────────────────────────────────────────

export function getSuggestions(context: string): string[] {
  switch (context) {
    case 'workflow-editor':
      return [
        'Add a Slack notification step to this workflow',
        'Why did my last workflow run fail?',
        'Optimize this workflow for better performance',
      ]
    case 'data-tables':
      return [
        'Create a table for tracking customer leads',
        'Import data from a CSV file',
        'Set up an AI-generated column for sentiment analysis',
      ]
    case 'form-builder':
      return [
        'Create a customer feedback form',
        'Connect this form to a workflow',
        'Add conditional logic to show/hide fields',
      ]
    case 'analytics':
      return [
        'Which workflow has the highest error rate?',
        'Show me cost trends for the last 30 days',
        'Compare performance across different models',
      ]
    case 'knowledge-base':
      return [
        'How do I add documents to a knowledge source?',
        'Set up RAG for my customer support bot',
        'What file formats are supported?',
      ]
    case 'system-map':
      return [
        'Show all workflows connected to Slack',
        'Which workflows are failing?',
        'Calculate ROI for my automations',
      ]
    case 'files':
      return [
        'How do I upload and manage files?',
        'Which file types are supported?',
        'How can I use files in my workflows?',
      ]
    case 'logs':
      return [
        'Show me recent workflow errors',
        'How do I filter logs by workflow?',
        'Help me debug a failed execution',
      ]
    case 'marketplace':
      return [
        'Show me popular workflow templates',
        'How do I publish a workflow template?',
        'Find a template for email automation',
      ]
    case 'governance':
      return [
        'How do I set up approval workflows?',
        'Explain role-based access control',
        'How do I audit workflow changes?',
      ]
    case 'environments':
      return [
        'Why is Environments marked Enterprise?',
        'How do I manage local environment variables?',
        'How do I request Enterprise environments?',
      ]
    case 'agent-memories':
      return [
        'How do agent memories work?',
        'How can I manage stored memories?',
        'How do memories improve AI responses?',
      ]
    case 'docs':
      return [
        'How do I get started with NowFlow?',
        'Explain the workflow builder basics',
        'How do I set up my first integration?',
      ]
    case 'chat':
      return [
        'How do I create a chat interface?',
        'How do I connect chat to a workflow?',
        'How do I customize the chat widget?',
      ]
    case 'auth':
      return [
        'How do I create an account?',
        'What authentication methods are supported?',
        'How do I reset my password?',
      ]
    case 'landing':
      return ['What is NowFlow?', 'How do I get started?', 'What integrations are available?']
    case 'forms':
      return [
        'How do I build a form?',
        'How do I connect forms to workflows?',
        'How do I share a form publicly?',
      ]
    default:
      return [
        'Help me create a new workflow',
        'What features does NowFlow offer?',
        'Show me how to set up integrations',
      ]
  }
}

// ─── Nudge Messages ────────────────────────────────────────────────────────────

const NUDGE_MESSAGES: Record<string, string[]> = {
  'workflow-editor': [
    'Hey! I can build that workflow for you \u2728',
    'Stuck on a step? Tell me what you need!',
    'I can add blocks, connect them, configure \u2014 just say the word',
    "Need a hand wiring things up? I'm here!",
  ],
  'data-tables': [
    "Need a hand with your data? I'm here! \uD83C\uDFAF",
    'I can create tables, columns, even AI-powered ones',
    'Want me to help organize this data?',
    'Tell me what data structure you need!',
  ],
  'form-builder': [
    "Let's design something great together! \uD83C\uDFA8",
    'I can help build forms and connect them to workflows',
    'Need conditional fields? I can set that up!',
    "Tell me about the form you're building",
  ],
  analytics: [
    'I can spot patterns in your data! \uD83D\uDCCA',
    'Want a breakdown of your workflow performance?',
    'I can analyze trends and find insights for you',
    'Curious about your metrics? Just ask!',
  ],
  'knowledge-base': [
    'Need help organizing knowledge? \uD83D\uDCDA',
    'I can help set up RAG and document sources',
    'Want to optimize your knowledge retrieval?',
    'Tell me about the knowledge you want to manage',
  ],
  logs: [
    'I can help track down that bug! \uD83D\uDD0D',
    'Want me to analyze recent errors?',
    'I can spot patterns in your execution logs',
    "Something failing? Let's debug it together",
  ],
  'system-map': [
    'Let me help map your system! \uD83D\uDDFA\uFE0F',
    'I can show you how everything connects',
    'Want to understand your automation landscape?',
    'Curious which workflows are linked?',
  ],
  marketplace: [
    'Looking for the perfect template? \uD83D\uDECD\uFE0F',
    'I can recommend templates for your use case',
    'Need a starting point? I know the catalog!',
    'Tell me what you want to automate',
  ],
}

const DEFAULT_NUDGES = [
  'Hey there! Copilot here \u2014 need a hand? \uD83D\uDC4B',
  "I'm your AI assistant \u2014 ask me anything!",
  'Anything I can help with? Just ask!',
  'Hi! I can help with workflows, data, and more',
]

export function getRandomNudgeMessage(context: string): string {
  const pool = NUDGE_MESSAGES[context] || DEFAULT_NUDGES
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Hidden Contexts (pages where copilot is not shown) ────────────────────────

export const HIDDEN_CONTEXTS = ['auth', 'landing', 'docs', 'general'] as const
