/**
 * Barrel export for upload-side I/O (S3 + local FS abstraction).
 *
 * Consolidates the public surface of `lib/uploads/` so callers can import
 * everything from `@/lib/uploads` without reaching into nested files.
 * Existing `from '@/lib/uploads/setup'` and `'@/lib/uploads/s3-client'`
 * imports continue to work unchanged.
 */

export { UPLOAD_DIR, USE_S3_STORAGE, S3_CONFIG, ensureUploadsDirectory } from './setup'
export {
  s3Client,
  getS3Client,
  uploadToS3,
  getPresignedUrl,
  downloadFromS3,
  deleteFromS3,
} from './s3-client'
export type { FileInfo } from './s3-client'
