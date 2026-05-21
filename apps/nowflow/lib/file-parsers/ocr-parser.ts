import { execFile } from 'child_process'
import { mkdtemp, readdir, readFile, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createLogger } from '@/lib/logs/console-logger'
import { getOllamaHost } from '@/lib/ollama-detection'
import { scoreWord } from '@/lib/utils/gibberish-detector'
import { FileParser, FileParseResult } from './types'

const logger = createLogger('OcrParser')

const OLLAMA_URL = process.env.OLLAMA_URL || getOllamaHost()
const PARALLEL_OCR = 4 // concurrent tesseract processes

// ─── Utility helpers ───────────────────────────────────────────────

const toolCache = new Map<string, boolean>()
async function hasTool(name: string): Promise<boolean> {
  if (toolCache.has(name)) return toolCache.get(name)!
  return new Promise((resolve) => {
    execFile('which', [name], (error) => {
      const available = !error
      toolCache.set(name, available)
      resolve(available)
    })
  })
}

function detectImageExt(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return '.gif'
  if (buf[0] === 0x42 && buf[1] === 0x4d) return '.bmp'
  return '.png'
}

// ─── Smart OCR text quality filter ──────────────────────────────

const VOWELS = new Set('aeiouyAEIOUY') // 'y' counts as vowel for OCR heuristics
const KNOWN_ABBREVS = new Set([
  'AI',
  'ML',
  'LLM',
  'GPU',
  'CPU',
  'RAM',
  'ROM',
  'API',
  'SDK',
  'CLI',
  'ROS',
  'ROS2',
  'LTS',
  'JWT',
  'SSH',
  'TLS',
  'SSL',
  'TCP',
  'UDP',
  'DNS',
  'ONNX',
  'TVM',
  'SLAM',
  'HTTP',
  'HTTPS',
  'REST',
  'GRPC',
  'WSS',
  'NVIDIA',
  'QEMU',
  'MQTT',
  'V2X',
  'SOC',
  'PDF',
  'CSV',
  'JSON',
  'XML',
  'USB',
  'SSD',
  'HDD',
  'NVME',
  'PCIE',
  'FPGA',
  'ASIC',
  'IOT',
  'OTA',
  'UK',
  'EU',
  'US',
  'AWS',
  'GCP',
  'PR',
  'CI',
  'CD',
  'QA',
  'DB',
  'OS',
  'NLP',
  'NLU',
  'TTS',
  'STT',
  'OCR',
  'OEM',
  'SAAS',
  'PAAS',
  'IAAS',
])

/**
 * Check if a word looks like real text vs OCR noise from graphics.
 * Exported for reuse in entity extraction text cleaning.
 */
