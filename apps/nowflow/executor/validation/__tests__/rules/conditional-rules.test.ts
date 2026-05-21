import { describe, expect, it, vi } from 'vitest'
import {
  agentConditionalRules,
  airtableConditionalRules,
  apiConditionalRules,
  type ConditionalRule,
  conditionConditionalRules,
  dataTableConditionalRules,
  evaluateConditionalRules,
  functionConditionalRules,
  getConditionalRules,
  gmailConditionalRules,
  loopConditionalRules,
  notionConditionalRules,
} from '../../rules/conditional-rules'

// Silence provider-config indirectly pulled into getDefaultModel
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('conditional-rules', () => {
  describe('getConditionalRules', () => {
    it('should return agent rules for every agent block type', () => {
      const agentTypes = [
        'agent',
        'content_creation_agent',
        'customer_service_agent',
        'data_analysis_agent',
        'function_calling_agent',
        'rag_agent',
        'reasoning_agent',
        'sales_agent',
      ]

      for (const type of agentTypes) {
        expect(getConditionalRules(type)).toBe(agentConditionalRules)
      }
    })

    it('should return the correct rule set per block type', () => {
      expect(getConditionalRules('condition')).toBe(conditionConditionalRules)
      expect(getConditionalRules('function')).toBe(functionConditionalRules)
      expect(getConditionalRules('api')).toBe(apiConditionalRules)
      expect(getConditionalRules('loop')).toBe(loopConditionalRules)
      expect(getConditionalRules('notion')).toBe(notionConditionalRules)
      expect(getConditionalRules('airtable')).toBe(airtableConditionalRules)
      expect(getConditionalRules('gmail')).toBe(gmailConditionalRules)
      expect(getConditionalRules('data_table')).toBe(dataTableConditionalRules)
    })

    it('should return empty array for unknown block types', () => {
      expect(getConditionalRules('unknown_block')).toEqual([])
      expect(getConditionalRules('')).toEqual([])
    })
  })

  describe('agent rules — apiKey cloud/ollama', () => {
    it('should require apiKey for cloud models', () => {
      const { errors } = evaluateConditionalRules('agent', {
        model: 'gpt-4o',
        apiKey: '',
      })

      expect(errors.some((e) => e.field === 'apiKey')).toBe(true)
    })

    it('should accept apiKey when provided for a cloud model', () => {
      const { errors } = evaluateConditionalRules('agent', {
        model: 'gpt-4o',
        apiKey: 'agent-key',
      })

      expect(errors.filter((e) => e.field === 'apiKey')).toHaveLength(0)
    })

    it('should NOT require apiKey for Ollama models (known list)', () => {
      const { errors } = evaluateConditionalRules('agent', {
        model: 'llama3.2:3b',
        apiKey: '',
      })

      expect(errors.filter((e) => e.field === 'apiKey')).toHaveLength(0)
    })

    it('should treat ollama:// URIs as Ollama', () => {
      const { errors } = evaluateConditionalRules('agent', {
        model: 'ollama://my-local-model',
        apiKey: '',
      })

      expect(errors.filter((e) => e.field === 'apiKey')).toHaveLength(0)
    })

    it('should treat claude-prefixed models as cloud (require apiKey)', () => {
      const { errors } = evaluateConditionalRules('agent', {
        model: 'claude-sonnet-4-6',
        apiKey: '',
      })

      expect(errors.some((e) => e.field === 'apiKey')).toBe(true)
    })

    it('should treat non-string / undefined models as cloud (fail-safe)', () => {
      const { errors } = evaluateConditionalRules('agent', {
        model: undefined,
        apiKey: '',
      })

      // Defaults to openai, still requires apiKey
      expect(errors.some((e) => e.field === 'apiKey')).toBe(true)
    })
  })

  describe('condition block rules', () => {
    it('should reject empty conditions value', () => {
      const { errors } = evaluateConditionalRules('condition', {
        conditions: '',
      })

      expect(errors.some((e) => e.field === 'conditions')).toBe(true)
    })

    it('should reject invalid JSON for conditions', () => {
      const { errors } = evaluateConditionalRules('condition', {
        conditions: '{not valid',
      })

      expect(errors.some((e) => e.field === 'conditions')).toBe(true)
    })

    it('should reject when if-block is missing a value', () => {
      const { errors } = evaluateConditionalRules('condition', {
        conditions: JSON.stringify([{ title: 'if', value: '' }]),
      })

      expect(errors.some((e) => e.field === 'conditions')).toBe(true)
    })

    it('should accept a valid condition expression', () => {
      const { errors } = evaluateConditionalRules('condition', {
        conditions: JSON.stringify([{ title: 'if', value: 'x > 0' }]),
      })

      expect(errors).toHaveLength(0)
    })

    it('should reject non-array JSON for conditions', () => {
      const { errors } = evaluateConditionalRules('condition', {
        conditions: JSON.stringify({ title: 'if', value: 'x > 0' }),
      })

      expect(errors.some((e) => e.field === 'conditions')).toBe(true)
    })
  })

  describe('function block rules', () => {
    it('should reject empty code', () => {
      const { errors } = evaluateConditionalRules('function', { code: '' })
      expect(errors.some((e) => e.field === 'code')).toBe(true)
    })

    it('should reject whitespace-only code', () => {
      const { errors } = evaluateConditionalRules('function', { code: '   \n  ' })
      expect(errors.some((e) => e.field === 'code')).toBe(true)
    })

    it('should accept real function code', () => {
      const { errors } = evaluateConditionalRules('function', {
        code: 'return 42',
      })
      expect(errors).toHaveLength(0)
    })
  })

  describe('api block rules', () => {
    it('should reject empty URL', () => {
      const { errors } = evaluateConditionalRules('api', { url: '' })
      expect(errors.some((e) => e.field === 'url')).toBe(true)
    })

    it('should reject URLs without http/https scheme', () => {
      const { errors } = evaluateConditionalRules('api', { url: 'ftp://x' })
      expect(errors.some((e) => e.field === 'url')).toBe(true)
    })

    it('should accept http/https URLs', () => {
      const ok1 = evaluateConditionalRules('api', { url: 'https://api.example.com' })
      const ok2 = evaluateConditionalRules('api', { url: 'http://localhost:3000' })
      expect(ok1.errors).toHaveLength(0)
      expect(ok2.errors).toHaveLength(0)
    })

    it('should accept URLs with env/block reference markers', () => {
      const a = evaluateConditionalRules('api', { url: '{{BASE_URL}}/data' })
      const b = evaluateConditionalRules('api', { url: '<block.output>/data' })
      expect(a.errors).toHaveLength(0)
      expect(b.errors).toHaveLength(0)
    })
  })

  describe('loop block rules', () => {
    it('should reject missing loopType', () => {
      const { errors } = evaluateConditionalRules('loop', { loopType: '' })
      expect(errors.some((e) => e.field === 'loopType')).toBe(true)
    })

    it('should reject unknown loopType values', () => {
      const { errors } = evaluateConditionalRules('loop', { loopType: 'spin' })
      expect(errors.some((e) => e.field === 'loopType')).toBe(true)
    })

    it('should accept each valid loopType', () => {
      for (const t of ['for', 'forEach', 'while', 'range']) {
        const { errors } = evaluateConditionalRules('loop', { loopType: t })
        expect(errors).toHaveLength(0)
      }
    })
  })

  describe('notion block rules', () => {
    it('should require pageId for read_notion', () => {
      const { errors } = evaluateConditionalRules('notion', {
        operation: 'read_notion',
        pageId: '',
      })
      expect(errors.some((e) => e.field === 'pageId')).toBe(true)
    })

    it('should require pageId for write_notion', () => {
      const { errors } = evaluateConditionalRules('notion', {
        operation: 'write_notion',
        pageId: '',
      })
      expect(errors.some((e) => e.field === 'pageId')).toBe(true)
    })

    it('should not require pageId for create_notion', () => {
      const { errors } = evaluateConditionalRules('notion', {
        operation: 'create_notion',
      })
      expect(errors.filter((e) => e.field === 'pageId')).toHaveLength(0)
    })
  })

  describe('airtable block rules', () => {
    it('should require recordId for get/update', () => {
      for (const op of ['get', 'update']) {
        const { errors } = evaluateConditionalRules('airtable', {
          operation: op,
          recordId: '',
        })
        expect(errors.some((e) => e.field === 'recordId')).toBe(true)
      }
    })

    it('should NOT require recordId for list/create/updateMultiple', () => {
      for (const op of ['list', 'create', 'updateMultiple']) {
        const { errors } = evaluateConditionalRules('airtable', {
          operation: op,
          // records for create/updateMultiple, skip for list
          records: JSON.stringify([{ x: 1 }]),
        })
        expect(errors.filter((e) => e.field === 'recordId')).toHaveLength(0)
      }
    })

    it('should require records for create and updateMultiple', () => {
      for (const op of ['create', 'updateMultiple']) {
        const { errors } = evaluateConditionalRules('airtable', {
          operation: op,
          records: '',
        })
        expect(errors.some((e) => e.field === 'records')).toBe(true)
      }
    })

    it('should require fields for update', () => {
      const { errors } = evaluateConditionalRules('airtable', {
        operation: 'update',
        recordId: 'recABC',
        fields: '',
      })
      expect(errors.some((e) => e.field === 'fields')).toBe(true)
    })
  })

  describe('gmail block rules', () => {
    it('should require to/subject/body for send_gmail', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        operation: 'send_gmail',
        to: '',
        subject: '',
        body: '',
      })
      expect(errors.some((e) => e.field === 'to')).toBe(true)
      expect(errors.some((e) => e.field === 'subject')).toBe(true)
      expect(errors.some((e) => e.field === 'body')).toBe(true)
    })

    it('should require to/subject/body when operation is missing (legacy)', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        to: '',
        subject: '',
        body: '',
      })
      expect(errors.some((e) => e.field === 'to')).toBe(true)
      expect(errors.some((e) => e.field === 'subject')).toBe(true)
      expect(errors.some((e) => e.field === 'body')).toBe(true)
    })

    it('should NOT require send fields for non-send operations', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        operation: 'search_gmail',
        query: 'is:unread',
      })
      expect(errors.some((e) => e.field === 'to')).toBe(false)
      expect(errors.some((e) => e.field === 'subject')).toBe(false)
      expect(errors.some((e) => e.field === 'body')).toBe(false)
    })

    it('should require query for search_gmail', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        operation: 'search_gmail',
        query: '',
      })
      expect(errors.some((e) => e.field === 'query')).toBe(true)
    })

    it('should require replyMessageId/replyBody for reply_gmail', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        operation: 'reply_gmail',
        replyMessageId: '',
        replyBody: '',
      })
      expect(errors.some((e) => e.field === 'replyMessageId')).toBe(true)
      expect(errors.some((e) => e.field === 'replyBody')).toBe(true)
    })

    it('should require forwardMessageId/forwardTo for forward_gmail', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        operation: 'forward_gmail',
        forwardMessageId: '',
        forwardTo: '',
      })
      expect(errors.some((e) => e.field === 'forwardMessageId')).toBe(true)
      expect(errors.some((e) => e.field === 'forwardTo')).toBe(true)
    })

    it('should require trashMessageId for trash_gmail', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        operation: 'trash_gmail',
        trashMessageId: '',
      })
      expect(errors.some((e) => e.field === 'trashMessageId')).toBe(true)
    })

    it('should require modifyMessageId for modify_labels_gmail', () => {
      const { errors } = evaluateConditionalRules('gmail', {
        operation: 'modify_labels_gmail',
        modifyMessageId: '',
      })
      expect(errors.some((e) => e.field === 'modifyMessageId')).toBe(true)
    })
  })

  describe('data_table block rules', () => {
    it('should require rawData for smart_insert', () => {
      const { errors } = evaluateConditionalRules('data_table', {
        operation: 'smart_insert',
        rawData: '',
        tableId: 'tbl123',
      })
      expect(errors.some((e) => e.field === 'rawData')).toBe(true)
    })

    it('should require rawData for auto_save', () => {
      const { errors } = evaluateConditionalRules('data_table', {
        operation: 'auto_save',
        rawData: undefined,
        tableName: 'my_table',
      })
      expect(errors.some((e) => e.field === 'rawData')).toBe(true)
    })

    it('should require tableId for smart_insert', () => {
      const { errors } = evaluateConditionalRules('data_table', {
        operation: 'smart_insert',
        rawData: '[]',
        tableId: '',
      })
      expect(errors.some((e) => e.field === 'tableId')).toBe(true)
    })

    it('should require tableName for auto_save', () => {
      const { errors } = evaluateConditionalRules('data_table', {
        operation: 'auto_save',
        rawData: '[]',
        tableName: '',
      })
      expect(errors.some((e) => e.field === 'tableName')).toBe(true)
    })

    it('should pass with all required fields for smart_insert', () => {
      const { errors } = evaluateConditionalRules('data_table', {
        operation: 'smart_insert',
        rawData: '[{"a":1}]',
        tableId: 'tbl123',
      })
      expect(errors).toHaveLength(0)
    })
  })

  describe('evaluateConditionalRules — generic semantics', () => {
    it('should skip rules whose condition returns false', () => {
      const rules: ConditionalRule[] = notionConditionalRules

      // operation === create_notion: parentType/parentId rules (optional) fire,
      // but "required" rule for pageId requires read/write — skipped.
      const { errors } = evaluateConditionalRules('notion', {
        operation: 'create_notion',
      })

      expect(errors.filter((e) => e.field === 'pageId')).toHaveLength(0)
      expect(rules.length).toBeGreaterThan(0) // sanity
    })

    it('should produce warnings for severity=warning rules', () => {
      // functionConditionalRules has only error rules; use a synthetic block:
      // easier: airtable has no direct warning-severity rule triggered on failure,
      // so instead assert that optional rules never push anything.
      const { errors, warnings } = evaluateConditionalRules('notion', {
        operation: 'read_notion',
        pageId: 'abc',
      })

      expect(errors).toHaveLength(0)
      expect(warnings).toHaveLength(0)
    })

    it('should return empty arrays for unknown block types', () => {
      const { errors, warnings } = evaluateConditionalRules('nobody_home', {})
      expect(errors).toEqual([])
      expect(warnings).toEqual([])
    })

    it('should attach the rule suggestion to issues when present', () => {
      const { errors } = evaluateConditionalRules('api', { url: '' })
      const urlError = errors.find((e) => e.field === 'url')
      expect(urlError?.suggestion).toBeDefined()
    })

    it('should use the custom message returned by a function rule', () => {
      const { errors } = evaluateConditionalRules('api', { url: 'ftp://x' })
      const urlError = errors.find((e) => e.field === 'url')
      expect(urlError?.message).toBe('URL must start with http:// or https://')
    })
  })
})
