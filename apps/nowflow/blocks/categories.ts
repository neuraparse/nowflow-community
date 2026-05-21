/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * DYNAMIC BLOCK CATEGORIZATION SYSTEM
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 🎯 Purpose:
 * - Centralized, dynamic block categorization
 * - Auto-detection of block capabilities
 * - Flexible tag-based system
 * - AI-friendly metadata
 * - Performance optimized with caching
 *
 * 🔄 Features:
 * - Multi-category support (blocks can belong to multiple categories)
 * - Tag-based filtering
 * - Compliance-aware categorization
 * - Industry-specific groupings
 * - Intelligent search and discovery
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import { BlockConfig } from './types'

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

/**
 * Primary categories for UI organization
 */
export const PRIMARY_CATEGORIES = {
  CORE_FLOW: 'core_flow',
  AGENTS: 'agents',
  DATA_FILES: 'data_files',
  INTEGRATIONS: 'integrations',
  VISION_MEDIA: 'vision_media',
  UTILITIES: 'utilities',
} as const

export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[keyof typeof PRIMARY_CATEGORIES]

/**
 * Industry-specific categories for better organization
 */
export const INDUSTRY_CATEGORIES = {
  // Business & Productivity
  COLLABORATION: 'collaboration',
  PROJECT_MANAGEMENT: 'project_management',
  CRM_SALES: 'crm_sales',
  CUSTOMER_SUPPORT: 'customer_support',

  // Financial Services
  TRADING: 'trading',
  CRYPTO: 'crypto',
  PAYMENTS: 'payments',
  ACCOUNTING: 'accounting',

  // Marketing & Communications
  MARKETING: 'marketing',
  EMAIL: 'email',
  SOCIAL_MEDIA: 'social_media',
  MESSAGING: 'messaging',

  // Development & Infrastructure
  CLOUD_SERVICES: 'cloud_services',
  DATABASES: 'databases',
  FILE_STORAGE: 'file_storage',
  API_TOOLS: 'api_tools',

  // Design & Content
  DESIGN_TOOLS: 'design_tools',
  VIDEO_AUDIO: 'video_audio',
  CONTENT_CREATION: 'content_creation',

  // Analytics & Monitoring
  ANALYTICS: 'analytics',
  MONITORING: 'monitoring',

  // Enterprise Systems
  ERP_SYSTEMS: 'erp_systems',
  HR_PAYROLL: 'hr_payroll',
} as const

export type IndustryCategory = (typeof INDUSTRY_CATEGORIES)[keyof typeof INDUSTRY_CATEGORIES]

/**
 * Capability-based tags for filtering
 */
export const CAPABILITY_TAGS = {
  // AI & Intelligence
  AI_REASONING: 'ai_reasoning',
  RAG: 'rag',
  VISION: 'vision',

  // Data Operations
  DATA_PROCESSING: 'data_processing',
  DATA_STORAGE: 'data_storage',
  DATA_RETRIEVAL: 'data_retrieval',
  DATA_TRANSFORMATION: 'data_transformation',

  // Workflow Control
  CONDITIONAL_LOGIC: 'conditional_logic',
  ITERATION: 'iteration',
  ROUTING: 'routing',
  SCHEDULING: 'scheduling',
  WEBHOOKS: 'webhooks',

  // External Integration
  OAUTH: 'oauth',
  REST_API: 'rest_api',
  GRAPHQL: 'graphql',
  WEBSOCKETS: 'websockets',

  // Search & Discovery
  SEMANTIC_SEARCH: 'semantic_search',

  // Content & Media
  IMAGE_GENERATION: 'image_generation',
  IMAGE_ANALYSIS: 'image_analysis',
  AUDIO_GENERATION: 'audio_generation',
  VIDEO_PROCESSING: 'video_processing',

  // Code & Functions
  CODE_EXECUTION: 'code_execution',
  CUSTOM_FUNCTIONS: 'custom_functions',

  // Compliance & Security
  REGULATED: 'regulated',
  FINANCIAL_TRADING: 'financial_trading',
  HIGH_RISK: 'high_risk',
  KYC_REQUIRED: 'kyc_required',
} as const