export function isValidWord(word: string): boolean {
  // Strip surrounding punctuation/symbols for analysis
  const core = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
  if (!core) return false

  // Known abbreviations/acronyms
  if (KNOWN_ABBREVS.has(core.toUpperCase())) return true

  // URLs, emails, domains, tech references
  if (/^(https?:\/\/|www\.|[\w.-]+\.(com|io|org|net|dev|ai|co|uk))/.test(core)) return true
  if (core.includes('@') && core.includes('.')) return true
  if (/^[A-Z][a-z]+\.(js|ts|py|go|rs|css|html)/.test(core)) return true // Next.js, Vue.js

  // Version numbers (v1.0, 1.2.3)
  if (/^v?\d+(\.\d+)+/.test(core)) return true

  // Technical specs — must start with digit or < > (not = or symbols)
  if (/^[<>]\d+(\.\d+)?[a-zA-Z%+]*$/.test(core)) return true
  if (/^\d+(\.\d+)?[a-zA-Z%+]+$/.test(core)) return true
  if (/^\d+(\.\d+)?%?$/.test(core)) return true

  const alphaOnly = core.replace(/[^a-zA-Z]/g, '')

  // Single char — only valid if common standalone letter or digit
  if (core.length === 1) return /^[aAI0-9]$/.test(core)

  // 2 char words: very strict — must be a common word/pattern
  if (core.length === 2 && alphaOnly.length === 2) {
    // Only allow common 2-letter words — case-sensitive to reject "oO", "sO", "Qo"
    return /^(an|at|be|by|do|go|he|if|in|is|it|me|my|no|of|on|or|so|to|up|us|we|am|as|ok|Al|OK|AI|UK|EU|US)$/.test(
      core
    )
  }

  // Repeated same character 3+ times anywhere = noise (flaaaghon, SSS, baaad)
  if (/(.)\1{2,}/i.test(alphaOnly)) return false

  // Only 1-2 distinct alpha chars repeated = noise (EERE, ASSA)
  // Skip 3-char words — valid words like "all", "add", "see" have 2 distinct chars
  if (alphaOnly.length >= 4) {
    const distinct = new Set(alphaOnly.toLowerCase())
    if (distinct.size <= 2) return false
  }

  // Random case mixing check — real words have consistent patterns:
  // all-lower, ALL-UPPER, TitleCase, camelCase. Random = noise.
  if (alphaOnly.length >= 4) {
    const isAllLower = alphaOnly === alphaOnly.toLowerCase()
    const isAllUpper = alphaOnly === alphaOnly.toUpperCase()
    const isTitle = /^[A-Z][a-z]+$/.test(alphaOnly)
    const isCamelOrPascal = /^[a-z]{2,}([A-Z][a-z]+)+$|^([A-Z][a-z]+)+[A-Z]*$/.test(alphaOnly)
    const isHyphenated = /^[A-Z][a-z]+-[A-Z]/.test(core) // like Al-Native
    if (!isAllLower && !isAllUpper && !isTitle && !isCamelOrPascal && !isHyphenated) {
      return false // random case mixing like nVibIA, qQaeg
    }
  }

  // 3 char words: must have a vowel + consistent case
  if (core.length === 3 && alphaOnly.length >= 2) {
    const hasVowel = [...alphaOnly].some((c) => VOWELS.has(c))
    if (!hasVowel) return false
    // Mixed case 3-char words are noise (ofS, pHs) — allow all-lower, ALL-UPPER, Title
    if (alphaOnly.length === 3) {
      const isConsistent =
        alphaOnly === alphaOnly.toLowerCase() ||
        alphaOnly === alphaOnly.toUpperCase() ||
        /^[A-Z][a-z]+$/.test(alphaOnly)
      if (!isConsistent) return false
    }
  }

  // Longer words: check vowel ratio
  if (alphaOnly.length >= 4) {
    const vowelCount = [...alphaOnly].filter((c) => VOWELS.has(c)).length
    const vowelRatio = vowelCount / alphaOnly.length
    if (vowelRatio < 0.15) return false
  }

  // Too many consecutive consonants (>4) = noise
  if (/[^aeiouyAEIOUY\d\s]{5,}/.test(alphaOnly)) return false

  // Ratio of alpha chars to total — if mostly symbols, noise
  if (alphaOnly.length > 0) {
    const alphaRatio = alphaOnly.length / core.length
    if (alphaRatio < 0.4 && !/\d/.test(core)) return false
  }

  // Character bigram Markov chain check — catches random character sequences
  // that pass structural heuristics (e.g. "xvkj", "ztpq", "mxzv")
  if (alphaOnly.length >= 3) {
    const bigramScore = scoreWord(core)
    if (bigramScore < 2.0) return false
  }

  return true
}

/**
 * Score a line for readability (0-1, higher = more likely real text)
 */
function lineReadabilityScore(line: string): number {
  const trimmed = line.trim()
  if (!trimmed) return 0

  // URLs and emails are always valid
  if (/https?:\/\/|www\.|[\w.-]+@[\w.-]+/.test(trimmed)) return 1

  const words = trimmed.split(/\s+/)
  if (words.length === 0) return 0

  const validCount = words.filter(isValidWord).length
  return validCount / words.length
}

/**
 * Clean up raw tesseract OCR output — removes graphic noise intelligently
 */
/**
 * Light structural cleanup after TSV confidence filtering.
 * TSV output already filtered low-confidence words, so this just
 * handles formatting: empty lines, whitespace, and residual short lines.
 */
