/**
 * Files API
 *
 * List and manage uploaded files (separate from knowledge documents)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { fileService } from '@/lib/files/file-service'
import { createLogger } from '@/lib/logs/console-logger'
import { createErrorResponse, InvalidRequestError } from './utils'

const logger = createLogger('FilesAPI')

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') as 'active' | 'archived' | 'deleted' | null
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const files = await fileService.listFiles({
      userId: session.user.id,
      workspaceId: workspaceId || undefined,
      status: status || undefined,
      limit,
      offset,
    })

    logger.info('Files listed', {
      userId: session.user.id,
      workspaceId,
      count: files.length,
    })

    return NextResponse.json(files)
  } catch (error) {
    logger.error('Error listing files:', error)
    return createErrorResponse(error instanceof Error ? error : new Error('Failed to list files'))
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await request.json()

    if (!fileId) {
      throw new InvalidRequestError('File ID is required')
    }

    // Soft delete the file
    const deletedFile = await fileService.deleteFile(fileId, session.user.id)

    if (!deletedFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    logger.info('File deleted', {
      fileId: deletedFile.id,
      fileName: deletedFile.name,
      userId: session.user.id,
    })

    return NextResponse.json({ success: true, file: deletedFile })
  } catch (error) {
    logger.error('Error deleting file:', error)
    return createErrorResponse(error instanceof Error ? error : new Error('Failed to delete file'))
  }
}
