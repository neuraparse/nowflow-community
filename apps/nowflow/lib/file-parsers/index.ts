import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import { createLogger } from '@/lib/logs/console-logger'
import { RawPdfParser } from './raw-pdf-parser'
import {
  FILE_TYPE_CATEGORIES,
  FileParser,
  FileParseResult,
  getExtensionFromMime,
  MIME_TO_EXTENSION,
  SupportedFileType,
} from './types'

const logger = createLogger('FileParser')

// Lazy-loaded parsers to avoid initialization issues
let parserInstances: Record<string, FileParser> | null = null

/**
 * Get parser instances with lazy initialization
 * Supports ALL common document formats
 */
function getParserInstances(): Record<string, FileParser> {
  if (parserInstances === null) {
    parserInstances = {}

    try {
      // === PDF Parser ===
      try {
        logger.info('Loading PDF parser...')
        try {
          const { PdfParser } = require('./pdf-parser')
          parserInstances['pdf'] = new PdfParser()
          logger.info('PDF parser loaded')
        } catch {
          parserInstances['pdf'] = new RawPdfParser()
          logger.info('Raw PDF parser loaded as fallback')
        }
      } catch (error) {
        logger.error('PDF parser failed:', error)
      }

      // === DOCX Parser (mammoth - most reliable for Word documents) ===
      try {
        const { DocxParser } = require('./docx-parser')
        parserInstances['docx'] = new DocxParser()
        parserInstances['doc'] = new DocxParser() // Try mammoth for .doc too
        logger.info('DOCX parser loaded (mammoth)')
      } catch (error) {
        logger.error('DOCX parser failed:', error)
      }

      // === Office Parser (xlsx, pptx, odt, ods, odp, rtf) ===
      try {
        const { OfficeParser, XlsxParser, PptxParser } = require('./office-parser')

        // XLSX/Excel
        parserInstances['xlsx'] = new XlsxParser()
        parserInstances['xls'] = new XlsxParser()

        // PPTX/PowerPoint
        parserInstances['pptx'] = new PptxParser()
        parserInstances['ppt'] = new PptxParser()

        // OpenDocument formats (use OfficeParser)
        parserInstances['odt'] = new OfficeParser()
        parserInstances['ods'] = new OfficeParser()
        parserInstances['odp'] = new OfficeParser()

        // RTF
        parserInstances['rtf'] = new OfficeParser()

        // Fallback for doc if mammoth didn't load
        if (!parserInstances['doc']) {
          parserInstances['doc'] = new OfficeParser()
        }

        logger.info('Office parsers loaded (xlsx, pptx, odt, ods, odp, rtf)')
      } catch (error) {
        logger.error('Office parser failed:', error)
      }

      // === CSV Parser ===
      try {
        const { CsvParser } = require('./csv-parser')
        parserInstances['csv'] = new CsvParser()
        logger.info('CSV parser loaded')
      } catch (error) {
        logger.error('CSV parser failed:', error)
      }

      // === Text Parsers (txt, md, html, json, xml) ===
      try {
        const {
          TxtParser,
          MarkdownParser,
          HtmlParser,
          JsonParser,
          XmlParser,
        } = require('./text-parsers')

        parserInstances['txt'] = new TxtParser()
        parserInstances['md'] = new MarkdownParser()
        parserInstances['markdown'] = new MarkdownParser()
        parserInstances['html'] = new HtmlParser()
        parserInstances['htm'] = new HtmlParser()
        parserInstances['json'] = new JsonParser()
        parserInstances['xml'] = new XmlParser()

        logger.info('Text parsers loaded (txt, md, html, json, xml)')
      } catch (error) {
        logger.error('Text parsers failed:', error)
      }

      // === OCR Parser (for images) ===
      try {
        const { OcrParser } = require('./ocr-parser')
        const ocrParser = new OcrParser()

        // Image formats with OCR support
        parserInstances['png'] = ocrParser
        parserInstances['jpg'] = ocrParser
        parserInstances['jpeg'] = ocrParser
        parserInstances['gif'] = ocrParser
        parserInstances['bmp'] = ocrParser
        parserInstances['tiff'] = ocrParser
        parserInstances['tif'] = ocrParser
        parserInstances['webp'] = ocrParser

        logger.info('OCR parser loaded (png, jpg, jpeg, gif, bmp, tiff, webp)')
      } catch (error) {
        logger.warn('OCR parser not available:', error)
      }
    } catch (error) {
      logger.error('Error loading file parsers:', error)
    }
  }

  return parserInstances
}

/**
 * Parse a file based on its extension
 * @param filePath Path to the file
 * @returns Parsed content and metadata
 */
export async function parseFile(filePath: string): Promise<FileParseResult> {
  try {
    // Validate input
    if (!filePath) {
      throw new Error('No file path provided')
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    const extension = path.extname(filePath).toLowerCase().substring(1)
    logger.info('Attempting to parse file with extension:', extension)

    const parsers = getParserInstances()

    if (!Object.keys(parsers).includes(extension)) {
      logger.info('No parser found for extension:', extension)
      throw new Error(
        `Unsupported file type: ${extension}. Supported types are: ${Object.keys(parsers).join(', ')}`
      )
    }

    logger.info('Using parser for extension:', extension)
    const parser = parsers[extension]
    return await parser.parseFile(filePath)
  } catch (error) {
    logger.error('File parsing error:', error)
    throw error
  }
}

/**
 * Parse a buffer based on file extension
 * @param buffer Buffer containing the file data
 * @param extension File extension without the dot (e.g., 'pdf', 'csv')
 * @returns Parsed content and metadata
 */
export async function parseBuffer(buffer: Buffer, extension: string): Promise<FileParseResult> {
  try {
    // Validate input
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty buffer provided')
    }

    if (!extension) {
      throw new Error('No file extension provided')
    }

    const normalizedExtension = extension.toLowerCase()
    logger.info('Attempting to parse buffer with extension:', normalizedExtension)

    const parsers = getParserInstances()

    if (!Object.keys(parsers).includes(normalizedExtension)) {
      logger.info('No parser found for extension:', normalizedExtension)
      throw new Error(
        `Unsupported file type: ${normalizedExtension}. Supported types are: ${Object.keys(parsers).join(', ')}`
      )
    }

    logger.info('Using parser for extension:', normalizedExtension)
    const parser = parsers[normalizedExtension]

    // Check if parser supports buffer parsing
    if (parser.parseBuffer) {
      return await parser.parseBuffer(buffer, normalizedExtension)
    } else {
      throw new Error(`Parser for ${normalizedExtension} does not support buffer parsing`)
    }
  } catch (error) {
    logger.error('Buffer parsing error:', error)
    throw error
  }
}

/**
 * Check if a file type is supported
 * @param extension File extension without the dot
 * @returns true if supported, false otherwise
 */
export function isSupportedFileType(extension: string): extension is SupportedFileType {
  try {
    return Object.keys(getParserInstances()).includes(extension.toLowerCase())
  } catch (error) {
    logger.error('Error checking supported file type:', error)
    return false
  }
}

/**
 * Get list of all supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(getParserInstances())
}

/**
 * Get extension from MIME type
 */
export { getExtensionFromMime, FILE_TYPE_CATEGORIES, MIME_TO_EXTENSION }

// Type exports
export type { FileParseResult, FileParser, SupportedFileType }
