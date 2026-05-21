import { createLogger } from '@/lib/logs/console-logger'
import type { ChunkCreationOptions, ChunkingResult } from './types'

const logger = createLogger('TextChunker')

/**
 * Text Chunker Service
 *
 * Splits large documents into smaller chunks for efficient semantic search.
 * Implements sliding window approach with overlap to preserve context.
 */
export class TextChunker {
  /**
   * Split text into chunks
   */
  static chunk(
    text: string,
    options: ChunkCreationOptions,
    metadata?: Record<string, any>
  ): ChunkingResult {
    const { chunkSize, chunkOverlap } = options

    // Clean and normalize text
    const cleanedText = this.cleanText(text)

    // Split into sentences for better chunk boundaries
    const sentences = this.splitIntoSentences(cleanedText)

    const chunks: Array<{
      content: string
      index: number
      tokenCount: number
      metadata?: Record<string, any>
    }> = []

    let currentChunk = ''
    let currentTokens = 0
    let chunkIndex = 0

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const sentenceTokens = this.estimateTokens(sentence)

      // If adding this sentence exceeds chunk size, save current chunk
      if (currentTokens + sentenceTokens > chunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: currentTokens,
          metadata: { ...metadata, sentenceStart: i - Math.floor(currentTokens / 10) },
        })

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, chunkOverlap)
        currentChunk = overlapText + ' ' + sentence
        currentTokens = this.estimateTokens(currentChunk)
      } else {
        // Add sentence to current chunk
        currentChunk += (currentChunk ? ' ' : '') + sentence
        currentTokens += sentenceTokens
      }
    }

    // Add final chunk if not empty
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: currentTokens,
        metadata,
      })
    }

    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

    logger.debug('Text chunked', {
      totalChunks: chunks.length,
      totalTokens,
      avgTokensPerChunk: Math.round(totalTokens / chunks.length),
    })

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
    }
  }

  /**
   * Clean and normalize text
   */
  private static cleanText(text: string): string {
    return (
      text
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove control characters
        .replace(/[\x00-\x1F\x7F]/g, '')
        // Trim
        .trim()
    )
  }

  /**
   * Split text into sentences
   */
  private static splitIntoSentences(text: string): string[] {
    // Simple sentence splitter - can be enhanced with NLP library
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim())

    return sentences
  }

  /**
   * Estimate token count (rough approximation)
   * Real tokenization would use tiktoken or similar
   */
  private static estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    // This is a simplification - production should use proper tokenizer
    return Math.ceil(text.length / 4)
  }

  /**
   * Get overlap text from end of chunk
   */
  private static getOverlapText(text: string, overlapTokens: number): string {
    if (overlapTokens === 0) return ''

    const sentences = this.splitIntoSentences(text)
    let overlap = ''
    let tokens = 0

    // Take sentences from end until we reach overlap size
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i]
      const sentenceTokens = this.estimateTokens(sentence)

      if (tokens + sentenceTokens > overlapTokens) {
        break
      }

      overlap = sentence + ' ' + overlap
      tokens += sentenceTokens
    }

    return overlap.trim()
  }

  /**
   * Chunk document with page awareness (for PDFs, etc.)
   */
  static chunkWithPages(
    pages: Array<{ pageNumber: number; content: string }>,
    options: ChunkCreationOptions
  ): ChunkingResult {
    const allChunks: ChunkingResult['chunks'] = []
    let globalIndex = 0

    for (const page of pages) {
      const pageResult = this.chunk(page.content, options, {
        pageNumber: page.pageNumber,
      })

      // Update chunk indices to be global
      const updatedChunks = pageResult.chunks.map((chunk) => ({
        ...chunk,
        index: globalIndex++,
        metadata: {
          ...chunk.metadata,
          pageNumber: page.pageNumber,
        },
      }))

      allChunks.push(...updatedChunks)
    }

    const totalTokens = allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

    return {
      chunks: allChunks,
      totalChunks: allChunks.length,
      totalTokens,
    }
  }

  /**
   * Chunk markdown with heading awareness
   */
  static chunkMarkdown(markdown: string, options: ChunkCreationOptions): ChunkingResult {
    // Split by headings
    const sections = markdown.split(/(?=^#{1,6}\s)/m)

    const allChunks: ChunkingResult['chunks'] = []
    let globalIndex = 0

    for (const section of sections) {
      // Extract heading
      const headingMatch = section.match(/^(#{1,6})\s+(.+)$/m)
      const heading = headingMatch ? headingMatch[2] : undefined
      const level = headingMatch ? headingMatch[1].length : undefined

      const sectionResult = this.chunk(section, options, {
        heading,
        headingLevel: level,
      })

      const updatedChunks = sectionResult.chunks.map((chunk) => ({
        ...chunk,
        index: globalIndex++,
      }))

      allChunks.push(...updatedChunks)
    }

    const totalTokens = allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

    return {
      chunks: allChunks,
      totalChunks: allChunks.length,
      totalTokens,
    }
  }
}
