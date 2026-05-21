/**
 * File Service
 *
 * Manages file uploads, downloads, and storage independently from knowledge sources.
 * This service handles pure file management without automatic AI processing.
 */
import { randomUUID } from 'crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import { existsSync } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { createLogger } from '@/lib/logs/console-logger'
import { UPLOAD_DIR, USE_S3_STORAGE } from '@/lib/uploads/setup'
import { db } from '@/db'
import { file, fileVersion, knowledgeChunk, knowledgeDocument, knowledgeSource } from '@/db/schema'

const logger = createLogger('FileService')

export type FileStatus = 'active' | 'archived' | 'deleted'

export interface FileUploadInput {
  userId: string
  workspaceId?: string
  name: string
  path: string
  mimeType: string
  size: number
  metadata?: Record<string, any>
  knowledgeDocumentId?: string
}

export interface FileUpdateInput {
  name?: string
  status?: FileStatus
  metadata?: Record<string, any>
}

export interface FileListOptions {
  userId: string
  workspaceId?: string
  status?: FileStatus
  limit?: number
  offset?: number
}

export class FileService {
  /**
   * Upload a new file
   */
  async uploadFile(input: FileUploadInput) {
    const fileRecord = await db
      .insert(file)
      .values({
        id: randomUUID(),
        userId: input.userId,
        workspaceId: input.workspaceId || null,
        name: input.name,
        path: input.path,
        mimeType: input.mimeType,
        size: input.size,
        metadata: input.metadata || null,
        knowledgeDocumentId: input.knowledgeDocumentId || null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return fileRecord[0]
  }

  /**
   * Get a file by ID
   */
  async getFileById(fileId: string, userId: string) {
    const files = await db
      .select()
      .from(file)
      .where(and(eq(file.id, fileId), eq(file.userId, userId)))
      .limit(1)

    return files[0] || null
  }

  /**
   * List files for a user/workspace
   */
  async listFiles(options: FileListOptions) {
    const conditions = [eq(file.userId, options.userId)]

    if (options.workspaceId) {
      conditions.push(eq(file.workspaceId, options.workspaceId))
    }

    if (options.status) {
      conditions.push(eq(file.status, options.status))
    }

    const files = await db
      .select()
      .from(file)
      .where(and(...conditions))
      .orderBy(desc(file.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0)

    return files
  }

  /**
   * Update a file
   */
  async updateFile(fileId: string, userId: string, updates: FileUpdateInput) {
    const updatedFile = await db
      .update(file)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(file.id, fileId), eq(file.userId, userId)))
      .returning()

    return updatedFile[0] || null
  }

  /**
   * Soft delete a file
   */
  async deleteFile(fileId: string, userId: string) {
    // First get the file to check for linked knowledge document
    const fileRecord = await this.getFileById(fileId, userId)

    if (fileRecord?.knowledgeDocumentId) {
      // Delete the linked knowledge document and its chunks
      try {
        // Get document info for updating source stats
        const docs = await db
          .select()
          .from(knowledgeDocument)
          .where(eq(knowledgeDocument.id, fileRecord.knowledgeDocumentId))
          .limit(1)

        if (docs.length > 0) {
          const doc = docs[0]

          // Delete chunks first
          await db.delete(knowledgeChunk).where(eq(knowledgeChunk.documentId, doc.id))

          // Delete document
          await db.delete(knowledgeDocument).where(eq(knowledgeDocument.id, doc.id))

          // Update source counts
          await db
            .update(knowledgeSource)
            .set({
              documentCount: sql`GREATEST(${knowledgeSource.documentCount} - 1, 0)`,
              totalSize: sql`GREATEST(${knowledgeSource.totalSize} - ${doc.fileSize || 0}, 0)`,
              updatedAt: new Date(),
            })
            .where(eq(knowledgeSource.id, doc.sourceId))

          logger.info('Linked knowledge document deleted', {
            fileId,
            knowledgeDocumentId: fileRecord.knowledgeDocumentId,
          })
        }
      } catch (error) {
        logger.error('Failed to delete linked knowledge document', {
          fileId,
          knowledgeDocumentId: fileRecord.knowledgeDocumentId,
          error,
        })
      }
    }

    const deletedFile = await db
      .update(file)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(file.id, fileId), eq(file.userId, userId)))
      .returning()

    // Update workspace storage usage
    if (deletedFile[0]?.workspaceId && deletedFile[0]?.size) {
      try {
        const { StorageLimitService } = await import('@/lib/storage/storage-limit-service')
        const storageService = new StorageLimitService(userId, deletedFile[0].workspaceId)
        await storageService.updateStorageUsage(-deletedFile[0].size)
        logger.info('Storage usage updated after file delete', {
          fileId,
          size: -deletedFile[0].size,
        })
      } catch (error) {
        logger.error('Failed to update storage usage on file delete', { error })
      }
    }

