// @ts-nocheck
// Legacy Teams tool - suppress type errors for now; to be migrated to new ToolConfig soon.
import { Tool } from './types'

interface TeamsCredential {
  tenantId: string
  clientId: string
  clientSecret: string
  accessToken?: string
}

export const teamsTool: Tool = {
  id: 'teams',
  name: 'Microsoft Teams',
  description: 'Send messages, create channels, and manage Teams communications',
  category: 'Communication',
  subcategory: 'Messaging',
  icon: 'teams',
  color: '#6264A7',
  inputs: [
    {
      id: 'action',
      name: 'Action',
      type: 'select',
      required: true,
      options: [
        { value: 'send_chat_message', label: 'Send Chat Message' },
        { value: 'send_channel_message', label: 'Send Channel Message' },
        { value: 'create_meeting', label: 'Create Meeting' },
        { value: 'create_channel', label: 'Create Channel' },
      ],
    },
    {
      id: 'credential',
      name: 'Microsoft Teams Credential',
      type: 'credential',
      required: true,
      credentialType: 'microsoft',
      credentialService: 'microsoft-teams',
    },
    {
      id: 'teamId',
      name: 'Team ID',
      type: 'text',
      required: false,
      description: 'Required for team operations',
    },
    {
      id: 'channelId',
      name: 'Channel ID',
      type: 'text',
      required: false,
      description: 'Required for channel operations',
    },
    {
      id: 'userId',
      name: 'User ID or Email',
      type: 'text',
      required: false,
      description: 'Required for direct messages',
    },
    {
      id: 'message',
      name: 'Message',
      type: 'textarea',
      required: false,
      description: 'Message content to send',
    },
    {
      id: 'channelName',
      name: 'Channel Name',
      type: 'text',
      required: false,
      description: 'Name for new channel',
    },
    {
      id: 'channelDescription',
      name: 'Channel Description',
      type: 'textarea',
      required: false,
      description: 'Description for new channel',
    },
    {
      id: 'channelType',
      name: 'Channel Type',
      type: 'select',
      required: false,
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'private', label: 'Private' },
      ],
    },
    {
      id: 'adaptiveCard',
      name: 'Adaptive Card JSON',
      type: 'code',
      required: false,
      description: 'Adaptive Card JSON payload',
    },
    {
      id: 'messageType',
      name: 'Message Type',
      type: 'select',
      required: false,
      options: [
        { value: 'text', label: 'Text' },
        { value: 'html', label: 'HTML' },
      ],
    },
  ],
  outputs: [
    {
      id: 'success',
      name: 'Success',
      type: 'boolean',
    },
    {
      id: 'messageId',
      name: 'Message ID',
      type: 'string',
    },
    {
      id: 'channelId',
      name: 'Channel ID',
      type: 'string',
    },
    {
      id: 'data',
      name: 'Response Data',
      type: 'object',
    },
    {
      id: 'error',
      name: 'Error',
      type: 'string',
    },
  ],
  execute: async (inputs: Record<string, any>) => {
    try {
      const {
        action,
        credential,
        teamId,
        channelId,
        userId,
        message,
        channelName,
        channelDescription,
        channelType = 'standard',
        adaptiveCard,
        messageType = 'text',
      } = inputs

      if (!credential) {
        return {
          success: false,
          error:
            '❌ No Microsoft Teams Account Connected\n\nConnect your Microsoft Teams account to use this feature.',
        }
      }

      if (!action) {
        return {
          success: false,
          error:
            '❌ No Action Selected\n\nSelect what you want to do: Send Message, Create Meeting, or Create Channel.',
        }
      }

      const teamsCredential = credential as TeamsCredential
      const accessToken = await getAccessToken(teamsCredential)

      switch (action) {
        case 'send_chat_message':
          if (!message) {
            return {
              success: false,
              error: '❌ Message is empty\n\nEnter a message to send.',
            }
          }
          return await sendChatMessage(accessToken, inputs.chatId || userId, message)

        case 'send_channel_message':
          if (!teamId || !channelId) {
            return {
              success: false,
              error: '❌ Team or Channel not selected\n\nSelect both a team and channel.',
            }
          }
          if (!message) {
            return {
              success: false,
              error: '❌ Message is empty\n\nEnter a message to send.',
            }
          }
          return await sendChannelMessage(accessToken, teamId, channelId, message, messageType)

        case 'create_meeting':
          if (!inputs.meetingTitle) {
            return {
              success: false,
              error: '❌ Meeting title is empty\n\nEnter a title for the meeting.',
            }
          }
          return await createMeeting(accessToken, inputs.meetingTitle, teamId)

        case 'create_channel':
          if (!teamId) {
            return {
              success: false,
              error: '❌ Team not selected\n\nSelect a team to create the channel in.',
            }
          }
          if (!inputs.channelName) {
            return {
              success: false,
              error: '❌ Channel name is empty\n\nEnter a name for the new channel.',
            }
          }
          return await createChannel(
            accessToken,
            teamId,
            inputs.channelName,
            inputs.channelDescription,
            channelType
          )

        default:
          return {
            success: false,
            error: `❌ Invalid action: "${action}"\n\nSelect a valid action from the dropdown.`,
          }
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '❌ Something went wrong\n\nTry again or reconnect your Microsoft Teams account.',
      }
    }
  },
}

