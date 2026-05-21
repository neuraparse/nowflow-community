/**
 * Blocks Registry
 *
 */
// Import all blocks directly here
import { ActiveCampaignBlock } from './blocks/activecampaign'
import { AdobeCreativeCloudBlock } from './blocks/adobe-creative-cloud'
import { AdyenBlock } from './blocks/adyen'
import { AgentBlock } from './blocks/agent'
import { AgentMessageBlock } from './blocks/agent_message'
import { AIGuardrailsBlock } from './blocks/ai_guardrails'
import { AirtableBlock } from './blocks/airtable'
import { AmplitudeBlock } from './blocks/amplitude'
import { AnthropicBlock } from './blocks/anthropic'
import { ApiBlock } from './blocks/api'
import { ApprovalBlock } from './blocks/approval'
import { AsanaBlock } from './blocks/asana'
import { BambooHRBlock } from './blocks/bamboohr'
import { BasecampBlock } from './blocks/basecamp'
import { BinanceBlock } from './blocks/binance'
import { BitbucketBlock } from './blocks/bitbucket'
// import { AutoblocksBlock } from './blocks/autoblocks'
import { BoxBlock } from './blocks/box'
import { BrevoBlock } from './blocks/brevo'
import { ByBitBlock } from './blocks/bybit'
import { CalendlyBlock } from './blocks/calendly'
import { CanvaBlock } from './blocks/canva'
import { ClayBlock } from './blocks/clay'
import { ClickUpBlock } from './blocks/clickup'
import { CloseBlock } from './blocks/close'
import { CodaBlock } from './blocks/coda'
import { CohereBlock } from './blocks/cohere'
import { CoinbaseBlock } from './blocks/coinbase'
import { ConditionBlock } from './blocks/condition'
import { ConfluenceBlock } from './blocks/confluence'
import { ContentCreationAgentBlock } from './blocks/content_creation_agent'
import { ContentfulBlock } from './blocks/contentful'
import { ConvertKitBlock } from './blocks/convertkit'
import { CopperBlock } from './blocks/copper'
import { CSVProcessorBlock } from './blocks/csv_processor'
import { CustomerServiceAgentBlock } from './blocks/customer_service_agent'
import { DataTableBlock } from './blocks/data-table'
import { DataAnalysisAgentBlock } from './blocks/data_analysis_agent'
import { DiscordBlock } from './blocks/discord'
import { DropboxBlock } from './blocks/dropbox'
import { DyteBlock } from './blocks/dyte'
import { ElevenLabsBlock } from './blocks/elevenlabs'
import { EvaluatorBlock } from './blocks/evaluator'
import { FacebookBlock } from './blocks/facebook'
import { FigmaBlock } from './blocks/figma'
import { FileBlock } from './blocks/file'
import { FileOperationsBlock } from './blocks/file_operations'
import { FlyioBlock } from './blocks/flyio'
import { FreshBooksBlock } from './blocks/freshbooks'
import { FreshdeskBlock } from './blocks/freshdesk'
import { FunctionBlock } from './blocks/function'
import { FunctionCallingAgentBlock } from './blocks/function_calling_agent'
import { GeminiBlock } from './blocks/gemini'
import { GitHubBlock } from './blocks/github'
import { GitLabBlock } from './blocks/gitlab'
import { GmailBlock } from './blocks/gmail'
import { GoogleCalendarBlock } from './blocks/google_calendar'
import { GoogleDocsBlock } from './blocks/google_docs'
import { GoogleDriveBlock } from './blocks/google_drive'
import { GoogleSheetsBlock } from './blocks/google_sheets'
import { GustoBlock } from './blocks/gusto'
import { HubSpotBlock } from './blocks/hubspot'
import { HumanAgentBlock } from './blocks/human_agent'
// import { GuestyBlock } from './blocks/guesty'
import { ImageGeneratorBlock } from './blocks/image_generator'
import { InstagramBlock } from './blocks/instagram'
import { InteractiveBrokersBlock } from './blocks/interactive-brokers'
import { IntercomBlock } from './blocks/intercom'
import { JiraBlock } from './blocks/jira'
import { JSONProcessorBlock } from './blocks/json_processor'
import { KlaviyoBlock } from './blocks/klaviyo'
import { KrakenBlock } from './blocks/kraken'
import { LemonSqueezyBlock } from './blocks/lemonsqueezy'
import { LinearBlock } from './blocks/linear'
import { LinkedInBlock } from './blocks/linkedin'
import { LoomBlock } from './blocks/loom'
import { LoopBlock } from './blocks/loop'
import { MailchimpBlock } from './blocks/mailchimp'
import { MailgunBlock } from './blocks/mailgun'
import { MathBlock } from './blocks/math'
import { Mem0Block } from './blocks/mem0'
import { MiroBlock } from './blocks/miro'
import { MistralParseBlock } from './blocks/mistral_parse'
import { MondayBlock } from './blocks/monday'
import { MongoDBBlock } from './blocks/mongodb'
import { NeonBlock } from './blocks/neon'
import { NotionBlock } from './blocks/notion'
import { OneDriveBlock } from './blocks/onedrive'
import { OpenAIBlock } from './blocks/openai'
import { OutlookBlock } from './blocks/outlook'
import { PaddleBlock } from './blocks/paddle'
import { PayPalBlock } from './blocks/paypal'
import { PIIMaskBlock } from './blocks/pii-mask'
import { PineconeBlock } from './blocks/pinecone'
import { PipedriveBlock } from './blocks/pipedrive'
import { PlanetScaleBlock } from './blocks/planetscale'
import { PostHogBlock } from './blocks/posthog'
import { PostmarkBlock } from './blocks/postmark'
import { QuickBooksBlock } from './blocks/quickbooks'
import { RAGAgentBlock } from './blocks/rag_agent'
import { RailwayBlock } from './blocks/railway'
import { ReasoningAgentBlock } from './blocks/reasoning_agent'
import { RedditBlock } from './blocks/reddit'
import { RenderBlock } from './blocks/render'
import { ReplicateBlock } from './blocks/replicate'
import { ResendBlock } from './blocks/resend'
import { RetoolBlock } from './blocks/retool'
import { RobinhoodBlock } from './blocks/robinhood'
import { RouterBlock } from './blocks/router'
import { S3Block } from './blocks/s3'
import { SalesAgentBlock } from './blocks/sales_agent'
import { SalesforceBlock } from './blocks/salesforce'
import { SanityBlock } from './blocks/sanity'
import { SAPODataBlock } from './blocks/sap'
import { SAPAribaBlock } from './blocks/sap-ariba'
import { SAPBusinessOneBlock } from './blocks/sap-business-one'
import { SAPConcurBlock } from './blocks/sap-concur'
import { SAPFieldglassBlock } from './blocks/sap-fieldglass'
import { SAPS4HANABlock } from './blocks/sap-s4hana'
import { SAPSuccessFactorsBlock } from './blocks/sap-successfactors'
import { SegmentBlock } from './blocks/segment'
import { SendAndWaitBlock } from './blocks/send_and_wait'
import { SendGridBlock } from './blocks/sendgrid'
import { ServiceNowBlock } from './blocks/servicenow'
import { SharedMemoryBlock } from './blocks/shared_memory'
import { SharePointBlock } from './blocks/sharepoint'
import { ShopifyBlock } from './blocks/shopify'
import { SlackBlock } from './blocks/slack'
import { SmartsheetBlock } from './blocks/smartsheet'
import { SpeechToTextBlock } from './blocks/speech_to_text'
import { SQLiteBlock } from './blocks/sqlite'
import { SquareBlock } from './blocks/square'
import { StarterBlock } from './blocks/starter'
import { StickyNoteBlock } from './blocks/sticky-note'
import { StrapiBlock } from './blocks/strapi'
import { StripeBlock } from './blocks/stripe'
import { SubWorkflowBlock } from './blocks/sub-workflow'
import { SupabaseBlock } from './blocks/supabase'
import { TeamsBlock } from './blocks/teams'
import { TelegramBlock } from './blocks/telegram'
import { TextProcessorBlock } from './blocks/text_processor'
import { TextToSpeechBlock } from './blocks/text_to_speech'
import { ThinkingBlock } from './blocks/thinking'
import { TimerBlock } from './blocks/timer'
import { TranslateBlock } from './blocks/translate'
import { TrelloBlock } from './blocks/trello'
import { TwilioSMSBlock } from './blocks/twilio'
import { TypeformBlock } from './blocks/typeform'
import { VariableBlock } from './blocks/variable'
import { VercelBlock } from './blocks/vercel'
import { VisionBlock } from './blocks/vision'
import { VonageBlock } from './blocks/vonage'
import { WhatsAppBlock } from './blocks/whatsapp'
import { WherebyBlock } from './blocks/whereby'
import { WiseBlock } from './blocks/wise'
import { WrikeBlock } from './blocks/wrike'
import { XBlock } from './blocks/x'
import { XeroBlock } from './blocks/xero'
import { YouTubeBlock } from './blocks/youtube'
import { ZapierBlock } from './blocks/zapier'
import { ZendeskBlock } from './blocks/zendesk'
import { ZohoBooksBlock } from './blocks/zoho-books'
import { ZohoCRMBlock } from './blocks/zoho-crm'
import { ZoomBlock } from './blocks/zoom'
import { CapabilityTag, IndustryCategory, PrimaryCategory } from './categories'
// Import category engine
import { categoryEngine, EnrichedBlockMetadata } from './category-engine'
import { BlockConfig } from './types'

