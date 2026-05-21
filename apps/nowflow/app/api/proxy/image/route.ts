import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { assertSafePublicUrl } from '@/lib/network/url-security'
import { requireSessionOrInternalApiKey } from '@/lib/request-auth'

const logger = createLogger('ProxyImageAPI')
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

export async function GET(request: Request) {
  try {
    const authResult = await requireSessionOrInternalApiKey(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      logger.error('Missing URL parameter in proxy image request')
      return new NextResponse('Missing URL parameter', { status: 400 })
    }

    let safeImageUrl: URL
    try {
      safeImageUrl = await assertSafePublicUrl(imageUrl)
    } catch (error) {
      return new NextResponse(error instanceof Error ? error.message : 'URL not allowed', {
        status: 403,
      })
    }

    logger.info('Proxying image from:', safeImageUrl.toString())

    // Add appropriate headers for fetching images
    const response = await fetch(safeImageUrl, {
      headers: {
        Accept: 'image/*, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxyBot/1.0)',
      },
      // Set a reasonable timeout
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      logger.error(`Failed to fetch image from ${imageUrl}:`, response.status, response.statusText)
      return new NextResponse(`Failed to fetch image: ${response.status} ${response.statusText}`, {
        status: response.status,
      })
    }

    const contentType = response.headers.get('content-type')
    logger.debug('Image content-type:', contentType)

    if (!contentType?.startsWith('image/')) {
      logger.error('Rejected non-image response from proxy target:', contentType)
      return new NextResponse('Upstream URL did not return an image', { status: 422 })
    }

    const blob = await response.blob()
    logger.debug('Image size:', blob.size, 'bytes')

    if (blob.size === 0) {
      logger.error('Empty image received from source URL')
      return new NextResponse('Empty image received from source', { status: 422 })
    }

    if (blob.size > MAX_IMAGE_BYTES) {
      logger.error('Image exceeded proxy size limit:', blob.size)
      return new NextResponse('Image exceeds proxy size limit', { status: 413 })
    }

    // Return the image with appropriate headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000', // Cache for a year
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    // Log the full error for debugging
    logger.error('Error proxying image:', error)

    // Return a helpful error response
    return new NextResponse(
      `Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    )
  }
}
