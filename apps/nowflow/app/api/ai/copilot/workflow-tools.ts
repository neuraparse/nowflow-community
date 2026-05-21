import { createLogger } from '@/lib/logs/console-logger'
import { getAllBlocks, getBlock, isValidBlockType } from '@/blocks'
import type { BlockConfig } from '@/blocks/types'

const logger = createLogger('CopilotAPI')

// ---------------------------------------------------------------------------
// Utility block output field definitions
// ---------------------------------------------------------------------------

export const UTILITY_OUTPUT_FIELDS: Record<
  string,
  Array<{ path: string; label: string; type: string; primary?: boolean }>
> = {
  data_table: [
    { path: 'response.rows', label: 'Rows', type: 'json', primary: true },
    { path: 'response.totalRows', label: 'Total Rows', type: 'number' },
    { path: 'response.tables', label: 'Tables', type: 'json' },
    { path: 'response.row', label: 'Row', type: 'json' },
    { path: 'response.insertedRows', label: 'Inserted Rows', type: 'number' },
    { path: 'response.tableId', label: 'Table ID', type: 'string' },
    { path: 'response.tableName', label: 'Table Name', type: 'string' },
  ],
  variable: [
    { path: 'response.variableValue', label: 'Value', type: 'json', primary: true },
    { path: 'response.content', label: 'Summary', type: 'string' },
    { path: 'response.variableName', label: 'Variable Name', type: 'string' },
    { path: 'response.previousValue', label: 'Previous Value', type: 'json' },
  ],
  math: [
    { path: 'response.result', label: 'Result', type: 'number', primary: true },
    { path: 'response.expression', label: 'Expression', type: 'string' },
  ],
  json_processor: [
    { path: 'response.processedData', label: 'Processed Data', type: 'json', primary: true },
    { path: 'response.originalData', label: 'Original Data', type: 'json' },
  ],
  text_processor: [
    { path: 'response.processedText', label: 'Processed Text', type: 'string', primary: true },
    { path: 'response.metadata', label: 'Metadata', type: 'json' },
    { path: 'response.wordCount', label: 'Word Count', type: 'number' },
  ],
  csv_processor: [
    { path: 'response.data', label: 'Data', type: 'json', primary: true },
    { path: 'response.csv', label: 'CSV', type: 'string' },
    { path: 'response.stats', label: 'Stats', type: 'json' },
  ],
  translate: [
    { path: 'response.content', label: 'Translated Text', type: 'string', primary: true },
  ],
  pii_mask: [
    { path: 'response.maskedText', label: 'Masked Text', type: 'string', primary: true },
    { path: 'response.hasPII', label: 'Has PII', type: 'boolean' },
    { path: 'response.matchCount', label: 'Match Count', type: 'number' },
  ],
  shared_memory: [
    { path: 'response.value', label: 'Value', type: 'json', primary: true },
    { path: 'response.success', label: 'Success', type: 'boolean' },
    { path: 'response.key', label: 'Key', type: 'string' },
  ],
  mistral_parse: [
    { path: 'response.content', label: 'Content', type: 'string', primary: true },
    { path: 'response.metadata', label: 'Metadata', type: 'json' },
  ],
}

// ---------------------------------------------------------------------------
// Block catalog builder (cached)
// ---------------------------------------------------------------------------

let _blockCatalogCache: string | null = null

function buildSubBlockSummary(block: BlockConfig): string {
  return block.subBlocks
    .filter((sb) => !sb.hidden)
    .map((sb) => {
      let desc = `${sb.id}(${sb.type})`
      if (sb.type === 'dropdown' && sb.options && typeof sb.options !== 'function') {
        const opts = (sb.options as any[])
          .map((o: any) => (typeof o === 'object' ? o.id || o.label : String(o)))
          .slice(0, 8)
        if (opts.length > 0) desc += `=[${opts.join('|')}]`
      } else if (sb.type === 'slider') {
        desc += `[${sb.min ?? 0}-${sb.max ?? 1}]`
      }
      return desc
    })
    .join(', ')
}

