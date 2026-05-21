import { NextRequest, NextResponse } from 'next/server'
import { and, eq, or } from 'drizzle-orm'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { fileService } from '@/lib/files/file-service'
import { createLogger } from '@/lib/logs/console-logger'
import { requireSession } from '@/lib/request-auth'
import { isStorageLimitError, StorageLimitService } from '@/lib/storage/storage-limit-service'
import { uploadToS3 } from '@/lib/uploads/s3-client'
import { UPLOAD_DIR, USE_S3_STORAGE } from '@/lib/uploads/setup'
// Import to ensure the uploads directory is created
import '@/lib/uploads/setup.server'
import { db } from '@/db'
import { workspace, workspaceMember } from '@/db/schema'
import { createErrorResponse, createOptionsResponse, InvalidRequestError } from '../utils'

const logger = createLogger('FilesUploadAPI')

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await requireSession()
    if (sessionResult instanceof NextResponse) {
      return sessionResult
    }

    const formData = await request.formData()

    // Check if multiple files are being uploaded or a single file
    const files = formData.getAll('file') as File[]

    if (!files || files.length === 0) {
      throw new InvalidRequestError('No files provided')
    }

    const workspaceId = formData.get('workspaceId') as string | null
    const session = sessionResult

    if (workspaceId) {
      const accessibleWorkspace = await db
        .select({ id: workspace.id })
        .from(workspace)
        .leftJoin(
          workspaceMember,
          and(
            eq(workspaceMember.workspaceId, workspace.id),
            eq(workspaceMember.userId, session.user.id)
          )
        )
        .where(
          and(
            eq(workspace.id, workspaceId),
            or(eq(workspace.ownerId, session.user.id), eq(workspaceMember.userId, session.user.id))
          )
        )
        .limit(1)

      if (accessibleWorkspace.length === 0) {
        return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
      }
    }

    // Check storage limit for file uploads
    const storageService = new StorageLimitService(session.user.id, workspaceId || undefined)

    // Calculate total file size
    const totalFileSize = files.reduce((sum, file) => sum + file.size, 0)

    try {
      await storageService.checkStorageLimit(totalFileSize)
    } catch (error) {
      if (isStorageLimitError(error)) {
        logger.warn('Storage limit exceeded during upload', {
          userId: session.user.id,
          workspaceId,
          attempted: error.attempted,
          used: error.used,
          limit: error.limit,
        })

        return NextResponse.json(
          {
            error: 'Storage limit exceeded',
            message: `You've reached your storage limit. Please upgrade your plan or delete some files.`,
            details: {
              used: error.used,
              limit: error.limit,
              attempted: error.attempted,
            },
          },
          { status: 413 } // 413 Payload Too Large
        )
      }

      throw error
    }

    // Log storage mode
    logger.info(`Using storage mode: ${USE_S3_STORAGE ? 'S3' : 'Local'} for file upload`)

    // OPTIMIZATION: Parallelize file uploads with Promise.all()
    // Sequential uploads: 3 files × 100ms = 300ms
    // Parallel uploads: max(100ms) = 100ms → 3x faster
    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const originalName = file.name
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        if (USE_S3_STORAGE) {
          // Upload to S3 in production
          try {
            logger.info(`Uploading file to S3: ${originalName}`)
            const result = await uploadToS3(buffer, originalName, file.type, file.size)
            logger.info(`Successfully uploaded to S3: ${result.key}`)
            return result
          } catch (error) {
            logger.error('Error uploading to S3:', error)
            throw error
          }
        } else {
          // Upload to local file system in development
          const extension = originalName.split('.').pop() || ''
          const uniqueFilename = `${uuidv4()}.${extension}`
          const filePath = join(UPLOAD_DIR, uniqueFilename)

          logger.info(`Uploading file to local storage: ${filePath}`)
          await writeFile(filePath, buffer)
          logger.info(`Successfully wrote file to: ${filePath}`)

          return {
            path: `/api/files/serve/${uniqueFilename}`,
            name: originalName,
            size: file.size,
            type: file.type,
          }
        }
      })
    )

    // STEP 1: Create file records in the file table (ALWAYS, independent of knowledge)
    const fileRecords = []

    for (const result of uploadResults) {
      try {
        const fileRecord = await fileService.uploadFile({
          userId: session.user.id,
          workspaceId: workspaceId || undefined,
          name: result.name,
          path: result.path,
          mimeType: result.type,
          size: result.size,
          metadata: {
            uploadedVia: 'api',
            originalName: result.name,
          },
        })

        fileRecords.push(fileRecord)
        logger.info('File record created', {
          fileId: fileRecord.id,
          fileName: fileRecord.name,
        })

        // Update storage usage
        try {
          await storageService.updateStorageUsage(result.size)
          logger.info('Storage usage updated', { size: result.size })
        } catch (storageError) {
          logger.error('Failed to update storage usage', storageError)
        }
      } catch (error) {
        logger.error('Failed to create file record', error)
      }
    }

    // NOTE: Files are now stored ONLY in the file table.
    // To add files to Knowledge Sources, users must do so manually via /w/knowledge page.
    // This keeps file management and knowledge management separate and clear.

    if (files.length === 1) {
      return NextResponse.json({
        ...uploadResults[0],
        fileRecords: fileRecords.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          linkedToKnowledge: !!f.knowledgeDocumentId,
        })),
      })
    }

    return NextResponse.json({
      files: uploadResults,
      fileRecords: fileRecords.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        linkedToKnowledge: !!f.knowledgeDocumentId,
      })),
    })
  } catch (error) {
    logger.error('Error uploading files:', error)
    return createErrorResponse(error instanceof Error ? error : new Error('Failed to upload files'))
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return createOptionsResponse()
}
