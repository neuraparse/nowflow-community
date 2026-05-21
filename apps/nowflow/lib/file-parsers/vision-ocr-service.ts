import { createLogger } from '@/lib/logs/console-logger'
import { getOllamaHost } from '@/lib/ollama-detection'

const logger = createLogger('VisionOCR')

const OLLAMA_URL = process.env.OLLAMA_URL || getOllamaHost()
const VISION_MODEL = 'minicpm-v'

const SYSTEM_PROMPT = `You are a precise document OCR system. Extract ALL text from this document page exactly as written.

Rules:
- Output clean markdown preserving the document structure
- Use markdown headings (#, ##, ###) for titles and sections
- Use markdown tables (| col1 | col2 |) for any tabular data
- Use bullet points for lists
- Preserve paragraph breaks
- Do NOT describe the image or add commentary
- Do NOT add text that is not in the document
- If the page contains diagrams or charts, describe the data/labels briefly in [brackets]
- Extract numbers, dates, and special characters accurately
- For multi-column layouts, read left column first then right column`

/**
 * Vision OCR Service using Ollama multimodal models
 * Produces clean markdown output from document images
 */
export class VisionOcrService {
  private static instance: VisionOcrService
  private available: boolean | null = null
  private modelPulling = false

  static getInstance(): VisionOcrService {
    if (!VisionOcrService.instance) {
      VisionOcrService.instance = new VisionOcrService()
    }
    return VisionOcrService.instance
  }

  /**
   * Check if the vision model is available in Ollama
   */
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available

    try {
      // Check Ollama is reachable
      const versionRes = await fetch(`${OLLAMA_URL}/api/version`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!versionRes.ok) {
        this.available = false
        return false
      }

      // Check if vision model is installed
      const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!tagsRes.ok) {
        this.available = false
        return false
      }

      const data = await tagsRes.json()
      const models = data.models || []
      const installed = models.some(
        (m: any) => m.name === VISION_MODEL || m.name.startsWith(`${VISION_MODEL}:`)
      )

      if (installed) {
        logger.info(`Vision model ${VISION_MODEL} is available`)
        this.available = true
        return true
      }

      // Try to auto-pull (only once)
      if (!this.modelPulling) {
        this.modelPulling = true
        logger.info(`Vision model ${VISION_MODEL} not found, attempting to pull...`)

        try {
          const pullRes = await fetch(`${OLLAMA_URL}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: VISION_MODEL, stream: false }),
            signal: AbortSignal.timeout(600000), // 10 min for pull
          })

          if (pullRes.ok) {
            logger.info(`Vision model ${VISION_MODEL} pulled successfully`)
            this.available = true
            return true
          }
        } catch (pullErr) {
          logger.warn('Failed to pull vision model:', pullErr)
        }
      }

      this.available = false
      return false
    } catch {
      this.available = false
      return false
    }
  }

  /**
   * Reset availability cache (e.g., after model is manually installed)
   */
  resetCache() {
    this.available = null
    this.modelPulling = false
  }

  /**
   * Process a single image buffer and extract text as markdown
   */
  async processImage(imageBuffer: Buffer): Promise<string> {
    const base64Image = imageBuffer.toString('base64')

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: SYSTEM_PROMPT + '\n\nExtract all text from this document page:',
            images: [base64Image],
          },
        ],
        stream: false,
        options: {
          temperature: 0,
          num_predict: 4096,
          num_thread: 16,
        },
      }),
      signal: AbortSignal.timeout(180000), // 3 min per page
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown')
      throw new Error(`Ollama vision API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const text = data.message?.content?.trim() || ''

    return text
  }

  /**
   * Process multiple page images sequentially
   */
  async processPages(
    imageBuffers: Buffer[],
    onProgress?: (page: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = []

    for (let i = 0; i < imageBuffers.length; i++) {
      try {
        const text = await this.processImage(imageBuffers[i])
        results.push(text)
        onProgress?.(i + 1, imageBuffers.length)
        logger.info(`Vision OCR page ${i + 1}/${imageBuffers.length} done`, {
          textLength: text.length,
        })
      } catch (err: any) {
        logger.warn(`Vision OCR failed for page ${i + 1}:`, err.message)
        results.push('')
      }
    }

    return results
  }
}