function cleanOcrText(text: string): string {
  return text
    .replace(/\f/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((line) => {
      const trimmed = line.trim()
      if (trimmed.length === 0) return true // keep blank lines for structure
      // Remove lines with no alpha characters
      if (!/[a-zA-Z]/.test(trimmed)) return false
      // Remove very short lines (likely residual noise)
      if (trimmed.length < 3) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {3,}/g, ' ')
    .trim()
}

// ─── LLM Cleanup (optional, fast with small model) ─────────────────

let ollamaTextModel: string | null = null

async function getOllamaTextModel(): Promise<string | null> {
  if (ollamaTextModel !== null) return ollamaTextModel || null
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) {
      ollamaTextModel = ''
      return null
    }
    const data = await res.json()
    const models = (data.models || []) as { name: string; size: number }[]
    const textModels = models.filter(
      (m) => !m.name.includes('embed') && !m.name.includes('minicpm') && !m.name.includes('llava')
    )
    if (textModels.length > 0) {
      textModels.sort((a, b) => a.size - b.size)
      ollamaTextModel = textModels[0].name
      logger.info(`LLM cleanup model: ${ollamaTextModel}`)
      return ollamaTextModel
    }
  } catch {}
  ollamaTextModel = ''
  return null
}

async function llmCleanup(rawText: string): Promise<string> {
  const model = await getOllamaTextModel()
  if (!model) return rawText

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: `Fix this OCR text. Fix broken words, remove noise (|||, ===, random symbols), merge fragments. Keep ALL original content and language. Use markdown headings/lists/tables where appropriate. Output ONLY the cleaned text:\n\n${rawText}`,
          },
        ],
        stream: false,
        options: { temperature: 0, num_predict: 4096 },
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return rawText
    const data = await res.json()
    const cleaned = data.message?.content?.trim()
    if (!cleaned || cleaned.length < rawText.length * 0.3 || cleaned.length > rawText.length * 3) {
      return rawText
    }
    return cleaned
  } catch {
    return rawText
  }
}

// ─── Native Tesseract ──────────────────────────────────────────────

// Min confidence score (0-100) to keep a word. Tesseract LSTM outputs
// per-word confidence — words below this threshold are OCR noise from
// graphics, diagrams, or misrecognized visual elements.
const MIN_WORD_CONFIDENCE = 72
const MIN_CONF_1CHAR = 90 // single characters need very high confidence
const MIN_CONF_2CHAR = 82 // 2-char tokens need high confidence
const MIN_BLOCK_AVG_CONF = 55 // blocks below this avg confidence are dropped
const MIN_BLOCK_VALID_RATIO = 0.4 // blocks where <40% words are valid are dropped