// Registry of all available blocks, alphabetically sorted
export const registry: Record<string, BlockConfig> = {
  agent: AgentBlock,
  agent_message: AgentMessageBlock,
  airtable: AirtableBlock,
  anthropic: AnthropicBlock,
  api: ApiBlock,
  approval: ApprovalBlock,
  asana: AsanaBlock,
  // autoblocks: AutoblocksBlock,
  box: BoxBlock,
  calendly: CalendlyBlock,
  clay: ClayBlock,
  condition: ConditionBlock,
  confluence: ConfluenceBlock,
  content_creation_agent: ContentCreationAgentBlock,
  csv_processor: CSVProcessorBlock,
  customer_service_agent: CustomerServiceAgentBlock,
  data_analysis_agent: DataAnalysisAgentBlock,
  dropbox: DropboxBlock,
  elevenlabs: ElevenLabsBlock,
  evaluator: EvaluatorBlock,
  facebook: FacebookBlock,
  file: FileBlock,
  file_operations: FileOperationsBlock,
  function: FunctionBlock,
  function_calling_agent: FunctionCallingAgentBlock,
  github: GitHubBlock,
  gmail: GmailBlock,
  google_docs: GoogleDocsBlock,
  google_drive: GoogleDriveBlock,
  google_sheets: GoogleSheetsBlock,
  google_calendar: GoogleCalendarBlock,
  human_agent: HumanAgentBlock,
  hubspot: HubSpotBlock,
  // guesty: GuestyBlock,
  image_generator: ImageGeneratorBlock,
  jira: JiraBlock,
  json_processor: JSONProcessorBlock,
  linear: LinearBlock,
  linkedin: LinkedInBlock,
  loop: LoopBlock,
  mailchimp: MailchimpBlock,
  math: MathBlock,
  mem0: Mem0Block,
  mistral_parse: MistralParseBlock,
  mongodb: MongoDBBlock,
  notion: NotionBlock,
  onedrive: OneDriveBlock,
  openai: OpenAIBlock,
  outlook: OutlookBlock,
  pinecone: PineconeBlock,
  pipedrive: PipedriveBlock,
  rag_agent: RAGAgentBlock,
  reasoning_agent: ReasoningAgentBlock,
  reddit: RedditBlock,
  router: RouterBlock,
  s3: S3Block,
  sales_agent: SalesAgentBlock,
  salesforce: SalesforceBlock,
  sap_odata: SAPODataBlock,
  sap_s4hana: SAPS4HANABlock,
  sap_successfactors: SAPSuccessFactorsBlock,
  sap_concur: SAPConcurBlock,
  sap_ariba: SAPAribaBlock,
  sap_fieldglass: SAPFieldglassBlock,
  sap_business_one: SAPBusinessOneBlock,
  figma: FigmaBlock,
  canva: CanvaBlock,
  bitbucket: BitbucketBlock,
  adobe_creative_cloud: AdobeCreativeCloudBlock,
  paypal: PayPalBlock,
  square: SquareBlock,
  vonage: VonageBlock,
  gemini: GeminiBlock,
  zapier: ZapierBlock,
  send_and_wait: SendAndWaitBlock,
  sendgrid: SendGridBlock,
  servicenow: ServiceNowBlock,
  shared_memory: SharedMemoryBlock,
  sharepoint: SharePointBlock,
  shopify: ShopifyBlock,
  speech_to_text: SpeechToTextBlock,
  slack: SlackBlock,
  sqlite: SQLiteBlock,
  starter: StarterBlock,
  stripe: StripeBlock,
  supabase: SupabaseBlock,
  telegram: TelegramBlock,
  teams: TeamsBlock,
  text_processor: TextProcessorBlock,
  text_to_speech: TextToSpeechBlock,
  thinking: ThinkingBlock,
  timer: TimerBlock,
  translate: TranslateBlock,
  trello: TrelloBlock,
  twilio_sms: TwilioSMSBlock,
  typeform: TypeformBlock,
  zendesk: ZendeskBlock,
  clickup: ClickUpBlock,
  intercom: IntercomBlock,
  monday: MondayBlock,
  zoom: ZoomBlock,
  variable: VariableBlock,
  vision: VisionBlock,
  whatsapp: WhatsAppBlock,
  x: XBlock,
  youtube: YouTubeBlock,
  instagram: InstagramBlock,
  discord: DiscordBlock,
  gitlab: GitLabBlock,
  quickbooks: QuickBooksBlock,
  xero: XeroBlock,
  miro: MiroBlock,
  loom: LoomBlock,
  freshbooks: FreshBooksBlock,
  zoho_books: ZohoBooksBlock,
  basecamp: BasecampBlock,
  smartsheet: SmartsheetBlock,
  coda: CodaBlock,
  cohere: CohereBlock,
  replicate: ReplicateBlock,
  vercel: VercelBlock,
  railway: RailwayBlock,
  render: RenderBlock,
  neon: NeonBlock,
  planetscale: PlanetScaleBlock,
  activecampaign: ActiveCampaignBlock,
  klaviyo: KlaviyoBlock,
  convertkit: ConvertKitBlock,
  brevo: BrevoBlock,
  contentful: ContentfulBlock,
  sanity: SanityBlock,
  strapi: StrapiBlock,
  lemonsqueezy: LemonSqueezyBlock,
  paddle: PaddleBlock,
  dyte: DyteBlock,
  whereby: WherebyBlock,
  resend: ResendBlock,
  segment: SegmentBlock,
  amplitude: AmplitudeBlock,
  posthog: PostHogBlock,
  retool: RetoolBlock,
  mailgun: MailgunBlock,
  postmark: PostmarkBlock,
  flyio: FlyioBlock,
  zoho_crm: ZohoCRMBlock,
  copper: CopperBlock,
  close: CloseBlock,
  wrike: WrikeBlock,
  gusto: GustoBlock,
  bamboohr: BambooHRBlock,
  freshdesk: FreshdeskBlock,
  adyen: AdyenBlock,
  wise: WiseBlock,
  binance: BinanceBlock,
  coinbase: CoinbaseBlock,
  kraken: KrakenBlock,
  bybit: ByBitBlock,
  interactive_brokers: InteractiveBrokersBlock,
  robinhood: RobinhoodBlock,
  data_table: DataTableBlock,
  pii_mask: PIIMaskBlock,
  'sticky-note': StickyNoteBlock,
  'sub-workflow': SubWorkflowBlock,
  ai_guardrails: AIGuardrailsBlock,
}

