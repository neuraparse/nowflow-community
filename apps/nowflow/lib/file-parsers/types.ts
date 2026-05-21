export interface FileParseResult {
  content: string
  metadata?: Record<string, any>
}

export interface FileParser {
  parseFile(filePath: string): Promise<FileParseResult>
  parseBuffer?(buffer: Buffer, extension?: string): Promise<FileParseResult>
}

/**
 * All supported file types for knowledge source documents
 */
export type SupportedFileType =
  // Documents
  | 'pdf'
  | 'docx'
  | 'doc'
  // Spreadsheets
  | 'xlsx'
  | 'xls'
  | 'csv'
  // Presentations
  | 'pptx'
  | 'ppt'
  // Text formats
  | 'txt'
  | 'md'
  | 'markdown'
  // Structured data
  | 'json'
  | 'xml'
  // Web
  | 'html'
  | 'htm'
  // Open formats
  | 'odt'
  | 'ods'
  | 'odp'
  // Rich text
  | 'rtf'
  // Images (OCR support)
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'gif'
  | 'bmp'
  | 'tiff'
  | 'tif'
  | 'webp'

/**
 * File type categories for UI display
 */
export const FILE_TYPE_CATEGORIES = {
  documents: ['pdf', 'docx', 'doc', 'odt', 'rtf'],
  spreadsheets: ['xlsx', 'xls', 'csv', 'ods'],
  presentations: ['pptx', 'ppt', 'odp'],
  text: ['txt', 'md', 'markdown'],
  structured: ['json', 'xml'],
  web: ['html', 'htm'],
  images: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp'],
} as const

/**
 * MIME type mappings
 */
export const MIME_TO_EXTENSION: Record<string, SupportedFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/html': 'html',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/rtf': 'rtf',
  // Images (OCR support)
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/webp': 'webp',
}

/**
 * Get extension from MIME type
 */
export function getExtensionFromMime(mimeType: string): SupportedFileType | null {
  return MIME_TO_EXTENSION[mimeType] || null
}