    // Delete physical file from storage
    if (deletedFile[0]?.path) {
      try {
        await this.deletePhysicalFile(deletedFile[0].path)
        logger.info('Physical file deleted', { fileId, path: deletedFile[0].path })
      } catch (error) {
        logger.warn('Failed to delete physical file (may already be deleted)', {
          fileId,
          path: deletedFile[0].path,
          error,
        })
      }
    }

    return deletedFile[0] || null
  }

  /**
   * Delete physical file from storage (local or S3)
   */
  private async deletePhysicalFile(filePath: string): Promise<void> {
    // Extract filename from path like /api/files/serve/uuid.ext
    const filename = filePath.includes('/api/files/serve/')
      ? filePath.split('/api/files/serve/')[1]
      : filePath.split('/').pop()

    if (!filename) {
      logger.warn('Could not extract filename from path', { filePath })
      return
    }

    if (USE_S3_STORAGE || filePath.includes('/s3/')) {
      // Delete from S3
      try {
        const { deleteFromS3 } = await import('@/lib/uploads/s3-client')
        await deleteFromS3(filename)
        logger.info('File deleted from S3', { filename })
      } catch (error) {
        logger.error('Failed to delete from S3', { filename, error })
        throw error
      }
    } else {
      // Delete from local storage
      const fullPath = join(UPLOAD_DIR, filename)
      if (existsSync(fullPath)) {
        await unlink(fullPath)
        logger.info('File deleted from local storage', { fullPath })
      } else {
        logger.info('Local file not found (already deleted?)', { fullPath })
      }
    }
  }

  /**
   * Permanently delete a file (hard delete)
   */
  async permanentlyDeleteFile(fileId: string, userId: string) {
    const deletedFile = await db
      .delete(file)
      .where(and(eq(file.id, fileId), eq(file.userId, userId)))
      .returning()

    return deletedFile[0] || null
  }

  /**
   * Create a new version of a file
   */
  async createFileVersion(
    fileId: string,
    userId: string,
    path: string,
    size: number,
    checksum?: string
  ) {
    // Get the file to verify ownership
    const fileRecord = await this.getFileById(fileId, userId)
    if (!fileRecord) {
      throw new Error('File not found')
    }

    // Get the current highest version number
    const versions = await db
      .select()
      .from(fileVersion)
      .where(eq(fileVersion.fileId, fileId))
      .orderBy(desc(fileVersion.version))
      .limit(1)

    const nextVersion = versions[0] ? versions[0].version + 1 : 1

    // Create the new version
    const newVersion = await db
      .insert(fileVersion)
      .values({
        id: randomUUID(),
        fileId,
        version: nextVersion,
        path,
        size,
        checksum: checksum || null,
        metadata: null,
        createdAt: new Date(),
      })
      .returning()

    // Update the file's path to the new version
    await db
      .update(file)
      .set({
        path,
        size,
        updatedAt: new Date(),
      })
      .where(eq(file.id, fileId))

    return newVersion[0]
  }

  /**
   * Get file versions
   */
  async getFileVersions(fileId: string, userId: string) {
    // Verify ownership
    const fileRecord = await this.getFileById(fileId, userId)
    if (!fileRecord) {
      throw new Error('File not found')
    }

    const versions = await db
      .select()
      .from(fileVersion)
      .where(eq(fileVersion.fileId, fileId))
      .orderBy(desc(fileVersion.version))

    return versions
  }

  /**
   * Link a file to a knowledge document
   */
  async linkToKnowledge(fileId: string, userId: string, knowledgeDocumentId: string) {
    const updatedFile = await db
      .update(file)
      .set({
        knowledgeDocumentId,
        updatedAt: new Date(),
      })
      .where(and(eq(file.id, fileId), eq(file.userId, userId)))
      .returning()

    return updatedFile[0] || null
  }

  /**
   * Unlink a file from a knowledge document
   */
  async unlinkFromKnowledge(fileId: string, userId: string) {
    const updatedFile = await db
      .update(file)
      .set({
        knowledgeDocumentId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(file.id, fileId), eq(file.userId, userId)))
      .returning()

    return updatedFile[0] || null
  }

  /**
   * Calculate total storage used by a user
   */
  async calculateUserStorage(userId: string, workspaceId?: string): Promise<number> {
    const conditions = [eq(file.userId, userId), eq(file.status, 'active')]

    if (workspaceId) {
      conditions.push(eq(file.workspaceId, workspaceId))
    }

    const files = await db
      .select()
      .from(file)
      .where(and(...conditions))

    return files.reduce((total: number, f: { size: number | null }) => total + (f.size || 0), 0)
  }
}

export const fileService = new FileService()