export function buildBlockCatalog(): string {
  if (_blockCatalogCache) return _blockCatalogCache

  const blocks = getAllBlocks().filter((b) => !b.hideFromToolbar && b.type !== 'starter')

  const utilityBlocks = blocks.filter((b) => b.isUtility)
  const regularBlocks = blocks.filter((b) => !b.isUtility)

  const groups: Record<string, BlockConfig[]> = {}
  for (const block of regularBlocks) {
    const cat = block.category
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(block)
  }

  const categoryLabels: Record<string, string> = {
    blocks: 'Core Flow',
    tools: 'Tools & Integrations',
    data: 'Data & Storage',
    integrations: 'Integrations',
    agents: 'AI Agents',
  }

  let catalog = ''

  for (const [cat, items] of Object.entries(groups)) {
    catalog += `\n### ${categoryLabels[cat] || cat}\n`
    for (const item of items) {
      const subBlockInfo = buildSubBlockSummary(item)
      catalog += `- \`${item.type}\` — ${item.name}: ${item.description}\n`
      if (subBlockInfo) {
        catalog += `  Fields: ${subBlockInfo}\n`
      }
    }
  }

  if (utilityBlocks.length > 0) {
    catalog += `\n### ⚡ Helper / Utility Blocks (attach to any block via \`addUtilityBlock\`)\n`
    catalog += `These are compact helper blocks that attach BELOW a host block via a utility edge.\n`
    catalog += `Use \`addUtilityBlock\` to attach them. Their outputs can be referenced in the host block's inputs.\n\n`

    for (const item of utilityBlocks) {
      const subBlockInfo = buildSubBlockSummary(item)
      catalog += `- \`${item.type}\` — ${item.name}: ${item.description}\n`
      if (subBlockInfo) {
        catalog += `  Fields: ${subBlockInfo}\n`
      }

      const outputFields = UTILITY_OUTPUT_FIELDS[item.type]
      if (outputFields) {
        const primary = outputFields.find((f) => f.primary)
        const fieldSummary = outputFields
          .map((f) => `${f.label}(\`${f.path}\`${f.primary ? ' ★' : ''})`)
          .join(', ')
        catalog += `  Outputs: ${fieldSummary}\n`
        if (primary) {
          catalog += `  Primary output: \`${primary.path}\`\n`
        }
      }
    }
  }

  _blockCatalogCache = catalog
  return catalog
}

// ---------------------------------------------------------------------------
// Workflow tools definitions for function calling
// ---------------------------------------------------------------------------

