/**
 * Barrel export for file lifecycle utilities.
 *
 * The audit recommended consolidating `lib/files`, `lib/uploads`, and
 * `lib/storage` into a single `lib/file-system` namespace. A full merge would
 * touch dozens of import sites, so this file ships the safer first half:
 * a single re-export surface that callers can migrate to incrementally.
 *
 * Usage:
 *   import { fileService, FileService } from '@/lib/files'
 *
 * Existing `from '@/lib/files/file-service'` imports keep working — this
 * barrel does not break the original module path.
 */

export { FileService, fileService } from './file-service'
export type { FileStatus, FileUploadInput, FileUpdateInput, FileListOptions } from './file-service'
