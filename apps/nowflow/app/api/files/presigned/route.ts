import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { requireSession } from '@/lib/request-auth'
import { USE_S3_STORAGE } from '@/lib/uploads/setup'
import { createErrorResponse, createOptionsResponse } from '../utils'

const logger = createLogger('PresignedUploadAPI')

interface PresignedUrlRequest {
  fileName: string
  contentType: string
  fileSize: number
}

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await requireSession()
    if (sessionResult instanceof NextResponse) {
      return sessionResult
    }

    // Parse the request body
    const data: PresignedUrlRequest = await request.json()
    const { fileName, contentType } = data

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Missing fileName or contentType' }, { status: 400 })
    }

    // Only proceed if S3 storage is enabled
    if (!USE_S3_STORAGE) {
      return NextResponse.json(
        {
          error: 'Direct uploads are only available when S3 storage is enabled',
          directUploadSupported: false,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error:
          'Direct uploads are temporarily disabled until secure upload finalization is enabled',
        directUploadSupported: false,
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Error generating presigned URL:', error)
    return createErrorResponse(
      error instanceof Error ? error : new Error('Failed to generate presigned URL')
    )
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return createOptionsResponse()
}
