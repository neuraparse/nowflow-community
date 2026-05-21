import { ToolConfig, ToolResponse } from '../types'

interface TextProcessorParams {
  inputText: string
  operation: string
  caseTransform?: string
  searchText?: string
  replaceText?: string
  splitDelimiter?: string
  maxSplits?: number
  trimWhitespace?: boolean
  removeEmptyLines?: boolean
}

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

export const textProcessorTool: ToolConfig<TextProcessorParams, TextProcessorResponse> = {
  id: 'text_processor',
  name: 'Text Processor',
  description: 'Process and transform text with various operations',
  version: '1.0.0',

  params: {
    inputText: {
      type: 'string',
      required: false,
      description: 'The text to process',
    },
    operation: {
      type: 'string',
      required: false,
      description: 'The operation to perform on the text',
    },
    caseTransform: {
      type: 'string',
      required: false,
      description: 'Case transformation to apply',
    },
    searchText: {
      type: 'string',
      required: false,
      description: 'Text to search for',
    },
    replaceText: {
      type: 'string',
      required: false,
      description: 'Text to replace with',
    },
    splitDelimiter: {
      type: 'string',
      required: false,
      description: 'Delimiter to split text by',
    },
    maxSplits: {
      type: 'number',
      required: false,
      description: 'Maximum number of splits',
    },
    trimWhitespace: {
      type: 'boolean',
      required: false,
      description: 'Whether to trim whitespace',
    },
    removeEmptyLines: {
      type: 'boolean',
      required: false,
      description: 'Whether to remove empty lines',
    },
  },

  // Request configuration is not needed due to directExecution, but the type requires it.
  request: {
    url: '', // Not used
    method: 'POST', // Not used
    headers: () => ({}), // Not used
  },

  directExecution: async (params: TextProcessorParams): Promise<TextProcessorResponse> => {
    try {
      let processedText = params.inputText || ''
      const metadata: Record<string, any> = {}
      const operation = params.operation || 'clean'

      // Apply case transformation first
      if (params.caseTransform && params.caseTransform !== 'none') {
        switch (params.caseTransform) {
          case 'upper':
            processedText = processedText.toUpperCase()
            break
          case 'lower':
            processedText = processedText.toLowerCase()
            break
          case 'title':
            processedText = processedText.replace(
              /\w\S*/g,
              (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            )
            break
          case 'sentence':
            processedText =
              processedText.charAt(0).toUpperCase() + processedText.slice(1).toLowerCase()
            break
          case 'camel':
            processedText = processedText
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              )
              .replace(/\s+/g, '')
            break
          case 'snake':
            processedText = processedText.toLowerCase().replace(/\s+/g, '_')
            break
          case 'kebab':
            processedText = processedText.toLowerCase().replace(/\s+/g, '-')
            break
        }
      }

      // Apply main operation
      switch (operation) {
        case 'clean':
          processedText = processedText.replace(/\s+/g, ' ').trim()
          if (params.removeEmptyLines) {
            processedText = processedText
              .split('\n')
              .filter((line) => line.trim())
              .join('\n')
          }
          break

        case 'extract_emails':
          const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
          const emails = processedText.match(emailRegex) || []
          processedText = emails.join('\n')
          metadata.extractedCount = emails.length
          break

        case 'extract_urls':
          const urlRegex =
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
          const urls = processedText.match(urlRegex) || []
          processedText = urls.join('\n')
          metadata.extractedCount = urls.length
          break

        case 'extract_phones':
          const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g
          const phones = processedText.match(phoneRegex) || []
          processedText = phones.join('\n')
          metadata.extractedCount = phones.length
          break

        case 'split':
          const delimiter = params.splitDelimiter || '\n'
          const parts = processedText.split(delimiter)
          const maxSplits = params.maxSplits || parts.length
          processedText = parts.slice(0, maxSplits).join('\n')
          metadata.splitCount = Math.min(parts.length, maxSplits)
          break

        case 'replace':
          if (params.searchText && params.replaceText !== undefined) {
            const regex = new RegExp(params.searchText, 'g')
            processedText = processedText.replace(regex, params.replaceText)
          }
          break

        case 'regex_match':
          if (params.searchText) {
            const regex = new RegExp(params.searchText, 'g')
            const matches = processedText.match(regex) || []
            processedText = matches.join('\n')
            metadata.matchCount = matches.length
          }
          break

        case 'regex_replace':
          if (params.searchText && params.replaceText !== undefined) {
            const regex = new RegExp(params.searchText, 'g')
            processedText = processedText.replace(regex, params.replaceText)
          }
          break

        case 'format':
          processedText = processedText.replace(/\s+/g, ' ').trim()
          break

        case 'analyze':
          const words = processedText.split(/\s+/).filter((word) => word.length > 0)
          const sentences = processedText.split(/[.!?]+/).filter((s) => s.trim().length > 0)
          const paragraphs = processedText.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

          metadata.analysis = {
            wordCount: words.length,
            sentenceCount: sentences.length,
            paragraphCount: paragraphs.length,
            averageWordsPerSentence:
              sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
            readingTime: Math.ceil(words.length / 200), // Assuming 200 words per minute
          }
          break
      }

      // Apply final trimming if requested
      if (params.trimWhitespace) {
        processedText = processedText.trim()
      }

      const wordCount = processedText.split(/\s+/).filter((word) => word.length > 0).length
      const characterCount = processedText.length

      return {
        success: true,
        output: {
          content: processedText,
          originalText: params.inputText || '',
          processedText,
          operation,
          wordCount,
          characterCount,
          metadata,
        },
      }
    } catch (error) {
      return {
        success: false,
        output: {
          content: '',
          originalText: params.inputText || '',
          processedText: '',
          operation: params.operation || 'clean',
          wordCount: 0,
          characterCount: 0,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      }
    }
  },
}
