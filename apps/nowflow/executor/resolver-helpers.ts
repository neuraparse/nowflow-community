import { SerializedBlock } from '@/serializer/types'

// ---------------------------------------------------------------------------
// Pure helper functions extracted from InputResolver
// ---------------------------------------------------------------------------

/**
 * Normalizes block name for consistent lookups.
 * Converts to lowercase and collapses whitespace. Keeps dashes, underscores,
 * and digits so that "json-processor1" and "json_processor1" remain distinct.
 */
export function normalizeBlockName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Formats a value for use in condition blocks.
 * Handles strings, null, undefined, and objects appropriately.
 */
export function stringifyForCondition(value: any): string {
  if (typeof value === 'string') {
    return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
  } else if (value === null) {
    return 'null'
  } else if (typeof value === 'undefined') {
    return 'undefined'
  } else if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Determines if a string contains a properly formatted environment variable reference.
 * Valid references are either:
 * 1. A standalone env var (entire string is just {{ENV_VAR}})
 * 2. An explicit env var with clear boundaries (usually within a URL or similar)
 */
export function containsProperEnvVarReference(value: string): boolean {
  if (!value || typeof value !== 'string') return false

  // Case 1: String is just a single environment variable
  if (value.trim().match(/^\{\{[^{}]+\}\}$/)) {
    return true
  }

  // Case 2: Check for environment variables in specific contexts
  // For example, in URLs, bearer tokens, etc.
  const properContextPatterns = [
    // Auth header patterns
    /Bearer\s+\{\{[^{}]+\}\}/i,
    /Authorization:\s+Bearer\s+\{\{[^{}]+\}\}/i,
    /Authorization:\s+\{\{[^{}]+\}\}/i,

    // API key in URL patterns
    /[?&]api[_-]?key=\{\{[^{}]+\}\}/i,
    /[?&]key=\{\{[^{}]+\}\}/i,
    /[?&]token=\{\{[^{}]+\}\}/i,

    // API key in header patterns
    /X-API-Key:\s+\{\{[^{}]+\}\}/i,
    /api[_-]?key:\s+\{\{[^{}]+\}\}/i,
  ]

  return properContextPatterns.some((pattern) => pattern.test(value))
}

/**
 * Determines if a given field in a block is an API key field.
 */
export function isApiKeyField(block: SerializedBlock, value: string): boolean {
  // Check if the block is an API or agent block (which typically have API keys)
  const blockType = block.metadata?.id
  if (blockType !== 'api' && blockType !== 'agent') {
    return false
  }

  // Look for the value in the block params
  for (const [key, paramValue] of Object.entries(block.config.params)) {
    if (paramValue === value) {
      // Check if key name suggests it's an API key
      const normalizedKey = key.toLowerCase().replace(/[_\-\s]/g, '')
      return (
        normalizedKey === 'apikey' ||
        normalizedKey.includes('apikey') ||
        normalizedKey.includes('secretkey') ||
        normalizedKey.includes('accesskey') ||
        normalizedKey.includes('token')
      )
    }
  }

  return false
}

/**
 * Formats a value for safe use in a code context (like function blocks).
 * Ensures strings are properly quoted in JavaScript.
 */
export function formatValueForCodeContext(
  value: any,
  block: SerializedBlock,
  isInTemplateLiteral: boolean = false
): string {
  // For function blocks, properly format values to avoid syntax errors
  if (block.metadata?.id === 'function') {
    // Special case for values in template literals (like `Hello ${<loop.currentItem>}`)
    if (isInTemplateLiteral) {
      if (typeof value === 'string') {
        return value // Don't quote strings in template literals
      } else if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value) // But do stringify objects
      } else {
        return String(value)
      }
    }

    // Regular (non-template) contexts
    if (typeof value === 'string') {
      // Quote strings for JavaScript
      return JSON.stringify(value)
    } else if (typeof value === 'object' && value !== null) {
      // Stringify objects and arrays
      return JSON.stringify(value)
    } else if (value === undefined) {
      return 'undefined'
    } else if (value === null) {
      return 'null'
    } else {
      // Numbers, booleans can be inserted as is
      return String(value)
    }
  }

  // For non-code blocks, use normal string conversion
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
}

/**
 * Determines if a value needs to be formatted as a code-compatible string literal
 * based on the block type and context.
 */
export function needsCodeStringLiteral(block?: SerializedBlock, expression?: string): boolean {
  if (!block) return false

  // These block types execute code and need properly formatted string literals
  const codeExecutionBlocks = ['function', 'condition']

  // Check if this is a block that executes code
  if (block.metadata?.id && codeExecutionBlocks.includes(block.metadata.id)) {
    // Specifically for condition blocks, stringifyForCondition handles quoting
    // so we don't need extra quoting here unless it's within an expression.
    if (block.metadata.id === 'condition' && !expression) {
      return false
    }
    return true
  }

  // Check if the expression itself looks like code, which might indicate
  // that even in non-code blocks, a variable needs string literal formatting.
  if (expression) {
    const codeIndicators = [
      // Function/method calls
      /\(\s*$/, // Function call
      /\.\w+\s*\(/, // Method call

      // JavaScript/Python operators
      /[=<>!+\-*\/%](?:==?)?/, // Common operators
      /\+=|-=|\*=|\/=|%=|\*\*=?/, // Assignment operators

      // JavaScript keywords
      /\b(if|else|for|while|return|var|let|const|function)\b/,

      // Python keywords
      /\b(if|else|elif|for|while|def|return|import|from|as|class|with|try|except)\b/,

      // Common code patterns
      /^['\"]use strict['\"]?$/, // JS strict mode
      /\$\{.+?\}/, // JS template literals
      /f['\"].*?['\"]/, // Python f-strings
      /\bprint\s*\(/, // Python print
      /\bconsole\.\w+\(/, // JS console methods
    ]

    // Check if the expression (which might contain the variable placeholder) matches code patterns
    return codeIndicators.some((pattern) => pattern.test(expression))
  }

  return false
}
