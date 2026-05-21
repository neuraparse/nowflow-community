/**
 * Unit tests for RawPdfParser
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RawPdfParser } from '../raw-pdf-parser'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  })),
}))

const mockReadFile = vi.fn()
vi.mock('fs/promises', () => ({
  readFile: (...args: any[]) => mockReadFile(...args),
}))

describe('RawPdfParser', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseBuffer', () => {
    it('extracts PDF version from header', async () => {
      const pdf = '%PDF-1.7\n/Type /Page\n/Type /Page\n' + 'x'.repeat(200)
      const parser = new RawPdfParser()
      const result = await parser.parseBuffer(Buffer.from(pdf))

      expect(result.metadata?.version).toBe('1.7')
    })

    it('counts pages via /Type /Page markers', async () => {
      const pdf = '%PDF-1.5\n' + Array(3).fill('/Type /Page\n').join('') + 'x'.repeat(200)
      const parser = new RawPdfParser()
      const result = await parser.parseBuffer(Buffer.from(pdf))

      expect(result.metadata?.pageCount).toBe(3)
    })

    it('defaults page count to 1 when no markers present', async () => {
      const pdf = '%PDF-1.4\n' + 'binary junk here'.repeat(20)
      const parser = new RawPdfParser()
      const result = await parser.parseBuffer(Buffer.from(pdf))

      expect(result.metadata?.pageCount).toBe(1)
    })

    it('returns a fallback content message when text cannot be extracted', async () => {
      const pdf = '%PDF-1.4\n' + 'xxxxx'.repeat(50)
      const parser = new RawPdfParser()
      const result = await parser.parseBuffer(Buffer.from(pdf))

      expect(result.content).toContain('This is a PDF document')
      expect(result.content).toContain('version 1.4')
      expect(result.content).toContain(`File size: ${pdf.length} bytes`)
    })

    it('includes RawExtraction metadata on success', async () => {
      const pdf = '%PDF-1.6\n/Type /Page\n' + 'junk data'.repeat(100)
      const parser = new RawPdfParser()
      const result = await parser.parseBuffer(Buffer.from(pdf))

      expect(result.metadata?.info).toMatchObject({
        RawExtraction: true,
        Version: '1.6',
      })
      expect(result.metadata?.info?.Size).toBeGreaterThan(0)
    })

    it('falls back gracefully on unknown version', async () => {
      const pdf = 'no-pdf-header-here-' + 'x'.repeat(200)
      const parser = new RawPdfParser()
      const result = await parser.parseBuffer(Buffer.from(pdf))

      expect(result.metadata?.version).toBe('Unknown')
    })

    it('extracts metadata title from XMP', async () => {
      const xmp = `<x:xmpmeta><dc:title><rdf:li>My Doc</rdf:li></dc:title></x:xmpmeta>`
      const pdf = `%PDF-1.5\n/Type /Page\n${xmp}\n` + 'xx'.repeat(200)
      const parser = new RawPdfParser()
      const result = await parser.parseBuffer(Buffer.from(pdf))

      expect(result.content).toContain('Document Title: My Doc')
    })
  })

  describe('parseFile', () => {
    it('reads file then delegates to parseBuffer', async () => {
      mockReadFile.mockResolvedValue(Buffer.from('%PDF-1.5\n/Type /Page\n' + 'x'.repeat(200)))
      const parser = new RawPdfParser()
      const result = await parser.parseFile('/path/to.pdf')

      expect(mockReadFile).toHaveBeenCalledWith('/path/to.pdf')
      expect(result.metadata?.version).toBe('1.5')
    })

    it('returns error object when file cannot be read', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'))
      const parser = new RawPdfParser()
      const result = await parser.parseFile('/missing.pdf')

      expect(result.content).toContain('Error parsing PDF')
      expect(result.metadata?.error).toBe('ENOENT')
      expect(result.metadata?.pageCount).toBe(0)
      expect(result.metadata?.version).toBe('unknown')
    })

    it('returns error object when path is empty', async () => {
      const parser = new RawPdfParser()
      const result = await parser.parseFile('')
      expect(result.content).toContain('Error parsing PDF')
      expect(result.metadata?.error).toBe('No file path provided')
    })
  })
})
