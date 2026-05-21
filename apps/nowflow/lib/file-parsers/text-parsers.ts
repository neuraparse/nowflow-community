import { readFile } from 'fs/promises'
import { createLogger } from '@/lib/logs/console-logger'
import { FileParser, FileParseResult } from './types'

const logger = createLogger('TextParsers')

/**
 * Plain Text Parser (TXT)
 */
export class TxtParser implements FileParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return {
        content,
        metadata: { parser: 'txt', filePath },
      }
    } catch (error: any) {
      logger.error('TXT parse error:', error)
      throw new Error(`Failed to parse TXT: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    return {
      content: buffer.toString('utf-8'),
      metadata: { parser: 'txt' },
    }
  }
}

/**
 * Markdown Parser (MD)
 */
export class MarkdownParser implements FileParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return {
        content: this.cleanMarkdown(content),
        metadata: { parser: 'markdown', filePath },
      }
    } catch (error: any) {
      logger.error('Markdown parse error:', error)
      throw new Error(`Failed to parse Markdown: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    const content = buffer.toString('utf-8')
    return {
      content: this.cleanMarkdown(content),
      metadata: { parser: 'markdown' },
    }
  }

  private cleanMarkdown(content: string): string {
    // Keep markdown structure but clean up for better chunking
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
}

/**
 * HTML Parser - extracts text content
 */
export class HtmlParser implements FileParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return {
        content: this.extractText(content),
        metadata: { parser: 'html', filePath },
      }
    } catch (error: any) {
      logger.error('HTML parse error:', error)
      throw new Error(`Failed to parse HTML: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    const content = buffer.toString('utf-8')
    return {
      content: this.extractText(content),
      metadata: { parser: 'html' },
    }
  }

  private extractText(html: string): string {
    // Remove scripts, styles, and HTML tags
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }
}

/**
 * JSON Parser - extracts text values
 */
export class JsonParser implements FileParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content)
      return {
        content: this.extractTextFromJson(parsed),
        metadata: { parser: 'json', filePath },
      }
    } catch (error: any) {
      logger.error('JSON parse error:', error)
      throw new Error(`Failed to parse JSON: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    const content = buffer.toString('utf-8')
    const parsed = JSON.parse(content)
    return {
      content: this.extractTextFromJson(parsed),
      metadata: { parser: 'json' },
    }
  }

  private extractTextFromJson(obj: any, depth = 0): string {
    if (depth > 10) return '' // Prevent deep recursion

    if (typeof obj === 'string') return obj
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj)
    if (obj === null || obj === undefined) return ''

    if (Array.isArray(obj)) {
      return obj.map((item) => this.extractTextFromJson(item, depth + 1)).join('\n')
    }

    if (typeof obj === 'object') {
      return Object.entries(obj)
        .map(([key, value]) => `${key}: ${this.extractTextFromJson(value, depth + 1)}`)
        .join('\n')
    }

    return ''
  }
}

/**
 * XML Parser - extracts text content
 */
export class XmlParser implements FileParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return {
        content: this.extractText(content),
        metadata: { parser: 'xml', filePath },
      }
    } catch (error: any) {
      logger.error('XML parse error:', error)
      throw new Error(`Failed to parse XML: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    const content = buffer.toString('utf-8')
    return {
      content: this.extractText(content),
      metadata: { parser: 'xml' },
    }
  }

  private extractText(xml: string): string {
    // Remove XML declaration and comments, then extract text
    return xml
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\s+/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
  }
}