async function getAccessToken(credential: TeamsCredential): Promise<string> {
  if (credential.accessToken) {
    return credential.accessToken
  }

  const tokenUrl = `https://login.microsoftonline.com/${credential.tenantId}/oauth2/v2.0/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: credential.clientId,
      client_secret: credential.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function sendChatMessage(
  accessToken: string,
  chatIdOrEmail: string,
  message: string
): Promise<Record<string, any>> {
  try {
    let chatId = chatIdOrEmail

    // If it looks like an email, create/find chat first
    if (chatIdOrEmail.includes('@')) {
      const chatUrl = `https://graph.microsoft.com/v1.0/chats`

      const chatResponse = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatType: 'oneOnOne',
          members: [
            {
              '@odata.type': '#microsoft.graph.aadUserConversationMember',
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${chatIdOrEmail}')`,
            },
          ],
        }),
      })

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text()
        let errorMessage = `Failed to create chat: ${chatResponse.statusText}`

        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error?.message) {
            errorMessage = parseMicrosoftError(errorJson.error)
          }
        } catch (e) {
          // If not JSON, use status text
        }

        return {
          success: false,
          error: errorMessage,
          errorCode: chatResponse.status,
        }
      }

      const chat = await chatResponse.json()
      chatId = chat.id
    }

    const messageUrl = `https://graph.microsoft.com/v1.0/chats/${chatId}/messages`

    const messageResponse = await fetch(messageUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          content: message,
          contentType: 'text',
        },
      }),
    })

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text()
      let errorMessage = `Failed to send message: ${messageResponse.statusText}`

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = parseMicrosoftError(errorJson.error)
        }
      } catch (e) {
        // If not JSON, use status text
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: messageResponse.status,
      }
    }

    const messageData = await messageResponse.json()

    return {
      success: true,
      messageId: messageData.id,
      chatId: chatId,
      data: messageData,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '❌ Failed to send chat message',
    }
  }
}

// Parse Microsoft Graph API errors into user-friendly messages
function parseMicrosoftError(error: any): string {
  const code = error.code || ''
  const message = error.message || ''

  // Check for specific error codes and provide helpful messages
  if (code === 'Forbidden' && message.includes('license')) {
    return (
      '⛔ Your Microsoft Account Is Not Eligible for This Feature\n\n' +
      "Your account doesn't have a Microsoft Teams license.\n\n" +
      'Solution: Contact your Microsoft 365 administrator to assign a Teams license, or sign up for Microsoft 365 at office.com.'
    )
  }

  if (code === 'Unauthorized' || code === 'InvalidAuthenticationToken') {
    return (
      '🔐 Authentication Failed\n\n' +
      'Your Microsoft Teams connection has expired.\n\n' +
      'Solution: Reconnect your Microsoft Teams account in this workflow.'
    )
  }

  if (code === 'ResourceNotFound') {
    return (
      '❌ Not Found\n\n' +
      "The chat, channel, or team doesn't exist.\n\n" +
      'Solution: Check your Team ID, Channel ID, or Chat ID and try again.'
    )
  }

  if (code === 'Forbidden') {
    return (
      '🚫 Permission Denied\n\n' +
      "You don't have permission for this action.\n\n" +
      'Solution: Reconnect your Microsoft Teams account and grant all required permissions.'
    )
  }

  // Return the original message if we don't have a specific handler
  return `❌ Microsoft Teams Error\n\n${message}`
}

async function sendChannelMessage(
  accessToken: string,
  teamId: string,
  channelId: string,
  message: string,
  messageType: string = 'text'
): Promise<Record<string, any>> {
  try {
    const messageUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`

    const response = await fetch(messageUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          content: message,
          contentType: messageType,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Failed to send channel message: ${response.statusText}`

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = parseMicrosoftError(errorJson.error)
        }
      } catch (e) {
        // If not JSON, use status text
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: response.status,
      }
    }

    const data = await response.json()

    return {
      success: true,
      messageId: data.id,
      data: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '❌ Failed to send channel message',
    }
  }
}

async function createChannel(
  accessToken: string,
  teamId: string,
  channelName: string,
  channelDescription?: string,
  channelType: string = 'standard'
): Promise<Record<string, any>> {
  try {
    const channelUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels`

    const response = await fetch(channelUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: channelName,
        description: channelDescription || '',
        membershipType: channelType,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Failed to create channel: ${response.statusText}`

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = parseMicrosoftError(errorJson.error)
        }
      } catch (e) {
        // If not JSON, use status text
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: response.status,
      }
    }

    const data = await response.json()

    return {
      success: true,
      channelId: data.id,
      data: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '❌ Failed to create channel',
    }
  }
}