// Modern category definitions with better organization
export const BLOCK_CATEGORIES = {
  CORE_FLOW: 'core_flow',
  AGENTS: 'agents',
  INTEGRATIONS: 'integrations',
  DATA_FILES: 'data_files',
  VISION_MEDIA: 'vision_media',
  UTILITIES: 'utilities',
} as const

export type ModernBlockCategory = (typeof BLOCK_CATEGORIES)[keyof typeof BLOCK_CATEGORIES]

// Data & Files blocks
const DATA_BLOCKS = new Set([
  'airtable',
  'data_table',
  'mongodb',
  'pinecone',
  's3',
  'sqlite',
  'supabase',
  'file',
  'file_operations',
  'csv_processor',
  'json_processor',
])

// Vision & Media blocks
const VISION_MEDIA_BLOCKS = new Set(['vision', 'image_generator', 'elevenlabs'])

// Core Flow blocks
const CORE_FLOW_BLOCKS = new Set([
  'starter',
  'router',
  'condition',
  'loop',
  'function',
  'evaluator',
  'timer',
  'variable',
  'send_and_wait',
])

// Utility blocks — used for sidebar "Utilities" category.
// Note: isUtility: true in block definitions is a SEPARATE concept that controls
// compact chip rendering + QuickAdd panel. api and mem0 are categorised here for
// the sidebar but do NOT render as utility chips.
const UTILITY_BLOCKS = new Set([
  'api',
  'text_processor',
  'translate',
  'math',
  'mistral_parse',
  'json_processor',
  'csv_processor',
  'variable',
  'data_table',
  'shared_memory',
  'pii_mask',
  'mem0',
])

