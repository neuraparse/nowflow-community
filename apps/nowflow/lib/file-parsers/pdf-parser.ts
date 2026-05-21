import { readFile } from 'fs/promises'
import { createLogger } from '@/lib/logs/console-logger'
import { FileParser, FileParseResult } from './types'

const logger = createLogger('PdfParser')

/**
 * Parse PDF using unpdf library
 * unpdf is specifically designed for serverless environments and works well with Next.js
 * It includes a serverless-optimized build of PDF.js that doesn't require browser polyfills
 */
async function parsePdfWithUnpdf(
  dataBuffer: Buffer
): Promise<{ text: string; numpages: number; info: object; version: string }> {
  // Dynamic import to avoid bundling issues
  const { extractText, getDocumentProxy, getMeta } = await import('unpdf')

  // Convert Buffer to Uint8Array for unpdf
  const uint8Array = new Uint8Array(dataBuffer)

  // Get document proxy
  const pdf = await getDocumentProxy(uint8Array)

  // Extract text from all pages
  const { totalPages, text } = await extractText(pdf, { mergePages: true })

  // Get metadata
  let info: Record<string, any> = {}
  let version = 'Unknown'
  try {
    const meta = await getMeta(pdf)
    info = meta.info || {}
    // PDF version is usually in the info object
    if (info.PDFFormatVersion) {
      version = info.PDFFormatVersion
    }
  } catch (metaError) {
    logger.warn('Could not extract PDF metadata:', metaError)
  }

  return {
    text: text as string,
    numpages: totalPages,
    info,
    version,
  }
}

export class PdfParser implements FileParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    try {
      logger.info('Starting to parse file:', filePath)

      // Make sure we're only parsing the provided file path
      if (!filePath) {
        throw new Error('No file path provided')
      }

      // Read the file
      logger.info('Reading file...')
      const dataBuffer = await readFile(filePath)
      logger.info('File read successfully, size:', dataBuffer.length)

      return this.parseBuffer(dataBuffer)
    } catch (error) {
      logger.error('Error reading file:', error)
      throw error
    }
  }

  async parseBuffer(dataBuffer: Buffer): Promise<FileParseResult> {
    try {
      logger.info('Starting to parse buffer, size:', dataBuffer.length)

      // Try to parse with unpdf (serverless-optimized, works well with Next.js)
      try {
        logger.info('Attempting to parse with unpdf...')
        logger.info('Starting PDF parsing...')
        const data = await parsePdfWithUnpdf(dataBuffer)
        logger.info('PDF parsed successfully with unpdf, pages:', data.numpages)

        const content = data.text?.trim() || ''

        // If content is too short, might be a scanned PDF - try OCR
        if (content.length < 100 && dataBuffer.length > 50000) {
          logger.info('PDF content too short, attempting OCR fallback...')
          try {
            const { PdfOcrParser } = await import('./ocr-parser')
            const ocrParser = new PdfOcrParser()
            const ocrResult = await ocrParser.parseBuffer(dataBuffer)

            if (ocrResult.content && ocrResult.content.length > content.length) {
              logger.info('OCR extracted more content than text layer')
              return {
                content: ocrResult.content,
                metadata: {
                  pageCount: data.numpages,
                  info: data.info,
                  version: data.version,
                  ocrUsed: true,
                },
              }
            }
          } catch (ocrError) {
            logger.warn('OCR fallback failed:', ocrError)
          }
        }

        return {
          content: content,
          metadata: {
            pageCount: data.numpages,
            info: data.info,
            version: data.version,
          },
        }
      } catch (pdfParseError: unknown) {
        logger.error('unpdf failed:', pdfParseError)

        // Try OCR as last resort for scanned PDFs
        logger.info('Attempting OCR for scanned PDF...')
        try {
          const { PdfOcrParser } = await import('./ocr-parser')
          const ocrParser = new PdfOcrParser()
          const ocrResult = await ocrParser.parseBuffer(dataBuffer)

          if (ocrResult.content && ocrResult.content.length > 50) {
            logger.info('OCR successfully extracted text from scanned PDF')
            return ocrResult
          }
        } catch (ocrError) {
          logger.warn('OCR fallback failed:', ocrError)
        }

        // Fallback to manual text extraction
        logger.info('Falling back to manual text extraction...')

        // Extract basic PDF info from raw content
        const rawContent = dataBuffer.toString('utf-8', 0, Math.min(10000, dataBuffer.length))

        let version = 'Unknown'
        let pageCount = 0

        // Try to extract PDF version
        const versionMatch = rawContent.match(/%PDF-(\d+\.\d+)/)
        if (versionMatch && versionMatch[1]) {
          version = versionMatch[1]
        }

        // Try to get page count
        const pageMatches = rawContent.match(/\/Type\s*\/Page\b/g)
        if (pageMatches) {
          pageCount = pageMatches.length
        }

        // Try to extract text by looking for text-related operators in the PDF
        let extractedText = ''

        // Look for text in the PDF content using common patterns
        const textMatches = rawContent.match(/BT[\s\S]*?ET/g)
        if (textMatches && textMatches.length > 0) {
          extractedText = textMatches
            .map((textBlock) => {
              // Extract text objects (Tj, TJ) from the text block
              const textObjects = textBlock.match(/\([^)]*\)\s*Tj|\[[^\]]*\]\s*TJ/g)
              if (textObjects) {
                return textObjects
                  .map((obj) => {
                    // Clean up text objects
                    return (
                      obj
                        .replace(
                          /\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g,
                          (_match, p1, p2) => p1 || p2 || ''
                        )
                        // Clean up PDF escape sequences
                        .replace(/\\(\d{3}|[()\\])/g, '')
                        .replace(/\\\\/g, '\\')
                        .replace(/\\\(/g, '(')
                        .replace(/\\\)/g, ')')
                    )
                  })
                  .join(' ')
              }
              return ''
            })
            .join('\n')
        }

        // If we couldn't extract text or the text is too short, return a fallback message
        if (!extractedText || extractedText.length < 50) {
          extractedText = `This PDF contains ${pageCount} page(s) but text extraction was not successful.`
        }

        return {
          content: extractedText,
          metadata: {
            pageCount,
            version,
            fallback: true,
            error: (pdfParseError as Error).message || 'Unknown error',
          },
        }
      }
    } catch (error) {
      logger.error('Error parsing buffer:', error)
      throw error
    }
  }
}
