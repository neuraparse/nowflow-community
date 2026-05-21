import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { createLogger } from '@/lib/logs/console-logger'
import { FileParser, FileParseResult } from './types'

const logger = createLogger('OfficeParser')

// Temp directory for file parsing
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/file-parser'

async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true })
  }
}

/**
 * Office Parser using officeparser library
 * Supports: docx, xlsx, pptx, odt, ods, odp, pdf
 */
export class OfficeParser implements FileParser {
  private officeparser: any = null

  private async getParser() {
    if (!this.officeparser) {
      const lib = await import('officeparser')
      this.officeparser = lib.default || lib
    }
    return this.officeparser
  }

  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      logger.info('Parsing file with officeparser:', filePath)

      const parser = await this.getParser()
      let content = await parser.parseOffice(filePath)

      // Ensure content is a string
      if (content === null || content === undefined) {
        content = ''
      } else if (typeof content !== 'string') {
        content = String(content)
      }

      logger.info('File parsed successfully, content length:', content.length)

      // If content is empty, try alternative parsing for DOCX
      if (content.length === 0 && filePath.toLowerCase().endsWith('.docx')) {
        logger.info('Empty content from officeparser, trying mammoth for DOCX...')
        try {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ path: filePath })
          if (result.value && result.value.length > 0) {
            content = result.value
            logger.info('Mammoth extracted content successfully, length:', content.length)
          }
        } catch (mammothError) {
          logger.warn('Mammoth fallback failed:', mammothError)
        }
      }

      return {
        content: content,
        metadata: {
          parser: 'officeparser',
          filePath,
          isEmpty: content.length === 0,
        },
      }
    } catch (error: any) {
      logger.error('OfficeParser file error:', error)
      throw new Error(`Failed to parse file: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer, extension?: string): Promise<FileParseResult> {
    // Use temp file approach as parseOfficeAsync has issues in production builds
    const tempFile = join(TEMP_DIR, `${randomUUID()}.${extension || 'docx'}`)

    try {
      logger.info('Parsing buffer with officeparser via temp file, size:', buffer.length)

      await ensureTempDir()
      await writeFile(tempFile, buffer)

      const result = await this.parseFile(tempFile)

      return {
        ...result,
        metadata: {
          ...result.metadata,
          bufferSize: buffer.length,
        },
      }
    } catch (error: any) {
      logger.error('OfficeParser buffer error:', error)
      throw new Error(`Failed to parse buffer: ${error?.message}`)
    } finally {
      // Clean up temp file
      try {
        await unlink(tempFile)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Excel/XLSX specific parser with table preservation
 */
export class XlsxParser implements FileParser {
  private officeparser: any = null

  private async getParser() {
    if (!this.officeparser) {
      const lib = await import('officeparser')
      this.officeparser = lib.default || lib
    }
    return this.officeparser
  }

  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      logger.info('Parsing XLSX file:', filePath)

      const parser = await this.getParser()
      // Parse with newlines preserved for table structure
      const content = await parser.parseOffice(filePath, {
        preserveLineBreaks: true,
      })

      return {
        content: this.formatExcelContent(content || ''),
        metadata: {
          parser: 'officeparser-xlsx',
          filePath,
        },
      }
    } catch (error: any) {
      logger.error('XLSX parse error:', error)
      throw new Error(`Failed to parse XLSX: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    // Use temp file approach as parseOfficeAsync has issues in production builds
    const tempFile = join(TEMP_DIR, `${randomUUID()}.xlsx`)

    try {
      logger.info('Parsing XLSX buffer via temp file, size:', buffer.length)

      await ensureTempDir()
      await writeFile(tempFile, buffer)

      const result = await this.parseFile(tempFile)

      return {
        ...result,
        metadata: {
          ...result.metadata,
          bufferSize: buffer.length,
        },
      }
    } catch (error: any) {
      logger.error('XLSX buffer parse error:', error)
      throw new Error(`Failed to parse XLSX buffer: ${error?.message}`)
    } finally {
      try {
        await unlink(tempFile)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private formatExcelContent(content: string): string {
    // Clean up and format Excel content for better chunking
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
  }
}

/**
 * PowerPoint/PPTX specific parser
 */
export class PptxParser implements FileParser {
  private officeparser: any = null

  private async getParser() {
    if (!this.officeparser) {
      const lib = await import('officeparser')
      this.officeparser = lib.default || lib
    }
    return this.officeparser
  }

  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      logger.info('Parsing PPTX file:', filePath)

      const parser = await this.getParser()
      const content = await parser.parseOffice(filePath)

      return {
        content: this.formatPptContent(content || ''),
        metadata: {
          parser: 'officeparser-pptx',
          filePath,
        },
      }
    } catch (error: any) {
      logger.error('PPTX parse error:', error)
      throw new Error(`Failed to parse PPTX: ${error?.message}`)
    }
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    // Use temp file approach as parseOfficeAsync has issues in production builds
    const tempFile = join(TEMP_DIR, `${randomUUID()}.pptx`)

    try {
      logger.info('Parsing PPTX buffer via temp file, size:', buffer.length)

      await ensureTempDir()
      await writeFile(tempFile, buffer)

      const result = await this.parseFile(tempFile)

      return {
        ...result,
        metadata: {
          ...result.metadata,
          bufferSize: buffer.length,
        },
      }
    } catch (error: any) {
      logger.error('PPTX buffer parse error:', error)
      throw new Error(`Failed to parse PPTX buffer: ${error?.message}`)
    } finally {
      try {
        await unlink(tempFile)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private formatPptContent(content: string): string {
    // Format PowerPoint content - separate slides with markers
    return content
      .split('\n\n')
      .map((slide, i) => `--- Slide ${i + 1} ---\n${slide.trim()}`)
      .join('\n\n')
  }
}