export type CapabilityTag = (typeof CAPABILITY_TAGS)[keyof typeof CAPABILITY_TAGS]

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export interface CategoryMetadata {
  id: string
  name: string
  description: string
  icon?: string
  color?: string
  order: number
  parentCategory?: string
}

export const CATEGORY_METADATA: Record<string, CategoryMetadata> = {
  // Primary Categories
  [PRIMARY_CATEGORIES.CORE_FLOW]: {
    id: 'core_flow',
    name: 'Core Flow',
    description: 'Essential workflow control blocks: routing, conditions, loops, timers',
    color: '#3B82F6',
    order: 1,
  },
  [PRIMARY_CATEGORIES.AGENTS]: {
    id: 'agents',
    name: 'AI Agents',
    description: 'AI agents with reasoning and retrieval capabilities',
    color: '#8B5CF6',
    order: 2,
  },
  [PRIMARY_CATEGORIES.DATA_FILES]: {
    id: 'data_files',
    name: 'Data & Files',
    description: 'Databases, file storage, and data processing',
    color: '#F59E0B',
    order: 4,
  },
  [PRIMARY_CATEGORIES.INTEGRATIONS]: {
    id: 'integrations',
    name: 'Integrations',
    description: 'Third-party service integrations',
    color: '#EC4899',
    order: 5,
  },
  [PRIMARY_CATEGORIES.VISION_MEDIA]: {
    id: 'vision_media',
    name: 'Vision & Media',
    description: 'Image, audio, and video processing',
    color: '#14B8A6',
    order: 6,
  },
  [PRIMARY_CATEGORIES.UTILITIES]: {
    id: 'utilities',
    name: 'Utilities',
    description: 'Helper tools and utilities',
    color: '#64748B',
    order: 8,
  },

  // Industry Categories
  [INDUSTRY_CATEGORIES.COLLABORATION]: {
    id: 'collaboration',
    name: 'Collaboration',
    description: 'Team communication and collaboration tools',
    color: '#3B82F6',
    order: 100,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.PROJECT_MANAGEMENT]: {
    id: 'project_management',
    name: 'Project Management',
    description: 'Task and project management platforms',
    color: '#8B5CF6',
    order: 101,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.CRM_SALES]: {
    id: 'crm_sales',
    name: 'CRM & Sales',
    description: 'Customer relationship management and sales tools',
    color: '#10B981',
    order: 102,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.TRADING]: {
    id: 'trading',
    name: 'Trading Platforms',
    description: 'Stock, forex, and derivatives trading platforms',
    color: '#EF4444',
    order: 103,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.CRYPTO]: {
    id: 'crypto',
    name: 'Crypto Exchanges',
    description: 'Cryptocurrency trading and management',
    color: '#F97316',
    order: 104,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.PAYMENTS]: {
    id: 'payments',
    name: 'Payment Processing',
    description: 'Payment gateways and financial services',
    color: '#06B6D4',
    order: 105,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.ACCOUNTING]: {
    id: 'accounting',
    name: 'Accounting & Finance',
    description: 'Accounting, bookkeeping, and financial management',
    color: '#84CC16',
    order: 106,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.MARKETING]: {
    id: 'marketing',
    name: 'Marketing Automation',
    description: 'Marketing platforms and automation tools',
    color: '#EC4899',
    order: 107,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.EMAIL]: {
    id: 'email',
    name: 'Email Services',
    description: 'Email platforms and services',
    color: '#F59E0B',
    order: 108,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.SOCIAL_MEDIA]: {
    id: 'social_media',
    name: 'Social Media',
    description: 'Social media platforms and management',
    color: '#8B5CF6',
    order: 109,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.MESSAGING]: {
    id: 'messaging',
    name: 'Messaging',
    description: 'Chat and messaging platforms',
    color: '#14B8A6',
    order: 110,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.CLOUD_SERVICES]: {
    id: 'cloud_services',
    name: 'Cloud Services',
    description: 'Cloud infrastructure and deployment platforms',
    color: '#6366F1',
    order: 111,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.DATABASES]: {
    id: 'databases',
    name: 'Databases',
    description: 'Database systems and services',
    color: '#F59E0B',
    order: 112,
    parentCategory: PRIMARY_CATEGORIES.DATA_FILES,
  },
  [INDUSTRY_CATEGORIES.FILE_STORAGE]: {
    id: 'file_storage',
    name: 'File Storage',
    description: 'Cloud file storage and document management',
    color: '#10B981',
    order: 113,
    parentCategory: PRIMARY_CATEGORIES.DATA_FILES,
  },
  [INDUSTRY_CATEGORIES.DESIGN_TOOLS]: {
    id: 'design_tools',
    name: 'Design Tools',
    description: 'Design and creative platforms',
    color: '#EC4899',
    order: 114,
    parentCategory: PRIMARY_CATEGORIES.VISION_MEDIA,
  },
  [INDUSTRY_CATEGORIES.ANALYTICS]: {
    id: 'analytics',
    name: 'Analytics',
    description: 'Analytics and tracking platforms',
    color: '#8B5CF6',
    order: 115,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.ERP_SYSTEMS]: {
    id: 'erp_systems',
    name: 'ERP Systems',
    description: 'Enterprise resource planning systems',
    color: '#3B82F6',
    order: 116,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
  [INDUSTRY_CATEGORIES.HR_PAYROLL]: {
    id: 'hr_payroll',
    name: 'HR & Payroll',
    description: 'Human resources and payroll systems',
    color: '#14B8A6',
    order: 117,
    parentCategory: PRIMARY_CATEGORIES.INTEGRATIONS,
  },
}

// ============================================================================
// CATEGORIZATION RULES
// ============================================================================

/**
 * Dynamic categorization rules based on block properties
 */
export interface CategorizationRule {
  match: (block: BlockConfig) => boolean
  categories: (PrimaryCategory | IndustryCategory)[]
  tags: CapabilityTag[]
  priority: number
}

export const CATEGORIZATION_RULES: CategorizationRule[] = [
  // Core Flow Blocks
  {
    match: (block) =>
      [
        'starter',
        'router',
        'condition',
        'loop',
        'timer',
        'variable',
        'function',
        'evaluator',
        'thinking',
      ].includes(block.type),
    categories: [PRIMARY_CATEGORIES.CORE_FLOW],
    tags: [CAPABILITY_TAGS.CONDITIONAL_LOGIC],
    priority: 100,
  },

  // Approval Block (Human-in-the-Loop)
  {
    match: (block) => block.type === 'approval',
    categories: [PRIMARY_CATEGORIES.CORE_FLOW],
    tags: [CAPABILITY_TAGS.CONDITIONAL_LOGIC],
    priority: 95,
  },

  // Voice/Audio Processing (Speech-to-Text, Text-to-Speech)
  {
    match: (block) => ['speech_to_text', 'text_to_speech'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.VISION_MEDIA],
    tags: [CAPABILITY_TAGS.AUDIO_GENERATION],
    priority: 85,
  },

  // AI Agents
  {
    match: (block) => block.category === 'agents' || block.type.includes('_agent'),
    categories: [PRIMARY_CATEGORIES.AGENTS],
    tags: [CAPABILITY_TAGS.AI_REASONING],
    priority: 90,
  },

  // Databases
  {
    match: (block) =>
      ['sqlite', 'supabase', 'mongodb', 'pinecone', 'neon', 'planetscale'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.DATA_FILES, INDUSTRY_CATEGORIES.DATABASES],
    tags: [CAPABILITY_TAGS.DATA_STORAGE, CAPABILITY_TAGS.DATA_RETRIEVAL],
    priority: 80,
  },

  // File Storage
  {
    match: (block) =>
      ['s3', 'box', 'dropbox', 'onedrive', 'sharepoint', 'google_drive'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.DATA_FILES, INDUSTRY_CATEGORIES.FILE_STORAGE],
    tags: [CAPABILITY_TAGS.DATA_STORAGE],
    priority: 80,
  },

  // Data Processing
  {
    match: (block) =>
      ['file', 'file_operations', 'json_processor', 'csv_processor', 'text_processor'].includes(
        block.type
      ),
    categories: [PRIMARY_CATEGORIES.DATA_FILES, PRIMARY_CATEGORIES.UTILITIES],
    tags: [CAPABILITY_TAGS.DATA_PROCESSING, CAPABILITY_TAGS.DATA_TRANSFORMATION],
    priority: 75,
  },

  // Vision & Media
  {
    match: (block) => ['vision', 'image_generator'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.VISION_MEDIA],
    tags: [
      CAPABILITY_TAGS.VISION,
      CAPABILITY_TAGS.IMAGE_GENERATION,
      CAPABILITY_TAGS.IMAGE_ANALYSIS,
    ],
    priority: 85,
  },

  // Audio
  {
    match: (block) => ['elevenlabs'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.VISION_MEDIA],
    tags: [CAPABILITY_TAGS.AUDIO_GENERATION],
    priority: 85,
  },

  // Trading Platforms (High Priority for Compliance)
  {
    match: (block) => ['robinhood', 'interactive_brokers'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.TRADING],
    tags: [
      CAPABILITY_TAGS.FINANCIAL_TRADING,
      CAPABILITY_TAGS.REGULATED,
      CAPABILITY_TAGS.HIGH_RISK,
      CAPABILITY_TAGS.OAUTH,
    ],
    priority: 100,
  },

  // Crypto Exchanges
  {
    match: (block) => ['binance', 'coinbase', 'kraken', 'bybit'].includes(block.type),
    categories: [
      PRIMARY_CATEGORIES.INTEGRATIONS,
      INDUSTRY_CATEGORIES.CRYPTO,
      INDUSTRY_CATEGORIES.TRADING,
    ],
    tags: [CAPABILITY_TAGS.FINANCIAL_TRADING, CAPABILITY_TAGS.HIGH_RISK, CAPABILITY_TAGS.OAUTH],
    priority: 100,
  },

  // Payment Processing
  {
    match: (block) =>
      ['stripe', 'paypal', 'square', 'paddle', 'lemonsqueezy', 'adyen', 'wise'].includes(
        block.type
      ),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.PAYMENTS],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Accounting
  {
    match: (block) => ['quickbooks', 'xero', 'freshbooks', 'zoho_books'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.ACCOUNTING],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // CRM & Sales
  {
    match: (block) =>
      ['salesforce', 'hubspot', 'pipedrive', 'zoho_crm', 'copper', 'close'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.CRM_SALES],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Project Management
  {
    match: (block) =>
      [
        'jira',
        'linear',
        'asana',
        'clickup',
        'monday',
        'trello',
        'basecamp',
        'wrike',
        'smartsheet',
        'coda',
      ].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.PROJECT_MANAGEMENT],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Collaboration
  {
    match: (block) =>
      [
        'slack',
        'teams',
        'zoom',
        'discord',
        'confluence',
        'miro',
        'loom',
        'figma',
        'canva',
        'dyte',
        'whereby',
      ].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.COLLABORATION],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Email Services
  {
    match: (block) =>
      ['gmail', 'outlook', 'sendgrid', 'mailgun', 'postmark', 'resend'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.EMAIL],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Marketing
  {
    match: (block) =>
      ['mailchimp', 'activecampaign', 'klaviyo', 'convertkit', 'brevo'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.MARKETING],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Social Media
  {
    match: (block) =>
      ['x', 'instagram', 'facebook', 'linkedin', 'reddit', 'youtube'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.SOCIAL_MEDIA],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Messaging
  {
    match: (block) => ['telegram', 'whatsapp', 'twilio_sms'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.MESSAGING],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Cloud Services
  {
    match: (block) => ['vercel', 'railway', 'render', 'flyio'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.CLOUD_SERVICES],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Design Tools
  {
    match: (block) => ['figma', 'canva', 'adobe_creative_cloud'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.DESIGN_TOOLS],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Analytics
  {
    match: (block) => ['segment', 'amplitude', 'posthog'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.ANALYTICS],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // ERP Systems
  {
    match: (block) => block.type.startsWith('sap_') || ['servicenow'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.ERP_SYSTEMS],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // HR & Payroll
  {
    match: (block) => ['gusto', 'bamboohr'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.HR_PAYROLL],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Customer Support
  {
    match: (block) => ['zendesk', 'intercom', 'freshdesk'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.CUSTOMER_SUPPORT],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Generic API Tools
  {
    match: (block) => ['api'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.UTILITIES],
    tags: [CAPABILITY_TAGS.REST_API, CAPABILITY_TAGS.CUSTOM_FUNCTIONS],
    priority: 75,
  },

  // Utilities
  {
    match: (block) => ['translate', 'math', 'mistral_parse'].includes(block.type),
    categories: [PRIMARY_CATEGORIES.UTILITIES],
    tags: [],
    priority: 70,
  },

  // Mem0 → Utilities (memory storage helper)
  {
    match: (block) => block.type === 'mem0',
    categories: [PRIMARY_CATEGORIES.UTILITIES],
    tags: [CAPABILITY_TAGS.DATA_STORAGE],
    priority: 75,
  },

  // Calendly → Integrations / Collaboration
  {
    match: (block) => block.type === 'calendly',
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.COLLABORATION],
    tags: [CAPABILITY_TAGS.OAUTH, CAPABILITY_TAGS.SCHEDULING],
    priority: 85,
  },

  // Clay → Integrations / CRM & Sales (data enrichment)
  {
    match: (block) => block.type === 'clay',
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.CRM_SALES],
    tags: [CAPABILITY_TAGS.OAUTH, CAPABILITY_TAGS.DATA_RETRIEVAL],
    priority: 85,
  },

  // Vonage → Integrations / Messaging
  {
    match: (block) => block.type === 'vonage',
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.MESSAGING],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 85,
  },

  // Zapier → Integrations (workflow automation)
  {
    match: (block) => block.type === 'zapier',
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS],
    tags: [CAPABILITY_TAGS.REST_API],
    priority: 80,
  },

  // Retool → Integrations / Cloud Services
  {
    match: (block) => block.type === 'retool',
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.CLOUD_SERVICES],
    tags: [CAPABILITY_TAGS.OAUTH],
    priority: 80,
  },

  // Typeform → Integrations (form & survey)
  {
    match: (block) => block.type === 'typeform',
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS],
    tags: [CAPABILITY_TAGS.OAUTH, CAPABILITY_TAGS.WEBHOOKS],
    priority: 80,
  },

  // PII Mask → Utilities
  {
    match: (block) => block.type === 'pii_mask',
    categories: [PRIMARY_CATEGORIES.UTILITIES],
    tags: [CAPABILITY_TAGS.DATA_TRANSFORMATION],
    priority: 75,
  },

  // Shopify → Integrations / Payments (e-commerce)
  {
    match: (block) => block.type === 'shopify',
    categories: [PRIMARY_CATEGORIES.INTEGRATIONS, INDUSTRY_CATEGORIES.PAYMENTS],
    tags: [CAPABILITY_TAGS.OAUTH, CAPABILITY_TAGS.REST_API],
    priority: 85,
  },

  // Text Processor → Utilities
  {
    match: (block) => block.type === 'text_processor',
    categories: [PRIMARY_CATEGORIES.UTILITIES],
    tags: [CAPABILITY_TAGS.DATA_PROCESSING, CAPABILITY_TAGS.DATA_TRANSFORMATION],
    priority: 75,
  },

  // CSV Processor → Utilities + Data Files
  {
    match: (block) => block.type === 'csv_processor',
    categories: [PRIMARY_CATEGORIES.UTILITIES, PRIMARY_CATEGORIES.DATA_FILES],
    tags: [CAPABILITY_TAGS.DATA_PROCESSING, CAPABILITY_TAGS.DATA_TRANSFORMATION],
    priority: 75,
  },

  // AI Guardrails → Utilities (safety validation for AI inputs/outputs)
  {
    match: (block) => block.type === 'ai_guardrails',
    categories: [PRIMARY_CATEGORIES.UTILITIES],
    tags: [CAPABILITY_TAGS.DATA_TRANSFORMATION],
    priority: 75,
  },
]
