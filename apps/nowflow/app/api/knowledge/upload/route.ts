import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getSession } from '@/lib/auth'
import { fileService } from '@/lib/files/file-service'
import { KnowledgeSourceService } from '@/lib/knowledge'
import { createLogger } from '@/lib/logs/console-logger'
import { StorageLimitService } from '@/lib/storage/storage-limit-service'
import { uploadToS3 } from '@/lib/uploads/s3-client'
import { UPLOAD_DIR, USE_S3_STORAGE } from '@/lib/uploads/setup'
import '@/lib/uploads/setup.server'
import { processDocument as processDocumentInBackground } from '@/app/api/knowledge/documents/route'

const logger = createLogger('KnowledgeUploadAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Max duration for large file processing (5 minutes)
export const maxDuration = 300

/**
 * POST - Upload and add document to knowledge source
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const sourceId = formData.get('sourceId') as string
    const files = formData.getAll('file') as File[]

    if (!sourceId) {
      return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 })
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const service = new KnowledgeSourceService(session.user.id)

    // Verify access to source
    const source = await service.getSource(sourceId)
    if (!source) {
      return NextResponse.json({ error: 'Source not found or access denied' }, { status: 404 })
    }

    logger.info(`Uploading ${files.length} file(s) to knowledge source`, {
      sourceId,
      userId: session.user.id,
      storageMode: USE_S3_STORAGE ? 'S3' : 'Local',
    })

    const uploadResults = []

    // Process each file
    for (const file of files) {
      try {
        const originalName = file.name
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        let filePath: string
        let fileUrl: string | undefined

        if (USE_S3_STORAGE) {
          // Upload to S3
          const result = await uploadToS3(buffer, originalName, file.type, file.size)
          filePath = result.key || result.path
          fileUrl = result.url
          logger.info(`Uploaded to S3: ${filePath}`)
        } else {
          // Upload to local storage
          const extension = originalName.split('.').pop() || ''
          const uniqueFilename = `${uuidv4()}.${extension}`
          const localPath = join(UPLOAD_DIR, uniqueFilename)

          await writeFile(localPath, buffer)
          filePath = `/api/files/serve/${uniqueFilename}`
          logger.info(`Uploaded to local storage: ${filePath}`)
        }

        // Extract text content (basic - can be enhanced)
        let rawContent: string | undefined
        try {
          if (file.type.startsWith('text/') || file.type === 'application/json') {
            rawContent = buffer.toString('utf-8')
          }
          // For other file types, content extraction would happen during processing
        } catch (err) {
          logger.warn('Could not extract text content immediately', {
            fileName: originalName,
            error: err,
          })
        }

        // Add document to knowledge source
        const document = await service.addDocument({
          sourceId,
          name: originalName,
          type: 'file',
          filePath,
          fileUrl,
          fileType: file.type,
          fileSize: file.size,
          rawContent,
          metadata: {
            uploadedBy: session.user.id,
            uploadedAt: new Date().toISOString(),
          },
        })

        // Also add to files table so it appears in Files page
        try {
          await fileService.uploadFile({
            userId: session.user.id,
            workspaceId: source.workspaceId || undefined,
            name: originalName,
            path: filePath,
            mimeType: file.type,
            size: file.size,
            knowledgeDocumentId: document.id,
            metadata: {
              sourceId,
              sourceName: source.name,
              uploadedVia: 'knowledge',
            },
          })
          logger.info('File also added to files table', { documentId: document.id })
        } catch (fileError: any) {
          logger.warn('Failed to add file to files table', { error: fileError?.message })
        }

        // Update workspace storage usage
        try {
          const storageService = new StorageLimitService(
            session.user.id,
            source.workspaceId || undefined
          )
          await storageService.updateStorageUsage(file.size)
          logger.info('Storage usage updated', { size: file.size, workspaceId: source.workspaceId })
        } catch (storageError: any) {
          logger.warn('Failed to update storage usage', { error: storageError?.message })
        }

        uploadResults.push({
          documentId: document.id,
          name: document.name,
          size: document.fileSize,
          type: document.fileType,
          status: document.status,
        })

        logger.info('Document added to knowledge source', {
          documentId: document.id,
          sourceId,
          fileName: originalName,
        })

        // Fire-and-forget: start processing in background
        // The client doesn't need to wait — it can poll status via GET
        processDocumentInBackground(document.id, session.user.id).catch((err) => {
          logger.error('Background processing failed', {
            documentId: document.id,
            error: err?.message || err,
          })
        })
      } catch (error: any) {
        logger.error('Failed to upload file', {
          fileName: file.name,
          error: error?.message || error,
        })

        uploadResults.push({
          name: file.name,
          error: error?.message || 'Upload failed',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results: uploadResults,
      total: files.length,
      succeeded: uploadResults.filter((r) => !r.error).length,
      failed: uploadResults.filter((r) => r.error).length,
    })
  } catch (error: any) {
    logger.error('Upload to knowledge source failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