export function buildWorkflowTools(): any[] {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'addBlock',
        description:
          'Add a new block to the workflow. ALWAYS provide an id so you can reference this block in addEdge and updateSubBlock calls.',
        parameters: {
          type: 'object',
          required: ['type', 'id'],
          properties: {
            id: {
              type: 'string',
              description:
                'A short reference ID you assign to this block (e.g., "agent_1", "slack_notifier"). Use this same ID in addEdge and updateSubBlock to reference this block.',
            },
            type: {
              type: 'string',
              description:
                'Block type identifier from the catalog (e.g., "agent", "slack", "google_sheets", "condition", "function").',
            },
            name: {
              type: 'string',
              description: 'Optional custom display name for the block',
            },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'updateSubBlock',
        description:
          'Update a sub-block configuration value on an existing block. Use this to configure block parameters like model selection, prompts, API keys, temperatures, etc. You can call this multiple times to configure multiple fields.',
        parameters: {
          type: 'object',
          required: ['blockId', 'subBlockId', 'value'],
          properties: {
            blockId: {
              type: 'string',
              description:
                'ID of the block to configure. Use the exact block ID from the Current Workflow State (the value inside backticks after "id:").',
            },
            subBlockId: {
              type: 'string',
              description:
                'ID of the sub-block field to update — the field name shown before the parentheses in the workflow state (e.g., "model", "systemPrompt", "temperature", "channel")',
            },
            value: {
              oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
              description:
                'New value. String for text/dropdown inputs (use option ID for dropdowns), number for sliders, boolean for switches/checkboxes.',
            },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'addEdge',
        description: 'Create a connection (edge) between two blocks to define the workflow flow.',
        parameters: {
          type: 'object',
          required: ['sourceId', 'targetId'],
          properties: {
            sourceId: { type: 'string', description: 'ID of the source block (output side)' },
            targetId: { type: 'string', description: 'ID of the target block (input side)' },
            sourceHandle: {
              type: 'string',
              description:
                'Optional source handle for blocks with multiple outputs (e.g., condition true/false)',
            },
            targetHandle: {
              type: 'string',
              description: 'Optional target handle for blocks with multiple inputs',
            },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'removeBlock',
        description: 'Remove a block and its associated connections from the workflow.',
        parameters: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID of the block to remove' },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'removeEdge',
        description: 'Remove a specific connection (edge) between blocks.',
        parameters: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID of the edge to remove' },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'repositionBlock',
        description:
          'Move a block to a new position on the canvas. Use this to reorganize layout, align blocks, or create a clean visual flow. Coordinates are in pixels — typical spacing is 300px horizontal, 150px vertical.',
        parameters: {
          type: 'object',
          required: ['id', 'x', 'y'],
          properties: {
            id: {
              type: 'string',
              description: 'ID of the block to reposition',
            },
            x: {
              type: 'number',
              description: 'New X coordinate (horizontal position in pixels)',
            },
            y: {
              type: 'number',
              description: 'New Y coordinate (vertical position in pixels)',
            },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'insertBlock',
        description:
          'Insert a new block BETWEEN two existing connected blocks, or AFTER a specific block. The system automatically handles edge rewiring: removes the old edge between afterBlockId→beforeBlockId, creates edges afterBlockId→newBlock→beforeBlockId, and positions the new block between them. Use this when the user says "add between A and B", "insert after X", "put Y between A and B", etc.',
        parameters: {
          type: 'object',
          required: ['id', 'type', 'afterBlockId'],
          properties: {
            id: {
              type: 'string',
              description: 'A short reference ID for the new block (e.g., "new_agent")',
            },
            type: {
              type: 'string',
              description: 'Block type from the catalog',
            },
            name: {
              type: 'string',
              description: 'Optional display name for the new block',
            },
            afterBlockId: {
              type: 'string',
              description:
                'ID of the block AFTER which to insert (the predecessor). The new block will be placed after this block.',
            },
            beforeBlockId: {
              type: 'string',
              description:
                'ID of the block BEFORE which to insert (the successor). If provided, the edge from afterBlockId→beforeBlockId is removed and replaced with afterBlockId→newBlock→beforeBlockId. If omitted, the new block is just appended after afterBlockId.',
            },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'addUtilityBlock',
        description:
          'Attach a helper/utility block (compact chip) to a host block. Utility blocks provide data processing, storage, variables, math, text processing, etc. They connect via a special utility edge and their outputs can be referenced in the host block\'s input fields. Use this for: variable, data_table, math, text_processor, json_processor, csv_processor, translate, pii_mask, shared_memory, mistral_parse. For data_table, specify mode="write" to save host output to table, or mode="read" to query data for the host.',
        parameters: {
          type: 'object',
          required: ['id', 'type', 'hostBlockId'],
          properties: {
            id: {
              type: 'string',
              description: 'A short reference ID for this utility block (e.g., "var_1", "dt_save")',
            },
            type: {
              type: 'string',
              description:
                'Utility block type: variable, data_table, math, text_processor, json_processor, csv_processor, translate, pii_mask, shared_memory, mistral_parse',
            },
            hostBlockId: {
              type: 'string',
              description:
                'ID of the host block to attach this utility to. The utility will appear as a compact chip below this block.',
            },
            name: {
              type: 'string',
              description: 'Optional display name for the utility block',
            },
            mode: {
              type: 'string',
              enum: ['read', 'write'],
              description:
                'For data_table only: "write" saves host output to table (auto_save), "read" queries data from table (query_rows). Default: "read".',
            },
            outputFields: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Output field paths to inject into the host block\'s input (e.g., ["response.rows", "response.totalRows"]). If omitted, the primary output field is used automatically.',
            },
            injectIntoHost: {
              type: 'boolean',
              description:
                "Whether to auto-inject output references into the host block's best input field. Default: true.",
            },
          },
        },
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Format workflow state with full sub-block details
// ---------------------------------------------------------------------------

export function formatWorkflowState(workflowState: any): string {
  const blocks = workflowState.blocks || {}
  const edges = workflowState.edges || []
  const subBlockValues = workflowState.subBlockValues || {}

  const blockIds = Object.keys(blocks)
  if (blockIds.length === 0) return 'The workflow is empty. Start by adding blocks.'

  const formatSubBlockMeta = (sb: any): string => {
    let meta = sb.type as string
    if (sb.type === 'dropdown') {
      if (sb.options && typeof sb.options !== 'function') {
        const opts = (sb.options as any[])
          .map((o: any) => (typeof o === 'object' ? o.id || o.label : String(o)))
          .slice(0, 10)
        meta += `[${opts.join('|')}]`
      } else {
        meta += '[dynamic]'
      }
    } else if (sb.type === 'slider') {
      meta += `[${sb.min ?? 0}–${sb.max ?? 1}${sb.step ? `,step=${sb.step}` : ''}]`
    } else if (sb.type === 'switch' || sb.type === 'checkbox') {
      meta += '[true|false]'
    } else if (sb.type === 'code' && sb.language) {
      meta += `[${sb.language}]`
    }
    return meta
  }

  // Separate utility edges from regular edges
  const utilityEdges = edges.filter(
    (e: any) => e.sourceHandle === 'utility-source' || e.targetHandle === 'utility-target'
  )
  const regularEdges = edges.filter(
    (e: any) => e.sourceHandle !== 'utility-source' && e.targetHandle !== 'utility-target'
  )

  // Build a map of host block → attached utility blocks
  const utilityAttachments: Record<
    string,
    Array<{ utilityId: string; utilityType: string; utilityName: string }>
  > = {}
  for (const edge of utilityEdges) {
    const hostId = edge.target
    const utilityBlock = blocks[edge.source]
    if (!utilityBlock) continue
    if (!utilityAttachments[hostId]) utilityAttachments[hostId] = []
    utilityAttachments[hostId].push({
      utilityId: edge.source,
      utilityType: utilityBlock.type,
      utilityName: utilityBlock.name || utilityBlock.type,
    })
  }

  const utilityBlockIds = new Set(utilityEdges.map((e: any) => e.source))

  const formatBlockDetail = (block: any): string => {
    const blockConfig = getBlock(block.type)
    const isUtility = utilityBlockIds.has(block.id)
    const pos = block.position
      ? ` at (${Math.round(block.position.x)}, ${Math.round(block.position.y)})`
      : ''
    const utilityTag = isUtility ? ' ⚡UTILITY' : ''
    let detail = `- **${block.type}** "${block.name || 'unnamed'}" (id: \`${block.id}\`${pos})${utilityTag}`

    const values = subBlockValues[block.id]
    if (values && blockConfig) {
      const fields: string[] = []
      for (const sb of blockConfig.subBlocks) {
        if (sb.hidden) continue
        if (sb.condition) {
          const condVal = values[sb.condition.field]
          const condMatch = Array.isArray(sb.condition.value)
            ? sb.condition.value.includes(condVal)
            : condVal === sb.condition.value
          const visible = sb.condition.not ? !condMatch : condMatch
          if (!visible) continue
        }
        const val = values[sb.id]
        const typeMeta = formatSubBlockMeta(sb)
        if (val !== null && val !== undefined && val !== '') {
          const displayVal =
            typeof val === 'string' && val.length > 100 ? val.substring(0, 100) + '…' : String(val)
          fields.push(`    ${sb.id} (${typeMeta}): ${displayVal}`)
        } else {
          fields.push(`    ${sb.id} (${typeMeta}): ⚠ NOT SET`)
        }
      }
      if (fields.length > 0) {
        detail += '\n' + fields.join('\n')
      }
    } else if (block.subBlocks) {
      const fields: string[] = []
      for (const [sbId, sb] of Object.entries(block.subBlocks as Record<string, any>)) {
        if (sb.value !== null && sb.value !== undefined && sb.value !== '') {
          const displayVal =
            typeof sb.value === 'string' && sb.value.length > 100
              ? sb.value.substring(0, 100) + '…'
              : String(sb.value)
          fields.push(`    ${sbId}: ${displayVal}`)
        }
      }
      if (fields.length > 0) {
        detail += '\n' + fields.join('\n')
      }
    }

    const attachments = utilityAttachments[block.id]
    if (attachments && attachments.length > 0) {
      const attachList = attachments
        .map((a) => `    ⚡ attached: ${a.utilityType} "${a.utilityName}" (\`${a.utilityId}\`)`)
        .join('\n')
      detail += '\n' + attachList
    }

    return detail
  }

  const regularBlockDetails = Object.values(blocks)
    .filter((block: any) => !utilityBlockIds.has(block.id))
    .slice(0, 50)
    .map(formatBlockDetail)

  const utilityBlockDetails = Object.values(blocks)
    .filter((block: any) => utilityBlockIds.has(block.id))
    .slice(0, 20)
    .map(formatBlockDetail)

  const edgeSummary = regularEdges.slice(0, 60).map((edge: any) => {
    const srcBlock = blocks[edge.source]
    const tgtBlock = blocks[edge.target]
    const srcLabel = srcBlock ? `${srcBlock.type}(${edge.source})` : edge.source
    const tgtLabel = tgtBlock ? `${tgtBlock.type}(${edge.target})` : edge.target
    let desc = `- [edgeId: \`${edge.id}\`] ${srcLabel} → ${tgtLabel}`
    if (edge.sourceHandle) desc += ` [from: ${edge.sourceHandle}]`
    if (edge.targetHandle) desc += ` [to: ${edge.targetHandle}]`
    return desc
  })

  // Workflow health diagnostics
  const issues: string[] = []
  const blockSet = new Set(blockIds)

  for (const id of blockIds) {
    const block = blocks[id]
    if (block.type === 'starter') continue
    if (utilityBlockIds.has(id)) continue
    const hasEdge = regularEdges.some((e: any) => e.source === id || e.target === id)
    if (!hasEdge)
      issues.push(`⚠ Block "${block.name || block.type}" (\`${id}\`) is disconnected — no edges`)
  }

  for (const edge of edges) {
    if (!blockSet.has(edge.source))
      issues.push(`⚠ Edge references missing source block \`${edge.source}\``)
    if (!blockSet.has(edge.target))
      issues.push(`⚠ Edge references missing target block \`${edge.target}\``)
  }

  for (const id of blockIds) {
    const block = blocks[id]
    const config = getBlock(block.type)
    const vals = subBlockValues[id]
    if (!config || !vals) continue
    for (const sb of config.subBlocks) {
      if (sb.hidden) continue
      if (sb.type === 'long-input' || sb.type === 'short-input' || sb.type === 'dropdown') {
        const v = vals[sb.id]
        if (v === null || v === undefined || v === '') {
          issues.push(`⚠ ${block.type}(\`${id}\`).${sb.id} is not configured`)
        }
      }
    }
  }

  const totalRegular = Object.values(blocks).filter((b: any) => !utilityBlockIds.has(b.id)).length
  const totalUtility = utilityBlockIds.size

  const sections = [
    `**Blocks (${totalRegular} regular${totalUtility > 0 ? ` + ${totalUtility} utility` : ''}):**`,
    regularBlockDetails.join('\n'),
  ]

  if (utilityBlockDetails.length > 0) {
    sections.push(`\n**⚡ Utility Blocks (${totalUtility}):**`)
    sections.push(utilityBlockDetails.join('\n'))
  }

  sections.push(
    regularEdges.length > 0
      ? `\n**Connections (${regularEdges.length}${utilityEdges.length > 0 ? ` + ${utilityEdges.length} utility` : ''}):**`
      : '\n**No connections yet.** Use addEdge to connect blocks.'
  )
  if (regularEdges.length > 0) sections.push(edgeSummary.join('\n'))

  if (issues.length > 0) {
    sections.push(`\n**Health Issues (${issues.length}):**`)
    sections.push(issues.slice(0, 20).join('\n'))
  }

  return sections.filter(Boolean).join('\n')
}

// ---------------------------------------------------------------------------
// Validate actions returned by AI
// ---------------------------------------------------------------------------

export function validateActions(actions: any[] | undefined, workflowState: any): any[] {
  if (!actions) return []

  return actions
    .map((action: any) => {
      if (
        (action.name === 'addBlock' ||
          action.name === 'insertBlock' ||
          action.name === 'addUtilityBlock') &&
        action.parameters?.type
      ) {
        if (!isValidBlockType(action.parameters.type)) {
          logger.warn(
            `AI tried to ${action.name} with invalid block type: ${action.parameters.type}`
          )
          return null
        }
      }
      if (action.name === 'insertBlock' && !action.parameters?.afterBlockId) {
        logger.warn('AI tried insertBlock without required afterBlockId')
        return null
      }
      if (action.name === 'addUtilityBlock' && !action.parameters?.hostBlockId) {
        logger.warn('AI tried addUtilityBlock without required hostBlockId')
        return null
      }
      if (action.name === 'addUtilityBlock') {
        const blockConfig = getBlock(action.parameters?.type)
        if (!blockConfig?.isUtility) {
          logger.warn(
            `AI tried addUtilityBlock with non-utility block type: ${action.parameters?.type}`
          )
          return null
        }
      }
      return action
    })
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Fallback response when no AI provider is configured
// ---------------------------------------------------------------------------

export function generateFallbackResponse(message: string, context: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('help') || lower.includes('how')) {
    return `I'd love to help! Currently, you're in the **${(context || 'general').replace(/-/g, ' ')}** section. Here are some things you can do:\n\n- Use the sidebar to navigate between features\n- Check the documentation for detailed guides\n- Use keyboard shortcuts for faster navigation (\u2318B for sidebar, \u2318K for copilot)\n\nFor more specific help, please configure an AI API key in **Settings > AI Providers**.`
  }

  if (lower.includes('workflow') || lower.includes('create')) {
    return `To create a new workflow:\n\n1. Click the **+** button in the sidebar\n2. Add a **Starter** block to begin\n3. Connect blocks by dragging from output to input\n4. Configure each block using the right sidebar\n5. Click **Run** to test your workflow\n\nFor AI-assisted workflow building, configure an API key in **Settings > AI Providers**.`
  }

  return `I'm the NowFlow AI Copilot. To unlock my full capabilities, please configure an AI provider in **Settings > AI Providers**.\n\nOnce configured, I can help you build workflows, debug issues, analyze data, and much more across the entire platform. What would you like to know?`
}

// ---------------------------------------------------------------------------
// Providers that support function calling / tool use
// ---------------------------------------------------------------------------

export const TOOL_CAPABLE_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'groq',
  'together',
  'deepseek',
  'xai',
])