// Helper functions to access the registry with improved performance
export const getBlock = (type: string): BlockConfig | undefined => registry[type]

export const getBlocksByCategory = (category: ModernBlockCategory | string): BlockConfig[] => {
  return Object.values(registry).filter((block) => {
    switch (category) {
      case BLOCK_CATEGORIES.CORE_FLOW:
        return CORE_FLOW_BLOCKS.has(block.type)

      case BLOCK_CATEGORIES.AGENTS:
        return block.category === 'agents' || block.type.includes('_agent')

      case BLOCK_CATEGORIES.DATA_FILES:
        return DATA_BLOCKS.has(block.type)

      case BLOCK_CATEGORIES.VISION_MEDIA:
        return VISION_MEDIA_BLOCKS.has(block.type)

      case BLOCK_CATEGORIES.UTILITIES:
        return UTILITY_BLOCKS.has(block.type)

      case BLOCK_CATEGORIES.INTEGRATIONS:
        return (
          block.category === 'tools' &&
          !DATA_BLOCKS.has(block.type) &&
          !VISION_MEDIA_BLOCKS.has(block.type) &&
          !UTILITY_BLOCKS.has(block.type)
        )

      // Legacy support
      case 'blocks':
        return CORE_FLOW_BLOCKS.has(block.type)
      case 'agents':
        return block.category === 'agents' || block.type.includes('_agent')
      case 'tools':
        return block.category === 'tools' && !DATA_BLOCKS.has(block.type)
      case 'data':
        return DATA_BLOCKS.has(block.type)
      case 'integrations':
        return (
          block.category === 'tools' &&
          !DATA_BLOCKS.has(block.type) &&
          !VISION_MEDIA_BLOCKS.has(block.type) &&
          !UTILITY_BLOCKS.has(block.type)
        )

      default:
        return false
    }
  })
}

