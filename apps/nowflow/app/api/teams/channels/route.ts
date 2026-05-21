import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'

const logger = createLogger('channelsAPI')

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const credentialId = searchParams.get('credentialId')
    const teamId = searchParams.get('teamId')

    if (!credentialId || !teamId) {
      return NextResponse.json({ error: 'Credential ID and Team ID required' }, { status: 400 })
    }

    const userId = session.user.id
    const requestId = `teams-channels-${Date.now()}`

    // Get access token with automatic refresh if needed
    const accessToken = await refreshAccessTokenIfNeeded(credentialId, userId, requestId)

    if (!accessToken) {
      logger.error('Failed to get valid access token', { credentialId, userId })
      return NextResponse.json(
        {
          error: 'Failed to get valid access token',
          hint: 'Token may be expired. Try reconnecting your Microsoft Teams account.',
        },
        { status: 401 }
      )
    }

    // Fetch channels from Microsoft Graph API
    const response = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      let errorDetails = errorBody

      try {
        const errorJson = JSON.parse(errorBody)
        errorDetails = errorJson

        logger.error('Microsoft Graph API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorJson,
          errorCode: errorJson.error?.code,
          errorMessage: errorJson.error?.message,
          credentialId,
          teamId,
        })
      } catch (e) {
        logger.error('Microsoft Graph API error (non-JSON):', {
          status: response.status,
          statusText: response.statusText,
          errorBody,
          credentialId,
          teamId,
        })
      }

      throw new Error(
        `Failed to fetch channels: ${response.status} ${response.statusText} - ${JSON.stringify(errorDetails)}`
      )
    }

    const data = await response.json()

    // Format channels for dropdown
    const channels =
      data.value?.map((channel: any) => ({
        id: channel.id,
        label: channel.displayName,
        description: channel.description || '',
        type: channel.membershipType,
      })) || []

    return NextResponse.json({ channels })
  } catch (error) {
    logger.error('Error fetching channels:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('401')
      ? 401
      : errorMessage.includes('403')
        ? 403
        : errorMessage.includes('404')
          ? 404
          : 500

    return NextResponse.json(
      {
        error: 'Failed to fetch channels',
        details: errorMessage,
        hint:
          status === 403
            ? 'Check if the user has granted all required permissions in Azure AD. Some scopes may require admin consent.'
            : status === 401
              ? 'Access token may be expired or invalid. Try reconnecting the account.'
              : 'An unexpected error occurred.',
      },
      { status }
    )
  }
}