// Standalone symbol/punctuation artifacts from OCR (graphics, borders, decorations)
const SYMBOL_ARTIFACT_RE = /^[|¦\[\](){}«»©®™<>\/\\;:,._~^`!@#$%&*+=\-–—""'']+$/

/**
 * Run Tesseract on a file using TSV output for confidence-based filtering.
 * PSM 3 = fully automatic page segmentation (correct for mixed content pages).
 * Words below MIN_WORD_CONFIDENCE are filtered out as noise.
 */
function tesseractOnFile(imagePath: string, language: string = 'eng'): Promise<string> {
  const outputBase = imagePath.replace(/\.[^.]+$/, '') + '_out'

  return new Promise<string>((resolve, reject) => {
    execFile(
      'tesseract',
      [
        imagePath,
        outputBase,
        '-l',
        language,
        '--oem',
        '1',
        '--psm',
        '3', // automatic page segmentation (was 6)
        '--dpi',
        '300',
        '-c',
        'invert_threshold=0.0', // skip inverted text pass (free speed)
        'tsv', // TSV output with per-word confidence
      ],
      { timeout: 60000 },
      async (error) => {
        if (error) {
          reject(new Error(`tesseract: ${error.message}`))
          return
        }
        try {
          const tsv = await readFile(`${outputBase}.tsv`, 'utf-8')
          await unlink(`${outputBase}.tsv`).catch(() => {})

          const text = parseTsvWithConfidence(tsv, MIN_WORD_CONFIDENCE)
          resolve(text)
        } catch (e: any) {
          reject(new Error(`read OCR output: ${e.message}`))
        }
      }
    )
  })
}

/**
 * Get minimum confidence threshold based on word length.
 * Short tokens are far more likely to be OCR artifacts, so they need higher confidence.
 */
function getMinConfidence(word: string, baseConf: number): number {
  const stripped = word.replace(/[^a-zA-Z0-9]/g, '')
  if (stripped.length <= 1) return MIN_CONF_1CHAR
  if (stripped.length <= 2) return MIN_CONF_2CHAR
  return baseConf
}

/**
 * Parse Tesseract TSV output and reconstruct text using confidence filtering.
 * TSV columns: level page_num block_num par_num line_num word_num left top width height conf text
 * level=5 is a word entry. Confidence is 0-100, -1 for non-word levels.
 *
 * Multi-layer filtering:
 *  1. Block-level: drop entire blocks with low average confidence or low valid-word ratio
 *  2. Word-level confidence: length-dependent thresholds (1-char ≥90, 2-char ≥82, 3+ ≥72)
 *  3. Symbol artifact filter: strip standalone symbols (|, «, ©, /, ;, etc.)
 *  4. isValidWord gate: structural + bigram check for remaining words
 */
function parseTsvWithConfidence(tsv: string, minConf: number): string {
  const rows = tsv.split('\n')
  if (rows.length < 2) return ''

  const header = rows[0].split('\t')
  const levelIdx = header.indexOf('level')
  const confIdx = header.indexOf('conf')
  const textIdx = header.indexOf('text')
  const lineIdx = header.indexOf('line_num')
  const parIdx = header.indexOf('par_num')
  const blockIdx = header.indexOf('block_num')

  if (confIdx === -1 || textIdx === -1 || levelIdx === -1) {
    // Fallback: couldn't parse TSV header, return raw text extraction
    return rows
      .slice(1)
      .map((r) => r.split('\t'))
      .filter((cols) => cols[levelIdx] === '5' && cols[textIdx]?.trim())
      .map((cols) => cols[textIdx].trim())
      .join(' ')
  }

  // ── Pass 1: Collect all words grouped by block for block-level analysis ──
  interface TsvWord {
    block: number
    par: number
    line: number
    conf: number
    text: string
    rowIdx: number
  }
  const allWords: TsvWord[] = []
  const blockWords = new Map<number, TsvWord[]>()

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split('\t')
    if (cols.length < header.length) continue
    const level = parseInt(cols[levelIdx])
    if (level !== 5) continue
    const word = cols[textIdx]?.trim()
    if (!word) continue
    const conf = parseInt(cols[confIdx])
    const block = parseInt(cols[blockIdx])
    const par = parseInt(cols[parIdx])
    const line = parseInt(cols[lineIdx])

    const entry: TsvWord = { block, par, line, conf, text: word, rowIdx: i }
    allWords.push(entry)
    if (!blockWords.has(block)) blockWords.set(block, [])
    blockWords.get(block)!.push(entry)
  }

  // ── Pass 2: Identify blocks to drop ──
  const droppedBlocks = new Set<number>()
  for (const [blockNum, words] of blockWords) {
    if (words.length < 2) continue // don't judge single-word blocks

    // Average confidence of the block
    const avgConf = words.reduce((sum, w) => sum + w.conf, 0) / words.length
    if (avgConf < MIN_BLOCK_AVG_CONF) {
      droppedBlocks.add(blockNum)
      continue
    }

    // Valid-word ratio check
    const validCount = words.filter((w) => {
      if (SYMBOL_ARTIFACT_RE.test(w.text)) return false
      if (w.conf < getMinConfidence(w.text, minConf)) return false
      return isValidWord(w.text)
    }).length
    const ratio = validCount / words.length
    if (ratio < MIN_BLOCK_VALID_RATIO) {
      droppedBlocks.add(blockNum)
    }
  }

  // ── Pass 3: Reconstruct text with word-level filtering ──
  let currentLine = ''
  let lastBlock = -1
  let lastPar = -1
  let lastLine = -1
  const lines: string[] = []
  let totalWords = 0
  let filteredConf = 0
  let filteredSymbol = 0
  let filteredValid = 0
  let filteredBlock = 0

  for (const w of allWords) {
    totalWords++

    // Block-level filter
    if (droppedBlocks.has(w.block)) {
      filteredBlock++
      continue
    }

    // New line/paragraph/block detected
    if (w.block !== lastBlock || w.par !== lastPar || w.line !== lastLine) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim())
      }
      // Add blank line between paragraphs/blocks
      if ((w.block !== lastBlock || w.par !== lastPar) && lastBlock !== -1) {
        lines.push('')
      }
      currentLine = ''
      lastBlock = w.block
      lastPar = w.par
      lastLine = w.line
    }

    // Symbol artifact filter (standalone symbols from graphic elements)
    if (SYMBOL_ARTIFACT_RE.test(w.text)) {
      filteredSymbol++
      continue
    }

    // Length-dependent confidence filter
    const requiredConf = getMinConfidence(w.text, minConf)
    if (w.conf < requiredConf) {
      filteredConf++
      continue
    }

    // Structural + bigram validity check
    if (!isValidWord(w.text)) {
      filteredValid++
      continue
    }

    currentLine += (currentLine ? ' ' : '') + w.text
  }

  // Don't forget the last line
  if (currentLine.trim()) {
    lines.push(currentLine.trim())
  }

  const totalFiltered = filteredConf + filteredSymbol + filteredValid + filteredBlock
  if (totalWords > 0) {
    logger.info(
      `TSV filter: ${totalFiltered}/${totalWords} words removed (${((totalFiltered / totalWords) * 100).toFixed(0)}%) — conf:${filteredConf} symbol:${filteredSymbol} invalid:${filteredValid} block:${filteredBlock} droppedBlocks:${droppedBlocks.size}`
    )
  }

  // Clean up: strip leading/trailing pipes and stray symbols from reconstructed lines
  return lines
    .map((l) =>
      l
        .replace(/^[|¦;\/\\]+\s*/, '')
        .replace(/\s*[|¦;\/\\]+$/, '')
        .trim()
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Run tesseract on multiple files in parallel batches
 */
async function tesseractParallel(
  imagePaths: string[],
  language: string = 'eng'
): Promise<string[]> {
  const results: string[] = new Array(imagePaths.length).fill('')

  for (let i = 0; i < imagePaths.length; i += PARALLEL_OCR) {
    const batch = imagePaths.slice(i, i + PARALLEL_OCR)
    const batchResults = await Promise.all(
      batch.map((path, idx) =>
        tesseractOnFile(path, language)
          .then((text) => {
            results[i + idx] = cleanOcrText(text)
          })
          .catch((err) => {
            logger.warn(`Tesseract page ${i + idx + 1} failed:`, err.message)
          })
      )
    )
  }

  return results
}

async function nativeOcr(imageBuffer: Buffer, language: string = 'eng'): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'ocr-'))
  const ext = detectImageExt(imageBuffer)
  const inputPath = join(tmpDir, `input${ext}`)

  try {
    await writeFile(inputPath, imageBuffer)
    const text = await tesseractOnFile(inputPath, language)
    return cleanOcrText(text)
  } finally {
    await unlink(inputPath).catch(() => {})
    const { rmdir } = await import('fs/promises')
    await rmdir(tmpDir).catch(() => {})
  }
}

// ─── PDF → Page Images (fast: 150 DPI JPEG) ────────────────────────

async function renderPdfPages(
  pdfBuffer: Buffer
): Promise<{ tmpDir: string; imagePaths: string[] }> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-ocr-'))
  const pdfPath = join(tmpDir, 'input.pdf')
  const outputPrefix = join(tmpDir, 'page')

  await writeFile(pdfPath, pdfBuffer)

  await new Promise<void>((resolve, reject) => {
    execFile(
      'pdftoppm',
      ['-jpeg', '-r', '300', '-jpegopt', 'quality=90', pdfPath, outputPrefix],
      { timeout: 120000 },
      (error) => {
        if (error) reject(new Error(`pdftoppm: ${error.message}`))
        else resolve()
      }
    )
  })

  const files = await readdir(tmpDir)
  const pageImages = files
    .filter((f) => f.startsWith('page-') && f.endsWith('.jpg'))
    .sort()
    .map((f) => join(tmpDir, f))

  logger.info(`pdftoppm rendered ${pageImages.length} pages (300 DPI JPEG)`)
  return { tmpDir, imagePaths: pageImages }
}

async function cleanupTmpDir(tmpDir: string) {
  try {
    const files = await readdir(tmpDir)
    await Promise.all(files.map((f) => unlink(join(tmpDir, f)).catch(() => {})))
    const { rmdir } = await import('fs/promises')
    await rmdir(tmpDir).catch(() => {})
  } catch {}
}

// ─── OcrParser (standalone images) ─────────────────────────────────

export class OcrParser implements FileParser {
  async performOcr(imageBuffer: Buffer, language: string = 'eng'): Promise<string> {
    if (await hasTool('tesseract')) {
      const raw = await nativeOcr(imageBuffer, language)
      const cleaned = await llmCleanup(raw)
      return cleaned
    }

    try {
      const Tesseract = await import('tesseract.js')
      const result = await Tesseract.recognize(imageBuffer, language)
      return cleanOcrText((result.data.text || '').trim())
    } catch (error: any) {
      throw new Error(`OCR failed: ${error?.message}`)
    }
  }

  async parseFile(filePath: string): Promise<FileParseResult> {
    const buffer = await readFile(filePath)
    return this.parseBuffer(buffer)
  }

  async parseBuffer(buffer: Buffer, language?: string): Promise<FileParseResult> {
    const text = await this.performOcr(buffer, language || 'eng')
    if (!text) {
      return { content: 'No text extracted.', metadata: { parser: 'ocr', isEmpty: true } }
    }
    return { content: text, metadata: { parser: 'ocr', textLength: text.length } }
  }
}

// ─── PdfOcrParser (scanned PDFs) ───────────────────────────────────

export class PdfOcrParser implements FileParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    const buffer = await readFile(filePath)
    return this.parseBuffer(buffer)
  }

  async parseBuffer(buffer: Buffer): Promise<FileParseResult> {
    const startTime = Date.now()
    logger.info('PDF OCR pipeline starting, size:', buffer.length)

    // Try text extraction first
    let totalPages = 0
    let extractedText = ''
    try {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const result = await extractText(pdf, { mergePages: true })
      totalPages = result.totalPages
      extractedText = (result.text as string)?.trim() || ''

      if (extractedText.length > 100) {
        return {
          content: extractedText,
          metadata: {
            parser: 'unpdf-text',
            pageCount: totalPages,
            textLength: extractedText.length,
          },
        }
      }
    } catch {}

    // Scanned PDF — fast pipeline: pdftoppm → parallel tesseract → LLM cleanup
    if (!(await hasTool('pdftoppm'))) {
      return {
        content: extractedText || `Scanned PDF (${totalPages} pages). No OCR tools available.`,
        metadata: { parser: 'pdf-no-ocr', pageCount: totalPages, isScanned: true },
      }
    }

    // Step 1: Render pages (200 DPI JPEG — fast)
    const t1 = Date.now()
    const { tmpDir, imagePaths } = await renderPdfPages(buffer)
    logger.info(`Render: ${Date.now() - t1}ms`)

    try {
      // Step 2: Parallel tesseract OCR
      const t2 = Date.now()
      const pageTexts = await tesseractParallel(imagePaths, 'eng')
      logger.info(`Tesseract (${PARALLEL_OCR} parallel): ${Date.now() - t2}ms`)

      // Log per-page text lengths for debugging
      const pageLengths = pageTexts.map((t, i) => `p${i + 1}:${t.length}`)
      logger.info(`Per-page text lengths: ${pageLengths.join(', ')}`)

      // Combine
      const allText = pageTexts
        .map((text, i) => (text.length > 5 ? `--- Page ${i + 1} ---\n${text}` : ''))
        .filter(Boolean)
        .join('\n\n')

      if (!allText || allText.length < 20) {
        return {
          content:
            extractedText ||
            `Scanned PDF (${totalPages || imagePaths.length} pages). OCR extracted no text.`,
          metadata: {
            parser: 'pdf-ocr-empty',
            pageCount: totalPages || imagePaths.length,
            isScanned: true,
          },
        }
      }

      const totalTime = Date.now() - startTime
      logger.info(`PDF OCR pipeline done in ${totalTime}ms`, {
        pages: imagePaths.length,
        textLength: allText.length,
      })

      return {
        content: allText,
        metadata: {
          parser: 'tesseract-ocr',
          pageCount: imagePaths.length,
          textLength: allText.length,
          processingMs: totalTime,
        },
      }
    } finally {
      await cleanupTmpDir(tmpDir)
    }
  }
}

export function needsOcr(content: string | null | undefined, fileSize: number): boolean {
  if (!content || typeof content !== 'string') return fileSize > 10000
  const clean = content.trim()
  if (clean.length < 100 && fileSize > 50000) return true
  const readable = clean.replace(/[^\x20-\x7E\r\n]/g, '').length
  return readable / (clean.length || 1) < 0.5 && fileSize > 10000
}
