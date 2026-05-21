import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('YouTubeTranscript')

interface TranscriptLine {
  text: string
  start: number
  duration: number
}

/**
 * Fetch YouTube transcript without requiring API key
 * This uses the internal YouTube API that powers the transcript feature
 */
async function fetchTranscript(videoId: string, lang?: string): Promise<TranscriptLine[]> {
  try {
    // First, fetch the video page to get the initial data
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`
    const videoPageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!videoPageResponse.ok) {
      throw new Error('Failed to fetch video page')
    }

    const html = await videoPageResponse.text()

    // Extract the ytInitialPlayerResponse from the page
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)
    if (!playerResponseMatch) {
      throw new Error('Could not find player response in video page')
    }

    const playerResponse = JSON.parse(playerResponseMatch[1])

    // Get caption tracks
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

    if (!captionTracks || captionTracks.length === 0) {
      throw new Error('No captions available for this video')
    }

    // Find the requested language or default to the first available
    let selectedTrack = captionTracks[0]
    if (lang) {
      const langTrack = captionTracks.find((track: any) => track.languageCode === lang)
      if (langTrack) {
        selectedTrack = langTrack
      }
    }

    // Fetch the transcript from the caption URL
    const transcriptUrl = selectedTrack.baseUrl
    const transcriptResponse = await fetch(transcriptUrl)

    if (!transcriptResponse.ok) {
      throw new Error('Failed to fetch transcript data')
    }

    const transcriptXml = await transcriptResponse.text()

    // Parse the XML transcript
    const textMatches = transcriptXml.matchAll(
      /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g
    )

    const transcript: TranscriptLine[] = []
    for (const match of textMatches) {
      const start = parseFloat(match[1])
      const duration = parseFloat(match[2])
      const text = decodeHTMLEntities(match[3])

      transcript.push({
        text,
        start,
        duration,
      })
    }

    return transcript
  } catch (error) {
    logger.error('Error fetching transcript:', error)
    throw error
  }
}

/**
 * Decode HTML entities in transcript text
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const videoId = searchParams.get('videoId')
    const lang = searchParams.get('lang') || undefined

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_-]{6,32}$/.test(videoId)) {
      return NextResponse.json({ error: 'Invalid videoId' }, { status: 400 })
    }

    logger.info(`Fetching transcript for video: ${videoId}`, { lang })

    const transcript = await fetchTranscript(videoId, lang)
    const fullText = transcript.map((line) => line.text).join(' ')

    return NextResponse.json({
      transcript,
      fullText,
      language: lang || 'auto',
    })
  } catch (error: any) {
    logger.error('Error in transcript route:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch transcript',
      },
      { status: 500 }
    )
  }
}
