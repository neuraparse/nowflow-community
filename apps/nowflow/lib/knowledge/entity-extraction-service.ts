import 'server-only'
import { createLogger } from '@/lib/logs/console-logger'
import type { EntityExtractionOptions, EntityExtractionResult, ExtractedEntity } from './types'

const logger = createLogger('EntityExtractionService')

/**
 * Community Edition keeps knowledge graph entity extraction optional and inert.
 * The previous local ONNX pipeline pulled large model/runtime dependencies into
 * every install, including advisories that self-hosters could not patch.
 */
export class EntityExtractionService {
  static async extract(
    text: string,
    _options?: EntityExtractionOptions
  ): Promise<ExtractedEntity[]> {
    if (!text || text.trim().length === 0) {
      return []
    }

    logger.debug('Entity extraction is disabled in Community Edition', {
      textLength: text.length,
    })
    return []
  }

  static async extractBatch(
    texts: string[],
    _options?: EntityExtractionOptions
  ): Promise<ExtractedEntity[][]> {
    return texts.map(() => [])
  }

  static async extractFromChunks(
    chunks: Array<{ content: string; chunkIndex: number }>,
    _options?: EntityExtractionOptions
  ): Promise<EntityExtractionResult> {
    logger.debug('Entity extraction from chunks skipped in Community Edition', {
      chunkCount: chunks.length,
    })

    return {
      entities: [],
      entityChunkMap: {},
      perChunkEntities: {},
    }
  }

  static isModelLoaded(): boolean {
    return false
  }

  static async preload(): Promise<void> {
    logger.debug('Entity extraction preload skipped in Community Edition')
  }
}
