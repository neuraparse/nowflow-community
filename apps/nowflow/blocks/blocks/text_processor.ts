import { FileTextIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface TextProcessorResponse extends ToolResponse {
  output: {
    content: string
    originalText: string
    processedText: string
    operation: string
    wordCount: number
    characterCount: number
    metadata: Record<string, any>
  }
}

export const TextProcessorBlock: BlockConfig<TextProcessorResponse> = {
  type: 'text_processor',
  name: 'Text Processor',
  description: 'Process and transform text',
  longDescription:
    'Process and transform text with various operations like formatting, cleaning, extracting, splitting, and analyzing. Supports regex operations, case transformations, and text analysis.',
  category: 'blocks',
  isUtility: true,
  bgColor: '#6366F1',
  icon: FileTextIcon,
  subBlocks: [
    {
      id: 'inputText',
      title: 'Input Text',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Hello World! Contact: john@example.com or visit https://example.com',
      rows: 4,
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Clean Text', id: 'clean' },
        { label: 'Extract Emails', id: 'extract_emails' },
        { label: 'Extract URLs', id: 'extract_urls' },
        { label: 'Extract Phone Numbers', id: 'extract_phones' },
        { label: 'Split Text', id: 'split' },
        { label: 'Replace Text', id: 'replace' },
        { label: 'Format Text', id: 'format' },
        { label: 'Analyze Text', id: 'analyze' },
        { label: 'Regex Match', id: 'regex_match' },
        { label: 'Regex Replace', id: 'regex_replace' },
      ],
    },
    {
      id: 'caseTransform',
      title: 'Case Transform',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'No Change', id: 'none' },
        { label: 'Uppercase', id: 'upper' },
        { label: 'Lowercase', id: 'lower' },
        { label: 'Title Case', id: 'title' },
        { label: 'Sentence Case', id: 'sentence' },
        { label: 'Camel Case', id: 'camel' },
        { label: 'Snake Case', id: 'snake' },
        { label: 'Kebab Case', id: 'kebab' },
      ],
    },
    {
      id: 'searchText',
      title: 'Search Text / Pattern',
      type: 'short-input',
      layout: 'half',
      placeholder: 'old text or \\d+ for numbers',
      condition: {
        field: 'operation',
        value: ['replace', 'regex_match', 'regex_replace'],
      },
    },
    {
      id: 'replaceText',
      title: 'Replace With',
      type: 'short-input',
      layout: 'half',
      placeholder: 'new text or ***',
      condition: {
        field: 'operation',
        value: ['replace', 'regex_replace'],
      },
    },
    {
      id: 'splitDelimiter',
      title: 'Split Delimiter',
      type: 'short-input',
      layout: 'half',
      placeholder: ', or \\n or ;',
      condition: {
        field: 'operation',
        value: ['split'],
      },
    },
    {
      id: 'maxSplits',
      title: 'Max Splits',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Maximum number of splits (optional)',
      condition: {
        field: 'operation',
        value: ['split'],
      },
    },
    {
      id: 'trimWhitespace',
      title: 'Trim Whitespace',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'removeEmptyLines',
      title: 'Remove Empty Lines',
      type: 'switch',
      layout: 'half',
    },
  ],
  tools: {
    access: ['text_processor'],
    config: {
      tool: () => 'text_processor',
      params: (params) => params,
    },
  },
  inputs: {
    inputText: { type: 'string', required: false },
    operation: { type: 'string', required: false },
    caseTransform: { type: 'string', required: false },
    searchText: { type: 'string', required: false },
    replaceText: { type: 'string', required: false },
    splitDelimiter: { type: 'string', required: false },
    maxSplits: { type: 'number', required: false },
    trimWhitespace: { type: 'boolean', required: false },
    removeEmptyLines: { type: 'boolean', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        originalText: 'string',
        processedText: 'string',
        operation: 'string',
        wordCount: 'number',
        characterCount: 'number',
        metadata: 'json',
      },
    },
  },
}
