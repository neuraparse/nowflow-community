import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'

const logger = createLogger('listAPI')

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const credentialId = searchParams.get('credentialId')

    if (!credentialId) {
      return NextResponse.json({ error: 'Credential ID required' }, { status: 400 })
    }

    const userId = session.user.id
    const requestId = `teams-list-${Date.now()}`

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

    // Fetch teams from Microsoft Graph API
    const response = await fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
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
        })
      } catch (e) {
        logger.error('Microsoft Graph API error (non-JSON):', {
          status: response.status,
          statusText: response.statusText,
          errorBody,
          credentialId,
        })
      }

      throw new Error(
        `Failed to fetch teams: ${response.status} ${response.statusText} - ${JSON.stringify(errorDetails)}`
      )
    }

    const data = await response.json()

    // Format teams for dropdown
    const teams =
      data.value?.map((team: any) => ({
        id: team.id,
        label: team.displayName,
        description: team.description || '',
      })) || []

    return NextResponse.json({ teams })
  } catch (error) {
    logger.error('Error fetching teams:', error)

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
        error: 'Failed to fetch teams',
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