// ============================================================================
// ENHANCED DYNAMIC CATEGORY FUNCTIONS
// ============================================================================

/**
 * Get blocks by primary category using the new category engine
 */
export const getBlocksByPrimaryCategory = (category: PrimaryCategory): EnrichedBlockMetadata[] => {
  return categoryEngine.getBlocksByPrimaryCategory(getAllBlocks(), category)
}

/**
 * Get blocks by industry category using the new category engine
 */
export const getBlocksByIndustryCategory = (
  category: IndustryCategory
): EnrichedBlockMetadata[] => {
  return categoryEngine.getBlocksByIndustryCategory(getAllBlocks(), category)
}

/**
 * Get blocks by capability tag
 */
export const getBlocksByCapability = (tag: CapabilityTag): EnrichedBlockMetadata[] => {
  return categoryEngine.getBlocksByCapability(getAllBlocks(), tag)
}

/**
 * Search blocks with intelligent ranking
 */
export const searchBlocks = (query: string): EnrichedBlockMetadata[] => {
  return categoryEngine.searchBlocks(getAllBlocks(), query)
}

/**
 * Get enriched block metadata
 */
export const getEnrichedBlock = (type: string): EnrichedBlockMetadata | undefined => {
  const block = getBlock(type)
  if (!block) return undefined
  return categoryEngine.enrichBlock(block)
}

