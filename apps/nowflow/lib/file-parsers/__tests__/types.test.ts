/**
 * Unit tests for file-parser type helpers
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { FILE_TYPE_CATEGORIES, getExtensionFromMime, MIME_TO_EXTENSION } from '../types'

describe('FILE_TYPE_CATEGORIES', () => {
  it('groups documents correctly', () => {
    expect(FILE_TYPE_CATEGORIES.documents).toEqual(['pdf', 'docx', 'doc', 'odt', 'rtf'])
  })

  it('groups spreadsheets correctly', () => {
    expect(FILE_TYPE_CATEGORIES.spreadsheets).toEqual(['xlsx', 'xls', 'csv', 'ods'])
  })

  it('groups presentations correctly', () => {
    expect(FILE_TYPE_CATEGORIES.presentations).toEqual(['pptx', 'ppt', 'odp'])
  })

  it('groups text formats correctly', () => {
    expect(FILE_TYPE_CATEGORIES.text).toEqual(['txt', 'md', 'markdown'])
  })

  it('groups structured data correctly', () => {
    expect(FILE_TYPE_CATEGORIES.structured).toEqual(['json', 'xml'])
  })

  it('groups web formats correctly', () => {
    expect(FILE_TYPE_CATEGORIES.web).toEqual(['html', 'htm'])
  })

  it('groups images correctly', () => {
    expect(FILE_TYPE_CATEGORIES.images).toEqual([
      'png',
      'jpg',
      'jpeg',
      'gif',
      'bmp',
      'tiff',
      'tif',
      'webp',
    ])
  })
})

describe('MIME_TO_EXTENSION', () => {
  it('maps PDF mime', () => {
    expect(MIME_TO_EXTENSION['application/pdf']).toBe('pdf')
  })

  it('maps DOCX mime', () => {
    expect(
      MIME_TO_EXTENSION['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    ).toBe('docx')
  })

  it('maps CSV mime', () => {
    expect(MIME_TO_EXTENSION['text/csv']).toBe('csv')
  })

  it('maps plain text mime', () => {
    expect(MIME_TO_EXTENSION['text/plain']).toBe('txt')
  })

  it('maps both xml mime variants', () => {
    expect(MIME_TO_EXTENSION['application/xml']).toBe('xml')
    expect(MIME_TO_EXTENSION['text/xml']).toBe('xml')
  })

  it('maps image mimes', () => {
    expect(MIME_TO_EXTENSION['image/png']).toBe('png')
    expect(MIME_TO_EXTENSION['image/jpeg']).toBe('jpg')
    expect(MIME_TO_EXTENSION['image/jpg']).toBe('jpg')
    expect(MIME_TO_EXTENSION['image/gif']).toBe('gif')
    expect(MIME_TO_EXTENSION['image/webp']).toBe('webp')
  })
})

describe('getExtensionFromMime', () => {
  it('returns the mapped extension for a known mime type', () => {
    expect(getExtensionFromMime('application/pdf')).toBe('pdf')
    expect(getExtensionFromMime('text/csv')).toBe('csv')
    expect(getExtensionFromMime('application/json')).toBe('json')
  })

  it('returns null for unknown mime types', () => {
    expect(getExtensionFromMime('application/octet-stream')).toBeNull()
    expect(getExtensionFromMime('foo/bar')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getExtensionFromMime('')).toBeNull()
  })

  it('is case-sensitive (does not normalize mime casing)', () => {
    // Verifies exact key lookup behavior (documenting current behavior)
    expect(getExtensionFromMime('APPLICATION/PDF')).toBeNull()
    expect(getExtensionFromMime('application/pdf')).toBe('pdf')
  })

  it('returns opendocument extensions correctly', () => {
    expect(getExtensionFromMime('application/vnd.oasis.opendocument.text')).toBe('odt')
    expect(getExtensionFromMime('application/vnd.oasis.opendocument.spreadsheet')).toBe('ods')
    expect(getExtensionFromMime('application/vnd.oasis.opendocument.presentation')).toBe('odp')
  })
})
