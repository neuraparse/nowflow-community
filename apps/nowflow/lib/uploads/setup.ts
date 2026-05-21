import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('UploadsSetup')

// Keep local uploads scoped to a concrete subdirectory so standalone tracing
// does not treat the whole workspace as a runtime dependency.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'

export const USE_S3_STORAGE = process.env.USE_S3 === 'true'

export const S3_CONFIG = {
  bucket: process.env.S3_BUCKET_NAME || '',
  region: process.env.AWS_REGION || '',
}

/**
 * Ensures that the uploads directory exists (for local storage)
 */
export async function ensureUploadsDirectory() {
  if (USE_S3_STORAGE) {
    logger.info('Using S3 storage, skipping local uploads directory creation')
    return true
  }

  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    } else {
      logger.info(`Uploads directory already exists at ${UPLOAD_DIR}`)
    }
    return true
  } catch (error) {
    logger.error('Failed to create uploads directory:', error)
    return false
  }
}