/**
 * Get all enriched blocks
 */
export const getAllEnrichedBlocks = (): EnrichedBlockMetadata[] => {
  return getAllBlocks().map((block) => categoryEngine.enrichBlock(block))
}

/**
 * Get suggested blocks based on context
 */
export const getSuggestedBlocks = (context: {
  recentlyUsed?: string[]
  currentCategories?: (PrimaryCategory | IndustryCategory)[]
  currentTags?: CapabilityTag[]
}): EnrichedBlockMetadata[] => {
  return categoryEngine.getSuggestedBlocks(getAllBlocks(), context)
}

/**
 * Filter blocks by multiple criteria
 */
export const filterBlocks = (filter: {
  primaryCategories?: PrimaryCategory[]
  industryCategories?: IndustryCategory[]
  capabilityTags?: CapabilityTag[]
  searchQuery?: string
  excludeHidden?: boolean
  includeCompliance?: boolean
  riskLevels?: ('low' | 'medium' | 'high' | 'extreme')[]
}): EnrichedBlockMetadata[] => {
  return categoryEngine.filterBlocks(getAllBlocks(), filter)
}

export const getAllBlockTypes = (): string[] => Object.keys(registry)

export const isValidBlockType = (type: string): type is keyof typeof registry => type in registry

export const getAllBlocks = (): BlockConfig[] => Object.values(registry)

// New utility functions for better block management
export const getBlocksBySearch = (searchTerm: string): BlockConfig[] => {
  const term = searchTerm.toLowerCase()
  return Object.values(registry).filter(
    (block) =>
      block.name.toLowerCase().includes(term) ||
      block.description.toLowerCase().includes(term) ||
      block.type.toLowerCase().includes(term)
  )
}

export const getBlocksByTags = (tags: string[]): BlockConfig[] => {
  return Object.values(registry).filter((block) =>
    tags.some(
      (tag) => block.type.includes(tag) || block.name.toLowerCase().includes(tag.toLowerCase())
    )
  )
}

export const getRecentlyUsedBlocks = (recentTypes: string[]): BlockConfig[] => {
  return recentTypes.map((type) => registry[type]).filter(Boolean)
}

// Performance optimized category getter with memoization
const categoryCache = new Map<string, BlockConfig[]>()

export const getCachedBlocksByCategory = (
  category: ModernBlockCategory | string
): BlockConfig[] => {
  if (categoryCache.has(category)) {
    return categoryCache.get(category)!
  }

  const blocks = getBlocksByCategory(category)
  categoryCache.set(category, blocks)
  return blocks
}

// Clear cache when registry changes (for development)
export const clearCategoryCache = (): void => {
  categoryCache.clear()
}