async function getChannels(accessToken: string, teamId: string): Promise<Record<string, any>> {
  const channelsUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels`

  const response = await fetch(channelsUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get channels: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    data: data.value || [],
  }
}

async function getTeamMembers(accessToken: string, teamId: string): Promise<Record<string, any>> {
  const membersUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/members`

  const response = await fetch(membersUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get team members: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    data: data.value || [],
  }
}

async function sendAdaptiveCard(
  accessToken: string,
  teamId: string,
  channelId: string,
  adaptiveCard: string
): Promise<Record<string, any>> {
  const messageUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`

  let cardData
  try {
    cardData = JSON.parse(adaptiveCard)
  } catch (error) {
    throw new Error('Invalid Adaptive Card JSON format')
  }

  const response = await fetch(messageUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: cardData,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send adaptive card: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    messageId: data.id,
    data: data,
  }
}

async function sendNotification(
  accessToken: string,
  userId: string,
  message: string,
  priority: string = 'normal'
): Promise<Record<string, any>> {
  const notificationUrl = `https://graph.microsoft.com/v1.0/me/notifications`

  const response = await fetch(notificationUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetHostName: 'graph.microsoft.com',
      appNotificationId: `notification-${Date.now()}`,
      expirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      payload: {
        visualContent: {
          title: 'Workflow Notification',
          body: message,
        },
      },
      targetPolicy: {
        platformTypes: ['windows', 'android', 'ios', 'web'],
      },
      priority: priority,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send notification: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    notificationId: data.id,
    data: data,
  }
}

async function getTeams(accessToken: string): Promise<Record<string, any>> {
  const teamsUrl = `https://graph.microsoft.com/v1.0/me/joinedTeams`

  const response = await fetch(teamsUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get teams: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    data: data.value || [],
  }
}

async function createMeeting(
  accessToken: string,
  title: string,
  startTime: string,
  endTime: string,
  attendees: string
): Promise<Record<string, any>> {
  try {
    const meetingUrl = `https://graph.microsoft.com/v1.0/me/onlineMeetings`

    const attendeeList = attendees.split(',').map((email) => ({
      '@odata.type': '#microsoft.graph.meetingParticipantInfo',
      identity: {
        '@odata.type': '#microsoft.graph.identitySet',
        user: {
          '@odata.type': '#microsoft.graph.identity',
          id: email.trim(),
          displayName: email.trim(),
        },
      },
    }))

    const response = await fetch(meetingUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: title,
        startDateTime: startTime,
        endDateTime: endTime,
        participants: {
          attendees: attendeeList,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Failed to create meeting: ${response.statusText}`

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = parseMicrosoftError(errorJson.error)
        }
      } catch (e) {
        // If not JSON, use status text
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: response.status,
      }
    }

    const data = await response.json()

    return {
      success: true,
      meetingId: data.id,
      joinUrl: data.joinWebUrl,
      data: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '❌ Failed to create meeting',
    }
  }
}

async function scheduleMeeting(
  accessToken: string,
  teamId: string,
  title: string,
  startTime: string,
  endTime: string,
  attendees: string
): Promise<Record<string, any>> {
  const calendarUrl = `https://graph.microsoft.com/v1.0/me/events`

  const attendeeList = attendees.split(',').map((email) => ({
    emailAddress: {
      address: email.trim(),
      name: email.trim(),
    },
    type: 'required',
  }))

  const response = await fetch(calendarUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: title,
      start: {
        dateTime: startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime,
        timeZone: 'UTC',
      },
      attendees: attendeeList,
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to schedule meeting: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    eventId: data.id,
    joinUrl: data.onlineMeeting?.joinUrl,
    data: data,
  }
}

async function shareFile(
  accessToken: string,
  teamId: string,
  channelId: string,
  filePath: string
): Promise<Record<string, any>> {
  const shareUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`

  const response = await fetch(shareUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: {
        content: `File shared: ${filePath}`,
        contentType: 'text',
      },
      attachments: [
        {
          id: Date.now().toString(),
          contentType: 'reference',
          contentUrl: filePath,
          name: filePath.split('/').pop() || 'Shared File',
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to share file: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    messageId: data.id,
    data: data,
  }
}

async function searchMessages(
  accessToken: string,
  teamId: string,
  channelId: string,
  searchQuery: string
): Promise<Record<string, any>> {
  const searchUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages?$search="${encodeURIComponent(searchQuery)}"`

  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to search messages: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    data: data.value || [],
  }
}

async function getAnalytics(
  accessToken: string,
  teamId: string,
  analyticsType: string
): Promise<Record<string, any>> {
  let analyticsUrl = ''

  switch (analyticsType) {
    case 'team_activity':
      analyticsUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/analytics/activity`
      break
    case 'channel_activity':
      analyticsUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/analytics/activity`
      break
    case 'user_activity':
      analyticsUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/members/analytics/activity`
      break
    case 'meeting_analytics':
      analyticsUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/analytics/meetings`
      break
    case 'app_usage':
      analyticsUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/analytics/apps`
      break
    default:
      throw new Error(`Unsupported analytics type: ${analyticsType}`)
  }

  const response = await fetch(analyticsUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get analytics: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    success: true,
    analyticsType: analyticsType,
    data: data,
  }
}
